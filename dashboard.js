/**
 * Aggie Connect — Dashboard v3.1
 * Public ride board at v3.myburrow.club
 * Port: 3004
 */

require('dotenv').config();

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
const PORT = process.env.DASHBOARD_PORT || 3004;
const DIGEST_KEY = process.env.DIGEST_KEY || '';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ── Utilities ─────────────────────────────────────────────────────────────

function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function redactPhone(phone) {
    if (!phone) return '';
    const s = String(phone).trim();
    const digits = s.replace(/\D/g, '');
    if (digits.length <= 3) return s;
    const prefix = s.startsWith('+') ? '+' : '';
    return prefix + digits.slice(0, 2) + '*'.repeat(digits.length - 3) + digits.slice(-1);
}

function redactName(name) {
    if (!name) return '';
    const s = String(name).trim();
    if (s.length <= 2) return s;
    return s[0] + '*'.repeat(s.length - 2) + s[s.length - 1];
}

function redactContact(contact) {
    if (!contact) return '';
    const s = String(contact).trim();
    if (/^\+?\d[\d\s\-]{5,}/.test(s)) return redactPhone(s);
    return redactName(s);
}

function displayName(req) {
    if (req.sender_name) return redactName(req.sender_name);
    return redactContact(req.source_contact);
}

function formatDate(d) {
    if (!d) return 'Flexible';
    const date = new Date(d + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const base = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (date.getTime() === today.getTime()) return 'Today, ' + base;
    if (date.getTime() === tomorrow.getTime()) return 'Tomorrow, ' + base;
    return base;
}

function formatTime(t) {
    if (!t) return '';
    var parts = t.split(':').map(Number);
    var h = parts[0] || 0;
    var m = parts[1] || 0;
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 || 12;
    return h12 + ':' + String(m).padStart(2, '0') + ' ' + ampm;
}

// ── Digest Utilities ─────────────────────────────────────────────────────

function digestFormatPhone(contact) {
    if (!contact) return 'Unknown';
    var digits = String(contact).replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
        return '+1 ' + digits.slice(1, 4) + '-' + digits.slice(4, 7) + '-' + digits.slice(7);
    }
    if (digits.length === 10) {
        return '+1 ' + digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6);
    }
    return '+' + digits;
}

function digestFirstName(name) {
    if (!name) return 'there';
    return String(name).trim().split(/\s+/)[0];
}

function phoneDigitsOnly(contact) {
    if (!contact) return '';
    var digits = String(contact).replace(/\D/g, '');
    if (digits.length === 10) return '1' + digits;
    return digits;
}

function generateRiderMessage(need, offer) {
    var dest = need.request_destination || offer.request_destination || 'your destination';
    var dateStr = offer.ride_plan_date ? formatDate(offer.ride_plan_date) : 'soon';
    var timeStr = offer.ride_plan_time ? ' around ' + formatTime(offer.ride_plan_time) : '';
    return 'Hey! Someone\u2019s offering a ride to ' + dest + ' ' + dateStr + timeStr +
        '. Interested? Let me know and I\u2019ll connect you both \uD83D\uDE42';
}

function generateDriverMessage(need, offer) {
    var dest = offer.request_destination || need.request_destination || 'your destination';
    var dateStr = need.ride_plan_date ? formatDate(need.ride_plan_date) : 'soon';
    var timeStr = need.ride_plan_time ? ' around ' + formatTime(need.ride_plan_time) : '';
    return 'Hey! Someone needs a ride to ' + dest + ' ' + dateStr + timeStr +
        ' \u2014 same as you. Want me to connect you both? \uD83D\uDE42';
}

function generateSameWayMessage(person, cluster) {
    var otherCount = cluster.needs.length - 1;
    var dest = cluster.destination || 'your destination';
    var dateStr = cluster.repDate ? formatDate(cluster.repDate) : 'soon';
    var people = otherCount === 1 ? '1 other person is' : otherCount + ' other people are';
    return 'Hey! ' + people + ' also heading to ' + dest + ' ' + dateStr +
        '. Want me to connect you all so you can coordinate? \uD83D\uDE42';
}

// ── Cluster Logic (from dashboard3) ───────────────────────────────────────

function datesOverlap(a, b, strict) {
    if (!a.ride_plan_date && !b.ride_plan_date) return true;
    if (!a.ride_plan_date || !b.ride_plan_date) return !strict;
    if (a.ride_plan_date === b.ride_plan_date) return true;
    if (a.date_fuzzy && (a.possible_dates || []).includes(b.ride_plan_date)) return true;
    if (b.date_fuzzy && (b.possible_dates || []).includes(a.ride_plan_date)) return true;
    if (strict) return false;
    const da = new Date(a.ride_plan_date);
    const db = new Date(b.ride_plan_date);
    return Math.abs((da - db) / 86400000) <= 1;
}

function buildClusters(requests, strict) {
    var byRoute = {};
    for (var i = 0; i < requests.length; i++) {
        var r = requests[i];
        var key = (r.request_origin || '?') + '|' + (r.request_destination || '?');
        if (!byRoute[key]) byRoute[key] = { origin: r.request_origin || '?', destination: r.request_destination || '?', members: [] };
        byRoute[key].members.push(r);
    }

    var clusters = [];
    var routes = Object.values(byRoute);
    for (var ri = 0; ri < routes.length; ri++) {
        var route = routes[ri];
        var members = route.members;
        var assigned = new Array(members.length).fill(-1);
        var idx = 0;

        for (var a = 0; a < members.length; a++) {
            if (assigned[a] !== -1) continue;
            assigned[a] = idx;
            for (var b = a + 1; b < members.length; b++) {
                if (assigned[b] !== -1) continue;
                if (datesOverlap(members[a], members[b], strict)) assigned[b] = idx;
            }
            idx++;
        }

        var groups = {};
        for (var gi = 0; gi < members.length; gi++) {
            if (!groups[assigned[gi]]) groups[assigned[gi]] = [];
            groups[assigned[gi]].push(members[gi]);
        }

        var groupValues = Object.values(groups);
        for (var gvi = 0; gvi < groupValues.length; gvi++) {
            var g = groupValues[gvi];
            var offers = g.filter(function(m) { return m.request_type === 'offer'; });
            var needs = g.filter(function(m) { return m.request_type === 'need'; });
            var dates = g.map(function(m) { return m.ride_plan_date; }).filter(Boolean).sort();
            clusters.push({
                origin: route.origin,
                destination: route.destination,
                offers: offers,
                needs: needs,
                repDate: (offers[0] && offers[0].ride_plan_date) || dates[0] || null,
                hasOffer: offers.length > 0
            });
        }
    }

    clusters.sort(function(a, b) {
        return (a.repDate || '9999').localeCompare(b.repDate || '9999');
    });
    return clusters;
}

// ── Render helpers ────────────────────────────────────────────────────────

function renderRouteCard(c) {
    var offerCount = c.offers.length;
    var needCount = c.needs.length;
    var parts = [];

    parts.push('<div class="route-card">');
    parts.push('<span class="route-name">' + escHtml(c.origin) + ' &rarr; ' + escHtml(c.destination) + '</span>');

    if (offerCount > 0) {
        var oNames = c.offers.map(function(o) { return escHtml(displayName(o)); }).join(', ');
        var times = c.offers.map(function(o) { return o.ride_plan_time ? formatTime(o.ride_plan_time) : null; }).filter(Boolean);
        var timeStr = times.length > 0 ? ' (' + escHtml(times.join(', ')) + ')' : '';
        var verb = offerCount === 1 ? 'offering a ride' : 'offering rides';
        parts.push('<div class="route-offer">&#x1F697; ' + offerCount + ' ' + verb + timeStr + ' <span class="names">&mdash; ' + oNames + '</span></div>');
    }

    if (needCount > 0) {
        var nNames = c.needs.map(function(n) { return escHtml(displayName(n)); }).join(', ');
        var nverb = needCount === 1 ? 'looking for a ride' : 'looking for rides';
        parts.push('<div class="route-needs">&#x1F44B; ' + needCount + ' ' + nverb + ' <span class="names">&mdash; ' + nNames + '</span></div>');
    }

    if (c.hasOffer && needCount > 0) {
        parts.push('<div class="route-status status-match">&#x1F7E2; Going the same way</div>');
    } else if (!c.hasOffer && needCount > 0) {
        parts.push('<div class="route-status status-none">Nobody&#x2019;s driving as of now</div>');
    }

    parts.push('</div>');
    return parts.join('\n');
}

function renderDateGroup(dateKey, dateClusters) {
    var dateLabel = dateKey === 'flexible' ? 'Flexible Dates' : formatDate(dateKey);
    var cards = dateClusters.map(renderRouteCard).join('\n');
    return '<div class="date-group">\n<div class="date-label">' + escHtml(dateLabel) + '</div>\n' + cards + '\n</div>';
}

function renderOpportunity(c) {
    var dateStr = c.repDate ? formatDate(c.repDate) : 'soon';
    var count = c.needs.length;
    var plural = count !== 1 ? 's' : '';
    return '<div class="opportunity">' + count + ' student' + plural + ' heading to ' + escHtml(c.destination) + ' ' + escHtml(dateStr) + ' &mdash; no ride offered yet</div>';
}

// ── Data ──────────────────────────────────────────────────────────────────

async function getBoardData() {
    var today = new Date().toISOString().split('T')[0];

    var results = await Promise.all([
        supabase.from('v3_requests').select('*')
            .eq('request_category', 'ride')
            .or('ride_plan_date.gte.' + today + ',date_fuzzy.eq.true,ride_plan_date.is.null')
            .order('created_at', { ascending: false }),
        supabase.from('monitored_groups').select('group_id, group_name, is_test').eq('active', true),
        supabase.from('v3_requests').select('id')
            .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
        supabase.from('v3_requests').select('id')
            .gte('created_at', today + 'T00:00:00')
    ]);

    // Exclude test groups from dashboard (uses is_test column)
    // Filter set includes both group_id (JID) and group_name
    // because migrated v2 data stored names, v3 stores JIDs
    var allGroups = results[1].data || [];
    var testGroupFilter = new Set();
    var activeGroupIds = [];
    for (var gi = 0; gi < allGroups.length; gi++) {
        if (allGroups[gi].is_test) {
            testGroupFilter.add(allGroups[gi].group_id);
            if (allGroups[gi].group_name) {
                testGroupFilter.add(allGroups[gi].group_name);
            }
        } else {
            activeGroupIds.push(allGroups[gi]);
        }
    }

    var rawReqs = results[0].data || [];
    var allReqs = rawReqs.filter(function(r) {
        return !r.source_group || !testGroupFilter.has(r.source_group);
    });
    var groupRows = activeGroupIds;
    var weekRows = results[2].data || [];
    var todayRows = results[3].data || [];

    var clusters = buildClusters(allReqs);

    var byDate = {};
    for (var i = 0; i < clusters.length; i++) {
        var key = clusters[i].repDate || 'flexible';
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(clusters[i]);
    }

    var sortedDates = Object.keys(byDate).sort(function(a, b) {
        if (a === 'flexible') return 1;
        if (b === 'flexible') return -1;
        return a.localeCompare(b);
    });

    var opportunities = clusters.filter(function(c) { return !c.hasOffer && c.needs.length >= 2; });

    return {
        byDate: byDate,
        sortedDates: sortedDates,
        opportunities: opportunities,
        totalGroups: groupRows.length,
        weekCount: weekRows.length,
        todayCount: todayRows.length,
        totalRequests: allReqs.length
    };
}

// ── Digest Data ──────────────────────────────────────────────────────────

async function fetchOpenMatches(showAll) {
    var matchQuery = supabase
        .from('v3_matches')
        .select('id, need_id, offer_id, score, match_quality, notified, created_at')
        .order('created_at', { ascending: false });

    if (!showAll) {
        matchQuery = matchQuery.eq('notified', false);
    }

    var matchResult = await matchQuery;
    if (matchResult.error) throw new Error('Failed to fetch matches: ' + matchResult.error.message);
    var matches = matchResult.data || [];
    if (matches.length === 0) return [];

    var idSet = new Set();
    for (var i = 0; i < matches.length; i++) {
        idSet.add(matches[i].need_id);
        idSet.add(matches[i].offer_id);
    }
    var requestIds = Array.from(idSet);

    var reqResult = await supabase
        .from('v3_requests')
        .select('id, source_group, source_contact, sender_name, request_type, ride_plan_date, ride_plan_time, request_origin, request_destination, raw_message')
        .in('id', requestIds);
    if (reqResult.error) throw new Error('Failed to fetch requests: ' + reqResult.error.message);

    var groupResult = await supabase
        .from('monitored_groups')
        .select('group_id, group_name, is_test');

    var groupMap = new Map();
    var testGroups = new Set();
    var groups = (groupResult.data || []);
    for (var gi = 0; gi < groups.length; gi++) {
        groupMap.set(groups[gi].group_id, groups[gi].group_name);
        if (groups[gi].is_test) {
            testGroups.add(groups[gi].group_id);
            if (groups[gi].group_name) testGroups.add(groups[gi].group_name);
        }
    }

    var requestMap = new Map();
    var requests = reqResult.data || [];
    for (var ri = 0; ri < requests.length; ri++) {
        requestMap.set(requests[ri].id, requests[ri]);
    }

    var enriched = [];
    for (var mi = 0; mi < matches.length; mi++) {
        var m = matches[mi];
        var need = requestMap.get(m.need_id);
        var offer = requestMap.get(m.offer_id);
        if (!need || !offer) continue;

        if (need.source_group && testGroups.has(need.source_group)) continue;
        if (offer.source_group && testGroups.has(offer.source_group)) continue;

        var resolveGroup = function(sg) {
            if (!sg) return 'Unknown Group';
            return groupMap.get(sg) || sg;
        };

        enriched.push({
            matchId: m.id,
            matchQuality: m.match_quality,
            score: m.score,
            notified: m.notified,
            createdAt: m.created_at,
            need: Object.assign({}, need, { groupName: resolveGroup(need.source_group) }),
            offer: Object.assign({}, offer, { groupName: resolveGroup(offer.source_group) })
        });
    }

    return enriched;
}

async function markNotified(matchIds) {
    if (!matchIds || matchIds.length === 0) return;
    var result = await supabase
        .from('v3_matches')
        .update({ notified: true })
        .in('id', matchIds);
    if (result.error) {
        throw new Error('Failed to mark notified: ' + result.error.message);
    }
}

async function fetchSameWayClusters() {
    var today = new Date().toISOString().split('T')[0];

    var results = await Promise.all([
        supabase.from('v3_requests').select('id, source_group, source_contact, sender_name, request_type, request_category, ride_plan_date, ride_plan_time, date_fuzzy, possible_dates, request_origin, request_destination, raw_message')
            .eq('request_category', 'ride')
            .or('ride_plan_date.gte.' + today + ',date_fuzzy.eq.true,ride_plan_date.is.null')
            .order('created_at', { ascending: false }),
        supabase.from('monitored_groups').select('group_id, group_name, is_test')
    ]);

    // Build test-group filter (both JIDs and names)
    var groupMap = new Map();
    var testGroups = new Set();
    var groups = (results[1].data || []);
    for (var gi = 0; gi < groups.length; gi++) {
        groupMap.set(groups[gi].group_id, groups[gi].group_name);
        if (groups[gi].is_test) {
            testGroups.add(groups[gi].group_id);
            if (groups[gi].group_name) testGroups.add(groups[gi].group_name);
        }
    }

    var rawReqs = results[0].data || [];
    var allReqs = rawReqs.filter(function(r) {
        return !r.source_group || !testGroups.has(r.source_group);
    });

    // Attach resolved group names
    for (var ri = 0; ri < allReqs.length; ri++) {
        allReqs[ri].groupName = groupMap.get(allReqs[ri].source_group) || allReqs[ri].source_group || 'Unknown Group';
    }

    var clusters = buildClusters(allReqs, true);

    // Return only clusters with 2+ people looking for rides
    return clusters.filter(function(c) { return c.needs.length >= 2; });
}

function digestAuth(req, res) {
    if (!DIGEST_KEY) {
        res.status(500).send('DIGEST_KEY not configured');
        return false;
    }
    if (req.query.key !== DIGEST_KEY) {
        res.status(403).send('Forbidden');
        return false;
    }
    return true;
}

function renderMatchCard(match, digestKey) {
    var need = match.need;
    var offer = match.offer;

    var needName = need.sender_name || need.source_contact || 'Unknown';
    var offerName = offer.sender_name || offer.source_contact || 'Unknown';
    var needPhone = digestFormatPhone(need.source_contact);
    var offerPhone = digestFormatPhone(offer.source_contact);
    var needDigits = phoneDigitsOnly(need.source_contact);
    var offerDigits = phoneDigitsOnly(offer.source_contact);

    var date = need.ride_plan_date || offer.ride_plan_date;
    var origin = need.request_origin || offer.request_origin || '?';
    var dest = need.request_destination || offer.request_destination || '?';

    var qualityEmoji = { strong: '\uD83D\uDFE2', medium: '\uD83D\uDFE1', low: '\uD83D\uDD34' }[match.matchQuality] || '\u26AA';

    var riderMsg = generateRiderMessage(need, offer);
    var driverMsg = generateDriverMessage(need, offer);

    var groupLine;
    if (need.groupName === offer.groupName) {
        groupLine = 'Same group: ' + escHtml(need.groupName);
    } else {
        groupLine = escHtml(need.groupName) + ' / ' + escHtml(offer.groupName);
    }

    var handledClass = match.notified ? ' handled' : '';
    var handledBadge = match.notified ? ' <span class="handled-badge">Handled</span>' : '';
    var markBtn = !match.notified
        ? '<button class="btn btn-mark" onclick="markHandled(\'' + match.matchId + '\')">Mark Handled</button>'
        : '';

    var dateLabel = date ? formatDate(date) : 'Flexible date';

    var parts = [];
    parts.push('<div class="match-card' + handledClass + '" id="match-' + match.matchId + '">');
    parts.push('  <div class="match-date">' + escHtml(dateLabel) + '</div>');
    parts.push('  <div class="match-route">' + escHtml(origin) + ' &rarr; ' + escHtml(dest) + handledBadge + '</div>');
    parts.push('  <div class="match-quality">' + qualityEmoji + ' ' + escHtml(match.matchQuality) + '</div>');
    parts.push('  <div class="match-group">' + groupLine + '</div>');

    // Need person
    parts.push('  <div class="match-person">');
    parts.push('    <div class="match-person-label">\uD83D\uDC4B Looking for a ride</div>');
    parts.push('    <div class="match-person-name">' + escHtml(needName) + '</div>');
    parts.push('    <div class="match-person-phone">' + escHtml(needPhone) + '</div>');
    if (need.raw_message) {
        parts.push('    <div class="match-person-msg">&ldquo;' + escHtml(need.raw_message) + '&rdquo;</div>');
    }
    parts.push('    <div class="pre-msg">' + escHtml(riderMsg) + '</div>');
    if (needDigits) {
        parts.push('    <a class="wa-link" href="https://wa.me/' + needDigits + '?text=' + encodeURIComponent(riderMsg) + '" target="_blank">\uD83D\uDCAC Message ' + escHtml(digestFirstName(need.sender_name)) + '</a>');
    }
    parts.push('  </div>');

    // Offer person
    parts.push('  <div class="match-person">');
    parts.push('    <div class="match-person-label">\uD83D\uDE97 Offering a ride</div>');
    parts.push('    <div class="match-person-name">' + escHtml(offerName) + '</div>');
    parts.push('    <div class="match-person-phone">' + escHtml(offerPhone) + '</div>');
    if (offer.raw_message) {
        parts.push('    <div class="match-person-msg">&ldquo;' + escHtml(offer.raw_message) + '&rdquo;</div>');
    }
    parts.push('    <div class="pre-msg">' + escHtml(driverMsg) + '</div>');
    if (offerDigits) {
        parts.push('    <a class="wa-link" href="https://wa.me/' + offerDigits + '?text=' + encodeURIComponent(driverMsg) + '" target="_blank">\uD83D\uDCAC Message ' + escHtml(digestFirstName(offer.sender_name)) + '</a>');
    }
    parts.push('  </div>');

    parts.push('  ' + markBtn);
    parts.push('</div>');
    return parts.join('\n');
}

function renderClusterCard(cluster, digestKey) {
    var dateLabel = cluster.repDate ? formatDate(cluster.repDate) : 'Flexible date';
    var parts = [];

    parts.push('<div class="cluster-card">');
    parts.push('  <div class="match-date">' + escHtml(dateLabel) + '</div>');
    parts.push('  <div class="match-route">' + escHtml(cluster.origin) + ' &rarr; ' + escHtml(cluster.destination) + '</div>');
    parts.push('  <div class="cluster-count">\uD83D\uDC65 ' + cluster.needs.length + ' people looking for rides</div>');

    if (cluster.offers.length > 0) {
        parts.push('  <div class="cluster-has-offer">\uD83D\uDE97 ' + cluster.offers.length + ' offering — also shown in matches above</div>');
    }

    for (var i = 0; i < cluster.needs.length; i++) {
        var person = cluster.needs[i];
        var name = person.sender_name || person.source_contact || 'Unknown';
        var phone = digestFormatPhone(person.source_contact);
        var digits = phoneDigitsOnly(person.source_contact);
        var msg = generateSameWayMessage(person, cluster);
        var groupName = person.groupName || 'Unknown Group';

        parts.push('  <div class="match-person">');
        parts.push('    <div class="match-person-name">' + escHtml(name) + '</div>');
        parts.push('    <div class="match-person-phone">' + escHtml(phone) + '</div>');
        parts.push('    <div class="cluster-group-name" style="font-size:12px;color:#999;">' + escHtml(groupName) + '</div>');
        if (person.raw_message) {
            parts.push('    <div class="match-person-msg">&ldquo;' + escHtml(person.raw_message) + '&rdquo;</div>');
        }
        parts.push('    <div class="pre-msg">' + escHtml(msg) + '</div>');
        if (digits) {
            parts.push('    <a class="wa-link" href="https://wa.me/' + digits + '?text=' + encodeURIComponent(msg) + '" target="_blank">\uD83D\uDCAC Message ' + escHtml(digestFirstName(person.sender_name)) + '</a>');
        }
        parts.push('  </div>');
    }

    parts.push('</div>');
    return parts.join('\n');
}

// ── Route ─────────────────────────────────────────────────────────────────

app.get('/', async function(req, res) {
    try {
        var data = await getBoardData();

        var boardHtml;
        if (data.sortedDates.length === 0) {
            boardHtml = '<div class="empty">No ride activity this week yet. The bot is monitoring groups and will show activity here as requests come in.</div>';
        } else {
            boardHtml = data.sortedDates.map(function(dk) {
                return renderDateGroup(dk, data.byDate[dk]);
            }).join('\n');
        }

        var oppsHtml = '';
        if (data.opportunities.length > 0) {
            oppsHtml = '<div class="section">\n<div class="section-header">Opportunities</div>\n' +
                data.opportunities.map(renderOpportunity).join('\n') +
                '\n</div>';
        }

        var activityMsg;
        if (data.todayCount > 0) {
            activityMsg = 'Saw <strong>' + data.todayCount + '</strong> ride request' + (data.todayCount !== 1 ? 's' : '') + ' today across <strong>' + data.totalGroups + '</strong> groups';
        } else {
            activityMsg = 'Monitoring <strong>' + data.totalGroups + '</strong> WhatsApp group' + (data.totalGroups !== 1 ? 's' : '') + ' for ride requests';
        }

        var weekLabel = data.weekCount + ' ride request' + (data.weekCount !== 1 ? 's' : '');
        var groupLabel = data.totalGroups + ' WhatsApp group' + (data.totalGroups !== 1 ? 's' : '');

        var html = [
            '<!DOCTYPE html>',
            '<html lang="en">',
            '<head>',
            '<!-- Google tag (gtag.js) -->',
            '<script async src="https://www.googletagmanager.com/gtag/js?id=G-PT7Y07LEPC"></script>',
            '<script>',
            '  window.dataLayer = window.dataLayer || [];',
            '  function gtag(){dataLayer.push(arguments);}',
            "  gtag('js', new Date());",
            "  gtag('config', 'G-PT7Y07LEPC');",
            '</script>',
            '<meta charset="utf-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1">',
            '<title>Aggie Connect</title>',
            '<style>',
            '  * { margin: 0; padding: 0; box-sizing: border-box; }',
            '  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fafafa; color: #1a1a1a; line-height: 1.6; }',
            '  .container { max-width: 720px; margin: 0 auto; padding: 32px 16px; }',
            '',
            '  .hero { text-align: center; margin-bottom: 40px; position: relative; }',
            '  .hero h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 6px; }',
            '  .hero .subtitle { font-size: 15px; color: #666; }',
            '  .hero .subtitle strong { color: #1a1a1a; }',
            '  .clock { position: absolute; top: 0; right: 0; text-align: right; font-size: 13px; color: #999; line-height: 1.3; }',
            '  .clock .time { font-size: 15px; font-weight: 600; color: #555; }',
            '',
            '  .section { margin-bottom: 36px; }',
            '  .section-header { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #999; margin-bottom: 16px; }',
            '',
            '  .date-group { margin-bottom: 24px; }',
            '  .date-label { font-size: 15px; font-weight: 600; color: #333; margin-bottom: 10px; padding: 8px 0 6px; border-bottom: 1px solid #e5e5e5; position: sticky; top: 0; background: #fafafa; z-index: 10; }',
            '',
            '  .route-card { background: #fff; border: 1px solid #e8e8e8; border-radius: 10px; padding: 16px 18px; margin-bottom: 10px; }',
            '  .route-name { font-size: 16px; font-weight: 600; display: block; margin-bottom: 8px; }',
            '  .route-offer { font-size: 14px; color: #333; margin-bottom: 4px; }',
            '  .route-needs { font-size: 14px; color: #333; margin-bottom: 4px; }',
            '  .names { color: #999; font-size: 13px; }',
            '  .route-status { font-size: 13px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f0f0f0; }',
            '  .status-match { color: #16a34a; }',
            '  .status-none { color: #9ca3af; font-style: italic; }',
            '',
            '  .opportunity { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 18px; margin-bottom: 10px; font-size: 14px; color: #92400e; }',
            '',
            '  .activity { text-align: center; font-size: 14px; color: #888; padding: 16px; background: #fff; border: 1px solid #e8e8e8; border-radius: 10px; }',
            '  .activity strong { color: #333; }',
            '',
            '  .footer { text-align: center; font-size: 11px; color: #bbb; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e8e8e8; }',
            '',
            '  .empty { text-align: center; color: #aaa; font-size: 14px; padding: 32px 16px; }',
            '',
            '  @media (max-width: 480px) {',
            '    .container { padding: 20px 12px; }',
            '    .hero h1 { font-size: 24px; }',
            '    .route-card { padding: 14px; }',
            '    .clock { position: static; text-align: center; margin-bottom: 12px; }',
            '  }',
            '</style>',
            '</head>',
            '<body>',
            '<div class="container">',
            '',
            '  <div class="hero">',
            '    <div class="clock"><span class="time" id="live-time"></span><br>Central Time</div>',
            '    <h1>Aggie Connect</h1>',
            '    <p class="subtitle">Tracking <strong>' + weekLabel + '</strong> across <strong>' + groupLabel + '</strong> this week</p>',
            '  </div>',
            '',
            '  <div class="section">',
            '    <div class="section-header">Going the Same Way</div>',
            '    ' + boardHtml,
            '  </div>',
            '',
            oppsHtml,
            '',
            '  <div class="section">',
            '    <div class="activity">' + activityMsg + '</div>',
            '  </div>',
            '',
            '  <div class="footer">',
            '    ' + data.totalRequests + ' total requests &middot; ' + data.totalGroups + ' groups monitored &middot; v3.1',
            '  </div>',
            '',
            '</div>',
            '<script>',
            '(function() {',
            '  function updateClock() {',
            '    var now = new Date();',
            '    var opts = { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" };',
            '    var el = document.getElementById("live-time");',
            '    if (el) el.textContent = now.toLocaleTimeString("en-US", opts);',
            '  }',
            '  updateClock();',
            '  setInterval(updateClock, 30000);',
            '})()',
            '</script>',
            '</body>',
            '</html>'
        ].join('\n');

        res.send(html);
    } catch (err) {
        console.error('[Dashboard] Error:', err.message);
        res.status(500).send('Error loading dashboard');
    }
});

// ── Digest Routes ────────────────────────────────────────────────────────

app.get('/digest', async function(req, res) {
    if (!digestAuth(req, res)) return;

    try {
        var showAll = req.query.show === 'all';
        var matchesPromise = fetchOpenMatches(showAll);
        var clustersPromise = fetchSameWayClusters();
        var matches = await matchesPromise;
        var clusters = await clustersPromise;
        var unhandledCount = matches.filter(function(m) { return !m.notified; }).length;
        var KEY = req.query.key;

        var cardsHtml;
        if (matches.length === 0) {
            cardsHtml = '<div class="empty-state"><div class="check">&#x2705;</div>All clear! No unnotified matches.</div>';
        } else {
            cardsHtml = matches.map(function(m) { return renderMatchCard(m, KEY); }).join('\n');
        }

        var clustersHtml;
        if (clusters.length === 0) {
            clustersHtml = '<div class="empty-state" style="padding:24px;font-size:14px;color:#aaa;">No same-way clusters right now.</div>';
        } else {
            clustersHtml = clusters.map(function(c) { return renderClusterCard(c, KEY); }).join('\n');
        }

        var toggleHref = '/digest?key=' + encodeURIComponent(KEY) + (showAll ? '' : '&show=all');
        var toggleLabel = showAll ? 'Show Unhandled Only' : 'Show All';

        var markAllBtn = unhandledCount > 0
            ? '<button class="btn btn-mark-all" onclick="markAll()">Mark All Handled</button>'
            : '';

        var html = [
            '<!DOCTYPE html>',
            '<html lang="en">',
            '<head>',
            '<meta charset="utf-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1">',
            '<title>Admin Digest</title>',
            '<style>',
            '  * { margin: 0; padding: 0; box-sizing: border-box; }',
            '  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fafafa; color: #1a1a1a; line-height: 1.6; }',
            '  .container { max-width: 720px; margin: 0 auto; padding: 32px 16px; }',
            '',
            '  .digest-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }',
            '  .digest-header h1 { font-size: 22px; font-weight: 700; }',
            '  .digest-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }',
            '',
            '  .match-card { background: #fff; border: 1px solid #e8e8e8; border-radius: 10px; padding: 18px; margin-bottom: 14px; }',
            '  .match-card.handled { opacity: 0.5; }',
            '  .match-date { font-size: 13px; color: #888; margin-bottom: 2px; }',
            '  .match-route { font-size: 17px; font-weight: 600; margin-bottom: 4px; }',
            '  .match-quality { font-size: 13px; margin-bottom: 4px; }',
            '  .match-group { font-size: 13px; color: #666; margin-bottom: 14px; }',
            '',
            '  .match-person { background: #f9f9f9; border-radius: 8px; padding: 14px; margin-bottom: 10px; }',
            '  .match-person-label { font-size: 12px; font-weight: 600; color: #888; margin-bottom: 6px; }',
            '  .match-person-name { font-size: 15px; font-weight: 600; }',
            '  .match-person-phone { font-size: 14px; color: #555; }',
            '  .match-person-msg { font-size: 13px; color: #888; font-style: italic; margin-top: 6px; word-break: break-word; }',
            '',
            '  .pre-msg { background: #f0f0f0; border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px; font-size: 13px; margin-top: 8px; white-space: pre-wrap; word-break: break-word; color: #444; }',
            '',
            '  .wa-link { display: inline-block; background: #25D366; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-top: 8px; }',
            '  .wa-link:active { background: #1da851; }',
            '',
            '  .btn { display: inline-block; padding: 8px 16px; border-radius: 8px; border: 1px solid #ccc; background: #fff; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; color: #555; }',
            '  .btn-mark { color: #16a34a; border-color: #16a34a; background: #fff; }',
            '  .btn-mark:active { background: #f0fdf4; }',
            '  .btn-mark-all { color: #fff; background: #16a34a; border-color: #16a34a; }',
            '',
            '  .handled-badge { display: inline-block; background: #e8e8e8; color: #888; font-size: 11px; padding: 2px 8px; border-radius: 4px; margin-left: 8px; font-weight: 400; }',
            '',
            '  .section-divider { font-size: 18px; font-weight: 700; margin: 32px 0 16px; padding-top: 24px; border-top: 2px solid #e8e8e8; }',
            '  .section-subtitle { font-size: 13px; color: #888; margin-bottom: 16px; font-weight: 400; }',
            '  .cluster-card { background: #fff; border: 1px solid #e0d4f5; border-radius: 10px; padding: 18px; margin-bottom: 14px; }',
            '  .cluster-count { font-size: 14px; color: #555; margin-bottom: 4px; }',
            '  .cluster-has-offer { font-size: 12px; color: #16a34a; margin-bottom: 12px; }',
            '',
            '  .empty-state { text-align: center; padding: 48px 16px; color: #aaa; font-size: 16px; }',
            '  .empty-state .check { font-size: 48px; margin-bottom: 12px; }',
            '',
            '  .footer { text-align: center; font-size: 11px; color: #bbb; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e8e8e8; }',
            '',
            '  @media (max-width: 480px) {',
            '    .container { padding: 20px 12px; }',
            '    .digest-header { flex-direction: column; align-items: flex-start; }',
            '    .match-card { padding: 14px; }',
            '  }',
            '</style>',
            '</head>',
            '<body>',
            '<div class="container">',
            '',
            '  <div class="digest-header">',
            '    <h1>Admin Digest &mdash; ' + unhandledCount + ' open match' + (unhandledCount !== 1 ? 'es' : '') + '</h1>',
            '    <div class="digest-actions">',
            '      ' + markAllBtn,
            '      <a class="btn" href="' + escHtml(toggleHref) + '">' + toggleLabel + '</a>',
            '    </div>',
            '  </div>',
            '',
            '  ' + cardsHtml,
            '',
            '  <div class="section-divider">\uD83D\uDE95 Going the Same Way &mdash; ' + clusters.length + ' cluster' + (clusters.length !== 1 ? 's' : '') + '</div>',
            '  <div class="section-subtitle">People heading the same direction who could share a cab or coordinate</div>',
            '  ' + clustersHtml,
            '',
            '  <div class="footer">Admin Digest &middot; v3.1</div>',
            '',
            '</div>',
            '<script>',
            '  var DIGEST_KEY = "' + KEY + '";',
            '',
            '  async function markHandled(matchId) {',
            '    var btn = event.target;',
            '    btn.disabled = true;',
            '    btn.textContent = "Marking...";',
            '    try {',
            '      var resp = await fetch("/digest/mark?key=" + DIGEST_KEY, {',
            '        method: "POST",',
            '        headers: { "Content-Type": "application/json" },',
            '        body: JSON.stringify({ matchId: matchId })',
            '      });',
            '      if (!resp.ok) throw new Error("Failed");',
            '      var card = document.getElementById("match-" + matchId);',
            '      card.classList.add("handled");',
            '      btn.textContent = "Handled";',
            '      updateCount(-1);',
            '    } catch (e) {',
            '      btn.disabled = false;',
            '      btn.textContent = "Mark Handled";',
            '    }',
            '  }',
            '',
            '  async function markAll() {',
            '    var cards = document.querySelectorAll(".match-card:not(.handled)");',
            '    var ids = [];',
            '    cards.forEach(function(c) { ids.push(c.id.replace("match-", "")); });',
            '    if (ids.length === 0) return;',
            '    if (!confirm("Mark all " + ids.length + " matches as handled?")) return;',
            '    try {',
            '      var resp = await fetch("/digest/mark?key=" + DIGEST_KEY, {',
            '        method: "POST",',
            '        headers: { "Content-Type": "application/json" },',
            '        body: JSON.stringify({ matchIds: ids })',
            '      });',
            '      if (!resp.ok) throw new Error("Failed");',
            '      cards.forEach(function(c) { c.classList.add("handled"); });',
            '      document.querySelectorAll(".btn-mark").forEach(function(b) { b.textContent = "Handled"; b.disabled = true; });',
            '      updateCount(-ids.length);',
            '    } catch (e) {',
            '      alert("Failed to mark all as handled");',
            '    }',
            '  }',
            '',
            '  function updateCount(delta) {',
            '    var h1 = document.querySelector(".digest-header h1");',
            '    var match = h1.textContent.match(/(\\d+)/);',
            '    if (match) {',
            '      var n = Math.max(0, parseInt(match[1]) + delta);',
            '      h1.textContent = "Admin Digest \\u2014 " + n + " open match" + (n !== 1 ? "es" : "");',
            '    }',
            '  }',
            '',
            '  setTimeout(function() { location.reload(); }, 5 * 60 * 1000);',
            '</script>',
            '</body>',
            '</html>'
        ].join('\n');

        res.send(html);
    } catch (err) {
        console.error('[Dashboard/Digest] Error:', err.message);
        res.status(500).send('Error loading digest');
    }
});

app.post('/digest/mark', async function(req, res) {
    if (!digestAuth(req, res)) return;

    try {
        var matchIds = req.body.matchIds || (req.body.matchId ? [req.body.matchId] : []);
        if (matchIds.length === 0) {
            return res.status(400).json({ error: 'No matchIds provided' });
        }
        await markNotified(matchIds);
        res.json({ success: true, marked: matchIds.length });
    } catch (err) {
        console.error('[Dashboard/Digest] Mark error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Start ─────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', function() {
    console.log('[Dashboard] v3.1 running at http://localhost:' + PORT);
});
