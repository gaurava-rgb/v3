/**
 * Per-message match alert.
 * Replaces hourly aggie-v3-digest cron. Fired from bot.js right after
 * matcher.processRequest() returns ≥1 match. Queues:
 *   - 1 summary message (poster + matches inline)
 *   - N outreach messages (one wa.me deep link per matched person)
 * All deliveries go to ADMIN_PHONE via the existing outbound_queue worker.
 */

var { writeClient } = require('./supabase');
var { tierForPhone } = require('./profiles');

var ADMIN_PHONE = '919953477576';   // Gaurav
var BASE_URL    = 'https://ridesplit.app';
var MAX_MATCHES = 3;

function fmtCT(ts) {
    if (!ts) return '(unknown time)';
    var d = ts instanceof Date ? ts : new Date(ts);
    if (isNaN(d.getTime())) return '(unknown time)';
    var fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
        timeZoneName: 'short'
    });
    return fmt.format(d);
}

function clusterLabel(req) {
    var from = req.request_origin || '?';
    var to   = req.request_destination || '?';
    var date = req.ride_plan_date || 'flexible';
    return from + ' → ' + to + ' · ' + date;
}

function buildOutreach(matchPerson, posterReq) {
    var name  = matchPerson.sender_name || 'there';
    var from  = posterReq.request_origin || '';
    var to    = posterReq.request_destination || '';
    var date  = posterReq.ride_plan_date || '';
    var deep  = BASE_URL + '/?from=' + encodeURIComponent(from) +
                '&to=' + encodeURIComponent(to) +
                (date ? '&date=' + date : '');
    var lines = [
        'Hi ' + name + ', this is Gaurav, MS MIS \'26. I made ridesplit.app.',
        'Saw someone just posted a ride that matches yours (' + from + ' → ' + to +
            (date ? ' on ' + date : '') + ').',
        'Check it out: ' + deep,
        '',
        'Let me know if you have any questions.'
    ];
    return lines.join('\n');
}

function buildSummary(posterReq, posterTier, scoredMatches) {
    var lines = [
        '🚗 New ride posted',
        'Msg: "' + (posterReq.raw_message || '(no text)') + '"',
        'Sent: ' + fmtCT(posterReq.created_at),
        'Poster: ' + (posterReq.sender_name || 'Unknown') +
            ' (+' + (posterReq.source_contact || '?') + ') — ' + posterTier,
        'Cluster: ' + clusterLabel(posterReq),
        '-----xxx-----',
        'MATCHES (' + scoredMatches.length + '):'
    ];
    scoredMatches.forEach(function(item, i) {
        var m = item.person;
        lines.push('');
        lines.push((i + 1) + ') ' + (m.sender_name || 'Unknown') +
            ' (+' + (m.source_contact || '?') + ') — ' + item.tier);
        lines.push('   "' + (m.raw_message || '(no text)') + '"');
        lines.push('   Sent: ' + fmtCT(m.created_at));
        lines.push('   Quality: ' + item.quality);
        if (i < scoredMatches.length - 1) lines.push('-----xxx-----');
    });
    return lines.join('\n');
}

/**
 * Queue summary + per-match outreach messages.
 * posterReq: full v3_requests row (the just-saved request)
 * savedMatches: array from matcher.processRequest()
 */
async function queueMatchAlert(posterReq, savedMatches) {
    if (!posterReq || !Array.isArray(savedMatches) || savedMatches.length === 0) return;

    // Filter strong/medium, cap at MAX_MATCHES
    var qualityRank = { strong: 0, medium: 1, low: 2 };
    var filtered = savedMatches
        .filter(function(s) { return s.match_quality !== 'low'; })
        .sort(function(a, b) {
            return (qualityRank[a.match_quality] ?? 3) - (qualityRank[b.match_quality] ?? 3);
        })
        .slice(0, MAX_MATCHES);

    if (filtered.length === 0) return;

    // The "other" person on each match is whichever side isn't the poster
    var posterId = posterReq.id;
    var people = filtered.map(function(s) {
        var other = s.need.id === posterId ? s.offer : s.need;
        return { person: other, quality: s.match_quality };
    });

    // Resolve tiers in parallel
    var posterTier = await tierForPhone(posterReq.source_contact);
    var matchTiers = await Promise.all(people.map(function(p) {
        return tierForPhone(p.person.source_contact);
    }));
    var scored = people.map(function(p, i) {
        return { person: p.person, quality: p.quality, tier: matchTiers[i] };
    });

    var summary = buildSummary(posterReq, posterTier, scored);

    var rows = [{
        contact:      ADMIN_PHONE,
        channel:      'whatsapp',
        message_type: 'match_alert',
        status:       'pending',
        payload: {
            message:    summary,
            poster_id:  posterReq.id,
            match_count: scored.length
        }
    }];

    scored.forEach(function(s) {
        var personPhone = (s.person.source_contact || '').replace(/\D/g, '');
        var waLink = personPhone
            ? 'https://wa.me/' + personPhone + '?text=' + encodeURIComponent(buildOutreach(s.person, posterReq))
            : '(no phone on file)';
        var outreachMsg = [
            'Outreach for ' + (s.person.sender_name || 'Unknown') +
                ' (+' + (s.person.source_contact || '?') + ') — ' + s.tier + ':',
            '',
            waLink
        ].join('\n');
        rows.push({
            contact:      ADMIN_PHONE,
            channel:      'whatsapp',
            message_type: 'match_outreach',
            status:       'pending',
            payload: {
                message:           outreachMsg,
                poster_id:         posterReq.id,
                target_contact:    s.person.source_contact
            }
        });
    });

    var { error } = await writeClient.from('outbound_queue').insert(rows);
    if (error) {
        console.error('[MatchAlert] Queue insert failed:', error.message);
        return;
    }
    console.log('[MatchAlert] Queued summary + ' + scored.length + ' outreach msg(s) for request ' + posterReq.id);
}

module.exports = { queueMatchAlert };
