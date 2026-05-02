/**
 * Clusters homepage route: GET /clusters
 * Serves the clusters mockup with live Supabase data.
 */

var express = require('express');
var router = express.Router();
var { readClient } = require('../lib/supabase');
var { escHtml, formatDate, formatTime, formatMsgTime, fmtMsgTimeTz, fmtRideTimeTz, fmtRideDateTz, tzMeta, buildClusters, displayName, GA_TAG } = require('../lib/helpers');
var { filterActiveRequests, buildTestGroupSet } = require('../lib/dateFilter');
var { optionalAuth, getUserTier } = require('../middleware/auth');

// ── College Station is the hub ──────────────────────────────────────────
var CS = 'College Station';

// Scalloped verified badge (Material-style), green fill + white check
var VERIFIED_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="#25D366" d="M23 12l-2.44-2.78.34-3.68-3.61-.82-1.89-3.18L12 3 8.6 1.54 6.71 4.72l-3.61.82.34 3.68L1 12l2.44 2.78-.34 3.69 3.61.82 1.89 3.18L12 21l3.4 1.46 1.89-3.18 3.61-.82-.34-3.68L23 12zm-12.91 4.72l-3.8-3.81 1.41-1.41 2.39 2.38 5.66-5.66 1.41 1.41-7.07 7.09z"/></svg>';

function isLeaving(cluster) {
    var o = (cluster.origin || '').toLowerCase();
    return o === 'college station' || o === 'cstat' || o === 'bryan' || o === 'cs';
}

function isArriving(cluster) {
    var d = (cluster.destination || '').toLowerCase();
    return d === 'college station' || d === 'cstat' || d === 'bryan' || d === 'cs';
}

// Format a ride_plan_time value. Passes HH:MM through formatTime(),
// leaves fuzzy labels (e.g. "evening", "morning") as-is.
// tzPref + dateStr optional — when provided, will append parenthetical for non-CT viewers.
function fmtTime(t, tzPref, dateStr) {
    if (!t) return '';
    if (/^\d{1,2}:\d{2}$/.test(t)) {
        if (tzPref && tzPref !== 'CT') return fmtRideTimeTz(t, tzPref, dateStr);
        return formatTime(t);
    }
    return t;
}

function timeRange(members, tzPref, dateStr) {
    var times = [];
    for (var i = 0; i < members.length; i++) {
        if (members[i].ride_plan_time) times.push(members[i].ride_plan_time);
    }
    if (times.length === 0) return '';
    // Prefer a range of concrete HH:MM times; fall back to the first fuzzy label.
    var hhmm = times.filter(function(t) { return /^\d{1,2}:\d{2}$/.test(t); }).sort();
    if (hhmm.length > 0) {
        var first = fmtTime(hhmm[0], tzPref, dateStr);
        var last  = fmtTime(hhmm[hhmm.length - 1], tzPref, dateStr);
        return first === last ? first : first + ' &ndash; ' + last;
    }
    return times[0];
}

function clusterSummary(cluster, tier, tzPref) {
    var offers = cluster.offers;
    var needs = cluster.needs;
    if (offers.length > 0) {
        var o = offers[0];
        var name = tier >= 2 ? escHtml(displayName(o, true)) : escHtml(displayName(o, false) || 'Someone');
        var timeStr = o.ride_plan_time ? ' at ' + fmtTime(o.ride_plan_time, tzPref, o.ride_plan_date) : '';
        var seats = o.raw_message && o.raw_message.match(/(\d)\s*seat/i);
        var seatStr = seats ? ' with ' + seats[1] + ' seats' : '';
        if (needs.length > 0) {
            return '<strong>' + name + '</strong> is driving' + timeStr + seatStr +
                ' &mdash; ' + needs.length + ' rider' + (needs.length > 1 ? 's need' : ' needs') + ' this route';
        }
        return '<strong>' + name + '</strong> is driving' + timeStr + seatStr + ' &mdash; no riders yet';
    }
    return needs.length + ' rider' + (needs.length > 1 ? 's' : '') + ' headed this way &mdash; no driver yet';
}

function personHtml(req, tier, userPhone, verifiedSet, tzPref) {
    var isOffer = req.request_type === 'offer';
    var typeClass = isOffer ? 'offer' : 'need';
    var badge = isOffer ? '&#128663; Offering' : '&#9995; Looking';
    var name = tier >= 2 ? escHtml(displayName(req, true)) : escHtml(displayName(req, false) || 'Someone');
    var timeStr = req.ride_plan_time ? fmtTime(req.ride_plan_time, tzPref, req.ride_plan_date) : '&mdash;';
    var msg = escHtml(req.raw_message || '');
    var group = escHtml(req.source_group_name || req.source_group || '');
    var sent = req.created_at ? fmtMsgTimeTz(req.created_at, tzPref) : '';

    // Verified poster tick — show for T1+T2 whenever poster phone in user_profiles
    var verifiedTick = '';
    if (tier >= 1 && verifiedSet && req.source_contact) {
        var posterPhone = req.source_contact.replace(/\D/g, '');
        if (posterPhone && verifiedSet.has(posterPhone)) {
            verifiedTick = ' <span class="verified-tick" onclick="event.stopPropagation();showVerifiedTip(this)" title="Phone number verified">' + VERIFIED_SVG + '</span>';
        }
    }

    var yourPostBadge = '';
    if (tier >= 2 && userPhone && req.source_contact) {
        var reqPhone = req.source_contact.replace(/\D/g, '');
        if (reqPhone && reqPhone === userPhone) {
            yourPostBadge = '<span class="pill pill-your-post">&#11088; Your post</span>';
        }
    }

    var waBtn = '';
    if (tier === 1 && req.source_contact) {
        // T1 locked ghost button — same slot as T2 green button
        waBtn = '<a class="wa-contact-btn wa-locked" href="/verify/wa?returnTo=/" onclick="event.stopPropagation()">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
            'Verify to unlock DM' +
            '</a>';
    }
    if (tier >= 2 && req.source_contact) {
        var displayPhone = req.source_contact.replace(/\D/g, '');
        if (displayPhone) {
            var isOwnPost = userPhone && displayPhone === userPhone;
            if (!isOwnPost) {
                waBtn = '<a class="wa-contact-btn" href="https://wa.me/' + escHtml(displayPhone) + '" target="_blank" rel="noopener noreferrer" onclick="beaconJson(\'/log-click\',{phone:\'' + escHtml(displayPhone) + '\',page:\'clusters\',user_email:_userEmail})">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.852L0 24l6.335-1.507A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.807 9.807 0 01-5.032-1.384l-.361-.214-3.762.895.952-3.664-.235-.376A9.808 9.808 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/></svg>' +
                    'Message' +
                    '</a>';
            }
        }
    }

    var msgHtml = '';
    if (tier === 0) {
        msgHtml = '<div class="person-msg" style="filter:blur(5px);user-select:none;pointer-events:none;cursor:default;" aria-hidden="true">' +
            'Sign in with @tamu.edu to see the original message<br>' +
            'You need to be verified to access this data' +
            '</div>';
    } else if (msg) {
        msgHtml = '<div class="person-msg">&ldquo;' + msg + '&rdquo;</div>';
    }

    var metaHtml = '';
    if (tier > 0) {
        var metaText = (group ? 'via ' + group : '') + (sent ? ' &middot; sent ' + sent : '');
        metaHtml = '<div class="person-footer">' +
            '<div class="person-meta">' + metaText + '</div>' +
            waBtn +
            '</div>';
    } else {
        metaHtml = '<div class="person-meta">' + (sent ? 'sent ' + sent : '') + '</div>';
    }

    return '<div class="person-card ' + typeClass + '">' +
        '<div class="person-top">' +
            '<span class="type-badge ' + typeClass + '">' + badge + '</span>' +
            '<span class="person-name">' + name + verifiedTick + yourPostBadge + '</span>' +
            '<span class="person-depart">' + (req.ride_plan_time ? timeStr : '&mdash;') + '</span>' +
        '</div>' +
        msgHtml +
        metaHtml +
    '</div>';
}

function clusterHtml(cluster, direction, tier, userPhone, verifiedSet, tzPref) {
    var allMembers = cluster.offers.concat(cluster.needs);
    var from = escHtml(cluster.origin || '?');
    var to = escHtml(cluster.destination || '?');
    var offerCount = cluster.offers.length;
    var needCount = cluster.needs.length;
    var totalCount = allMembers.length;
    var tRange = timeRange(allMembers, tzPref, cluster.repDate);

    var metaPills = '';
    if (offerCount > 0) metaPills += '<span class="pill pill-offer">&#128663; ' + offerCount + ' offering</span>';
    if (needCount > 0) metaPills += '<span class="pill pill-need">&#9995; ' + needCount + ' looking</span>';
    if (offerCount === 0) metaPills += '<span class="pill pill-no-offer">No driver yet</span>';
    if (needCount === 0 && offerCount > 0) metaPills += '<span class="pill pill-signal">No riders yet</span>';
    if (tRange) metaPills += '<span class="cluster-time">' + tRange + '</span>';

    var personCards = '';
    // offers first, then needs
    for (var i = 0; i < cluster.offers.length; i++) personCards += personHtml(cluster.offers[i], tier, userPhone, verifiedSet, tzPref);
    for (var j = 0; j < cluster.needs.length; j++) personCards += personHtml(cluster.needs[j], tier, userPhone, verifiedSet, tzPref);

    var repDate = escHtml(cluster.repDate || '');
    return '<article class="cluster ' + direction + '" data-from="' + from + '" data-to="' + to + '" data-date="' + repDate + '" tabindex="0" role="button" aria-expanded="false">' +
        '<div class="cluster-head" onclick="toggleCluster(this.parentElement)">' +
            '<div class="cluster-info">' +
                '<div class="cluster-route">' + from + ' <span class="cluster-arrow">&rarr;</span> ' + to + '</div>' +
                '<div class="cluster-meta">' + metaPills + '</div>' +
                '<div class="cluster-summary">' + clusterSummary(cluster, tier, tzPref) + '</div>' +
                '<div class="expand-hint">Tap to see ' + totalCount + ' ' + (totalCount === 1 ? 'person' : 'people') + '</div>' +
            '</div>' +
            '<span class="cluster-chevron">&#9656;</span>' +
        '</div>' +
        '<div class="cluster-body"><div class="cluster-body-inner">' + personCards + '</div></div>' +
    '</article>';
}

router.get(['/clusters', '/'], optionalAuth, async function(req, res) {
    try {
        // ?tz=CT|ET|PT writes the cookie then redirects, stripping the param
        if (req.query.tz === 'CT' || req.query.tz === 'ET' || req.query.tz === 'PT') {
            res.cookie('tz_pref', req.query.tz, {
                path: '/', sameSite: 'lax', maxAge: 365 * 24 * 60 * 60 * 1000
            });
            var qs = Object.assign({}, req.query);
            delete qs.tz;
            var keys = Object.keys(qs);
            var tail = keys.length ? '?' + keys.map(function(k) { return encodeURIComponent(k) + '=' + encodeURIComponent(qs[k]); }).join('&') : '';
            return res.redirect(req.path + tail);
        }
        var tzPref = req.tzPref || 'CT';
        var tier = req.user ? req.user.tier : 0;
        var userPhone = req.user && req.user.phone ? req.user.phone.replace(/\D/g,'') : null;
        var userEmail = req.user ? req.user.email : '';
        var _now = new Date();
        var today = [_now.getFullYear(), String(_now.getMonth()+1).padStart(2,'0'), String(_now.getDate()).padStart(2,'0')].join('-');
        var cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

        var results = await Promise.all([
            readClient.from('v3_requests').select('*')
                .eq('request_category', 'ride')
                .or('ride_plan_date.gte.' + today + ',date_fuzzy.eq.true,ride_plan_date.is.null')
                .order('created_at', { ascending: false }),
            readClient.from('monitored_groups').select('group_id, group_name, is_test').eq('active', true),
            readClient.from('user_profiles').select('phone')
        ]);

        var verifiedSet = new Set((results[2].data || []).map(function(r) { return (r.phone || '').replace(/\D/g, ''); }).filter(Boolean));

        // Demo mode: ?demo=1 marks every poster verified for preview
        var demoMode = req.query.demo === '1';
        if (demoMode) {
            var rawForDemo = results[0].data || [];
            for (var vi = 0; vi < rawForDemo.length; vi++) {
                var p = (rawForDemo[vi].source_contact || '').replace(/\D/g, '');
                if (p) verifiedSet.add(p);
            }
        }

        var allGroups = results[1].data || [];
        var testGroupFilter = buildTestGroupSet(allGroups);
        var activeGroupCount = 0;
        for (var gi = 0; gi < allGroups.length; gi++) {
            if (!allGroups[gi].is_test) activeGroupCount++;
        }

        // Build group name lookup
        var groupNames = {};
        for (var gn = 0; gn < allGroups.length; gn++) {
            groupNames[allGroups[gn].group_id] = allGroups[gn].group_name || allGroups[gn].group_id;
        }

        var rawReqs = results[0].data || [];
        // attach group names
        for (var ri = 0; ri < rawReqs.length; ri++) {
            rawReqs[ri].source_group_name = groupNames[rawReqs[ri].source_group] || rawReqs[ri].source_group || '';
        }
        var allReqs = filterActiveRequests(rawReqs, { today: today, cutoff: cutoff, testGroups: testGroupFilter });

        var totalCount = allReqs.length;
        var clusters = buildClusters(allReqs, true);

        // Group clusters by date
        var byDate = {};
        for (var ci = 0; ci < clusters.length; ci++) {
            var dk = clusters[ci].repDate || 'flexible';
            if (!byDate[dk]) byDate[dk] = [];
            byDate[dk].push(clusters[ci]);
        }

        var sortedDates = Object.keys(byDate).sort(function(a, b) {
            if (a === 'flexible') return 1;
            if (b === 'flexible') return -1;
            return a.localeCompare(b);
        });

        // Collect all unique cities for filter pills
        var citySet = {};
        for (var ai = 0; ai < allReqs.length; ai++) {
            if (allReqs[ai].request_destination) citySet[allReqs[ai].request_destination] = true;
            if (allReqs[ai].request_origin) citySet[allReqs[ai].request_origin] = true;
        }
        var cities = Object.keys(citySet).sort();

        // Build filter pills HTML
        var toPills = '';
        var fromPills = '';
        var cityOptions = '';
        for (var fi = 0; fi < cities.length; fi++) {
            var c = escHtml(cities[fi]);
            toPills += '<span class="filter-pill" data-filter="to" data-city="' + c + '" onclick="toggleFilter(this)">' + c + '</span>';
            fromPills += '<span class="filter-pill" data-filter="from" data-city="' + c + '" onclick="toggleFilter(this)">' + c + '</span>';
            cityOptions += '<div class="city-option" data-city="' + c + '" onclick="toggleMobileCity(this)"><span class="city-name">' + c + '</span><span class="city-check"></span></div>';
        }

        // Build date blocks
        var dateBlocksHtml = '';
        for (var di = 0; di < sortedDates.length; di++) {
            var dateKey = sortedDates[di];
            var dateClusters = byDate[dateKey];
            var dateLabel = formatDate(dateKey === 'flexible' ? null : dateKey);
            var isToday = dateKey === today;

            // Split into leaving / arriving / other routes
            var leaving = [];
            var arriving = [];
            var others = [];
            for (var dci = 0; dci < dateClusters.length; dci++) {
                var cl = dateClusters[dci];
                if (isLeaving(cl) && !isArriving(cl)) {
                    leaving.push(cl);
                } else if (isArriving(cl) && !isLeaving(cl)) {
                    arriving.push(cl);
                } else {
                    others.push(cl);
                }
            }

            var leavingCount = 0, arrivingCount = 0, othersCount = 0;
            for (var pi = 0; pi < leaving.length; pi++) leavingCount += leaving[pi].offers.length + leaving[pi].needs.length;
            for (var pi = 0; pi < arriving.length; pi++) arrivingCount += arriving[pi].offers.length + arriving[pi].needs.length;
            for (var pi = 0; pi < others.length; pi++) othersCount += others[pi].offers.length + others[pi].needs.length;
            var summaryParts = [];
            if (leavingCount > 0) summaryParts.push(leavingCount + ' leaving');
            if (arrivingCount > 0) summaryParts.push(arrivingCount + ' arriving');
            if (othersCount > 0) summaryParts.push(othersCount + ' other');

            dateBlocksHtml += '<div class="date-block">';
            dateBlocksHtml += '<div class="date-label">' + escHtml(dateLabel) +
                (isToday ? ' <span class="today-badge">Today</span>' : '') +
                '<span class="date-summary">' + summaryParts.join(' &middot; ') + '</span></div>';

            var DIR_LEGEND = '<span class="dir-legend"><span class="verified-tick verified-tick-legend">' + VERIFIED_SVG + '</span>= phone verified</span>';
            function sectionHasVerified(cls) {
                for (var ii = 0; ii < cls.length; ii++) {
                    var mm = cls[ii].offers.concat(cls[ii].needs);
                    for (var jj = 0; jj < mm.length; jj++) {
                        var pp = (mm[jj].source_contact || '').replace(/\D/g, '');
                        if (pp && verifiedSet.has(pp)) return true;
                    }
                }
                return false;
            }
            if (leaving.length > 0) {
                dateBlocksHtml += '<div class="direction-label leaving">&#8593; Leaving College Station <span class="direction-count">(' + leavingCount + ')</span>' + (sectionHasVerified(leaving) ? DIR_LEGEND : '') + '</div>';
                for (var li = 0; li < leaving.length; li++) {
                    dateBlocksHtml += clusterHtml(leaving[li], 'leaving', tier, userPhone, verifiedSet, tzPref);
                }
            }

            if (arriving.length > 0) {
                dateBlocksHtml += '<div class="direction-label arriving">&#8595; Coming to College Station <span class="direction-count">(' + arrivingCount + ')</span>' + (sectionHasVerified(arriving) ? DIR_LEGEND : '') + '</div>';
                for (var ari = 0; ari < arriving.length; ari++) {
                    dateBlocksHtml += clusterHtml(arriving[ari], 'arriving', tier, userPhone, verifiedSet, tzPref);
                }
            }

            if (others.length > 0) {
                dateBlocksHtml += '<div class="direction-label others">&#8646; Other Routes <span class="direction-count">(' + othersCount + ')</span>' + (sectionHasVerified(others) ? DIR_LEGEND : '') + '</div>';
                for (var oi = 0; oi < others.length; oi++) {
                    dateBlocksHtml += clusterHtml(others[oi], 'other', tier, userPhone, verifiedSet, tzPref);
                }
            }

            dateBlocksHtml += '</div>';
        }

        if (sortedDates.length === 0) {
            dateBlocksHtml = '<div style="text-align:center;padding:40px 16px;color:#999;">No active ride requests right now.</div>';
        }

        var subtitle = 'Tracking <strong>' + totalCount + ' ride request' + (totalCount !== 1 ? 's' : '') +
            '</strong> across <strong>' + activeGroupCount + ' WhatsApp group' + (activeGroupCount !== 1 ? 's' : '') +
            '</strong> this week';

        res.send(PAGE_HTML(subtitle, toPills, fromPills, cityOptions, dateBlocksHtml, totalCount, activeGroupCount, tier, userEmail, userPhone, tzPref));
    } catch (err) {
        console.error('[Clusters] Error:', err);
        res.status(500).send('Internal error');
    }
});

function tzPillHtml(tzPref) {
    function opt(v, label) {
        return '<option value="' + v + '"' + (tzPref === v ? ' selected' : '') + '>' + label + '</option>';
    }
    return '<form method="get" action="" class="tz-pill" aria-label="Timezone preference">' +
        '<label>Times: </label>' +
        '<select name="tz" onchange="this.form.submit()">' +
            opt('CT', 'Central') + opt('ET', 'Eastern') + opt('PT', 'Pacific') +
        '</select></form>';
}

function tzFooterHtml(tzPref) {
    var label = (tzMeta(tzPref) || {}).label || 'Central';
    return '<div class="tz-footnote">Post times in ' + label + '. Ride times always in origin-city local.</div>';
}

function PAGE_HTML(subtitle, toPills, fromPills, cityOptions, dateBlocksHtml, totalCount, groupCount, tier, userEmail, userPhone, tzPref) {
    var authHtml;
    if (tier === 0) {
        authHtml = '<div class="auth-link"><a href="/login">Sign in with @tamu.edu</a> to see contact details</div>';
    } else if (tier === 1) {
        authHtml = '<div class="auth-link"><span class="auth-email-display">' + escHtml(userEmail || '') + '</span>' +
            ' &middot; <a href="/profile">My Profile</a>' +
            ' &middot; <a href="/logout">Sign out</a></div>';
    } else {
        authHtml = '<div class="auth-link"><span class="auth-email-display">' + escHtml(userEmail || '') + '</span>' +
            ' <span class="verified-badge">&#10003; WA Verified</span>' +
            ' &middot; <a href="/profile">My Profile</a>' +
            ' &middot; <a href="/logout">Sign out</a></div>';
    }

    var bannerHtml;
    if (tier === 0) {
        bannerHtml = '<div class="auth-banner anon" id="auth-banner">' +
            '<span>&#128274; Names are hidden. <a href="/login">Sign in with @tamu.edu</a> to get started.</span>' +
            '<button class="auth-banner-close" onclick="document.getElementById(\'auth-banner\').style.display=\'none\'" aria-label="Dismiss">&times;</button>' +
        '</div>';
    } else if (tier === 1) {
        bannerHtml = '<div class="auth-banner email-only" id="auth-banner">' +
            '<span>&#128241; Verify your WhatsApp number to see full names and contact info. <a href="/verify/wa?returnTo=/clusters">Verify now &rarr;</a></span>' +
            '<button class="auth-banner-close" onclick="document.getElementById(\'auth-banner\').style.display=\'none\'" aria-label="Dismiss">&times;</button>' +
        '</div>';
    } else {
        bannerHtml = '';
    }

    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
        GA_TAG + '\n' +
        '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
        '<title>Aggie Connect — Ride Clusters</title>\n' +
        '<style>\n' + CSS + '\n</style>\n</head>\n<body>\n' +
        '<div class="top-bar">' +
            '<div class="page-switch-btn-wrap"><a href="/housing" class="page-switch-btn" title="Browse housing listings">&#127968; Housing</a></div>' +
        '</div>\n' +
        '<div class="container">\n' +
        '<div class="hero"><h1>Aggie Connect</h1>' +
        '<p class="subtitle">' + subtitle + '</p>' +
        '<p class="tagline">Find someone going your way. Updated in real time from WhatsApp groups. <a href="/faq">FAQs &mdash; how, why, what?</a></p>' +
        '<p class="legend"><span class="verified-tick verified-tick-legend">' + VERIFIED_SVG + '</span> = Phone number verified</p>' +
        authHtml +
        '<div class="now-wrap">' +
            '<button type="button" class="now-pill" id="nowPill" data-tz="' + escHtml(tzPref) + '" aria-haspopup="true" aria-expanded="false" aria-label="Current time, click to change timezone"><span class="now-label">Now:</span> <span class="now-text-full" id="nowTextFull">--</span><span class="now-text-short" id="nowTextShort">--</span> <span class="now-caret">&#9660;</span></button>' +
            '<div class="now-menu" id="nowMenu" role="menu">' +
                '<div class="now-menu-item" role="menuitem" data-tz="CT"><span class="nm-zone">Central</span><span class="nm-time" data-tz-time="CT">--</span></div>' +
                '<div class="now-menu-item" role="menuitem" data-tz="ET"><span class="nm-zone">Eastern</span><span class="nm-time" data-tz-time="ET">--</span></div>' +
                '<div class="now-menu-item" role="menuitem" data-tz="PT"><span class="nm-zone">Pacific</span><span class="nm-time" data-tz-time="PT">--</span></div>' +
            '</div>' +
        '</div>' +
        '</div>\n' +
        bannerHtml +

        // Desktop filter bar
        '<div class="filter-bar" id="filterBar">' +
        '<div class="filter-row"><span class="filter-label">To</span>' + toPills +
        '<span class="filter-clear" onclick="clearFilters(\'to\')">clear</span>' +
        '<span class="filter-more" onclick="toggleFromRow()">+ From filter</span></div>' +
        '<div class="filter-row filter-row-from"><span class="filter-label">From</span>' + fromPills +
        '<span class="filter-clear" onclick="clearFilters(\'from\')">clear</span></div></div>\n' +

        // Mobile FAB
        '<div class="mobile-filter-fab" id="mobileFab" onclick="openSheet()">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>' +
        '<span class="fab-label" id="fabLabel">Filter by city</span></div>\n' +

        // Mobile bottom sheet
        '<div class="mobile-sheet-overlay" id="sheetOverlay" onclick="closeSheet()"></div>' +
        '<div class="mobile-sheet" id="mobileSheet">' +
        '<div class="mobile-sheet-handle"></div>' +
        '<div class="mobile-sheet-title">Where are you headed?</div>' +
        '<div class="city-list" id="cityList">' + cityOptions + '</div>' +
        '<button class="mobile-sheet-clear" id="mobileClear" onclick="clearMobileFilter()" style="display:none;">Clear filter</button></div>\n' +

        // Date blocks
        dateBlocksHtml +

        tzFooterHtml(tzPref) +
        '<div class="footer">' + totalCount + ' total requests &middot; ' + groupCount + ' groups monitored &middot; <a href="/faq">FAQ</a> &middot; <a href="/terms">Terms</a> &middot; v3.8</div>\n' +
        '</div>\n<script>var _userEmail=' + JSON.stringify(userEmail||'') + ';var _userPhone=' + JSON.stringify(userPhone||'') + ';</script>\n<script>\n' + JS + '\n</script>\n</body>\n</html>';
}

// ── CSS (from mockup) ───────────────────────────────────────────────────
var CSS = [
':root {',
'  --maroon: #500000; --maroon-light: #6b0000; --bg: #fafafa; --card: #fff;',
'  --border: #e5e5e5; --text: #1a1a1a; --text-secondary: #666; --text-muted: #999;',
'  --blue: #3b82f6; --blue-bg: #eff6ff; --green: #22c55e; --green-bg: #f0fdf4;',
'  --wa-green: #25D366; --radius: 12px; --radius-sm: 8px;',
'}',
'* { margin: 0; padding: 0; box-sizing: border-box; }',
'html, body { overflow-x: clip; }',
'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); line-height: 1.4; -webkit-font-smoothing: antialiased; }',
'.container { max-width: 640px; margin: 0 auto; padding: 16px 16px 40px; }',
'.hero { text-align: center; margin-bottom: 14px; }',
'.hero h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }',
'.hero .subtitle { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }',
'.hero .subtitle strong { color: var(--text); }',
'.hero .tagline { font-size: 13px; color: var(--text-muted); margin-top: 4px; }',
'.hero .tagline a { color: var(--maroon); text-decoration: none; }',
'.hero .tagline a:hover { text-decoration: underline; }',
'.auth-link { font-size: 12px; color: var(--text-muted); margin-top: 6px; }',
'.auth-link a { color: var(--maroon); text-decoration: none; font-weight: 600; }',
'.auth-link a:hover { text-decoration: underline; }',
'.auth-email-display { font-weight: 600; color: var(--text-secondary); }',
'.auth-banner { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 10px 14px; border-radius: var(--radius-sm); font-size: 12px; margin: 0 0 12px; display: flex; align-items: center; gap: 8px; line-height: 1.45; }',
'.auth-banner.anon { background: #fef3c7; border-color: #fde68a; color: #92400e; }',
'.auth-banner.email-only { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }',
'.auth-banner a { color: var(--maroon); font-weight: 700; text-decoration: none; }',
'.auth-banner.email-only a { color: #1d4ed8; }',
'.auth-banner a:hover { text-decoration: underline; }',
'.auth-banner-close { margin-left: auto; background: none; border: none; font-size: 20px; cursor: pointer; color: inherit; line-height: 1; padding: 0 4px; flex-shrink: 0; }',
'.verified-badge { display: inline-flex; align-items: center; gap: 3px; background: #f0fdf4; color: #15803d; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; border: 1px solid #bbf7d0; }',
'.verified-badge-pending { display: inline-flex; align-items: center; gap: 3px; background: #eff6ff; color: #1d4ed8; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; border: 1px solid #bfdbfe; text-decoration: none; }',
'.pill-your-post { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }',
'.filter-bar { position: sticky; top: 0; z-index: 18; background: var(--bg); padding: 10px 0; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 6px; }',
'.filter-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }',
'.filter-row-from { display: none; }',
'.filter-bar.show-from .filter-row-from { display: flex; }',
'.filter-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); min-width: 36px; flex-shrink: 0; }',
'.filter-pill { display: inline-block; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 99px; border: 1px solid var(--border); background: var(--card); color: var(--text-secondary); cursor: pointer; user-select: none; transition: all 0.15s ease; -webkit-tap-highlight-color: transparent; }',
'.filter-pill:active { transform: scale(0.96); }',
'.filter-pill.active { background: var(--maroon); color: #fff; border-color: var(--maroon); }',
'.filter-clear { font-size: 11px; color: var(--text-muted); cursor: pointer; margin-left: 4px; text-decoration: underline; text-underline-offset: 2px; }',
'.filter-clear:hover { color: var(--text-secondary); }',
'.filter-more { font-size: 11px; color: var(--text-muted); cursor: pointer; margin-left: 4px; text-decoration: underline; text-underline-offset: 2px; }',
'.filter-more:hover { color: var(--text-secondary); }',
'.mobile-filter-fab { display: none; position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 100; background: var(--card); border: 1px solid var(--border); border-radius: 99px; padding: 10px 20px; font-size: 14px; font-weight: 600; color: var(--text); cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.12); -webkit-tap-highlight-color: transparent; gap: 8px; align-items: center; max-width: calc(100vw - 32px); white-space: nowrap; }',
'.mobile-filter-fab svg { width: 16px; height: 16px; flex-shrink: 0; color: var(--text-muted); }',
'.mobile-filter-fab .fab-label { color: var(--text-muted); }',
'.mobile-filter-fab.has-filters .fab-label { color: var(--maroon); font-weight: 700; }',
'.mobile-sheet-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 200; }',
'.mobile-sheet-overlay.open { display: block; }',
'.mobile-sheet { position: fixed; bottom: 0; left: 0; right: 0; z-index: 201; background: var(--card); border-radius: 16px 16px 0 0; padding: 16px 16px 32px; transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); max-height: 60vh; overflow-y: auto; }',
'.mobile-sheet.open { transform: translateY(0); }',
'.mobile-sheet-handle { width: 36px; height: 4px; border-radius: 2px; background: #ddd; margin: 0 auto 16px; }',
'.mobile-sheet-title { font-size: 15px; font-weight: 700; margin-bottom: 12px; }',
'.mobile-sheet .filter-row { margin-bottom: 12px; }',
'.mobile-sheet .filter-pill { font-size: 14px; padding: 8px 16px; }',
'.mobile-sheet .filter-label { font-size: 12px; min-width: 40px; }',
'.mobile-sheet .filter-clear { font-size: 12px; }',
'.mobile-sheet-done { display: block; width: 100%; padding: 12px; margin-top: 8px; border: none; border-radius: var(--radius-sm); background: var(--maroon); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; }',
'.mobile-sheet-done:active { background: var(--maroon-light); }',
'.mobile-sheet-clear { display: block; width: 100%; padding: 12px; margin-top: 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--card); color: var(--text-secondary); font-size: 14px; font-weight: 600; cursor: pointer; }',
'.mobile-sheet-clear:active { background: #f5f5f5; }',
'.city-list { display: flex; flex-direction: column; }',
'.city-option { display: flex; align-items: center; justify-content: space-between; padding: 14px 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer; border-radius: 8px; transition: background 0.1s; }',
'.city-option:last-child { border-bottom: none; }',
'.city-option:active { background: #f5f5f5; }',
'.city-option.selected { background: #fef2f2; }',
".city-option.selected .city-check::after { content: '\\2713'; color: var(--maroon); font-weight: 700; font-size: 16px; }",
'.city-name { font-size: 16px; font-weight: 500; color: var(--text); }',
'.city-option.selected .city-name { font-weight: 700; color: var(--maroon); }',
'.date-block { margin-bottom: 20px; }',
'.date-label { font-size: 15px; font-weight: 700; color: var(--text); padding: 10px 12px; display: flex; align-items: center; gap: 8px; position: sticky; top: var(--sticky-date-top, 76px); z-index: 16; background: #f3f3f3; margin: 0 0 8px; border-bottom: 1px solid var(--border); box-shadow: 0 2px 0 0 var(--bg); }',
'.today-badge { display: inline-block; background: #dcfce7; color: #16a34a; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; }',
'.date-summary { margin-left: auto; font-size: 11px; font-weight: 500; color: var(--text-muted); white-space: nowrap; }',
'.direction-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 8px 12px; margin: 0 0 8px; display: flex; align-items: center; gap: 6px; position: sticky; top: var(--sticky-dir-top, 120px); z-index: 14; box-shadow: 0 2px 0 0 var(--bg); }',
'.dir-legend { margin-left: auto; display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 600; text-transform: none; letter-spacing: 0; color: var(--text-muted); opacity: 0.85; }',
'.dir-legend .verified-tick { margin: 0 2px 0 0; }',
'.direction-label.leaving { color: #1d4ed8; background: #eff6ff; border-top: 1px solid #dbeafe; border-bottom: 1px solid #dbeafe; }',
'.direction-label.arriving { color: #15803d; background: #f0fdf4; border-top: 1px solid #dcfce7; border-bottom: 1px solid #dcfce7; }',
'.direction-label.others { color: #92400e; background: #fffbeb; border-top: 1px solid #fde68a; border-bottom: 1px solid #fde68a; }',
'.direction-count { font-weight: 400; opacity: 0.7; }',
'.cluster { border: 1px solid var(--border); border-radius: var(--radius); background: var(--card); overflow: hidden; margin-bottom: 10px; transition: box-shadow 0.15s; }',
'.cluster:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }',
'.cluster.leaving { border-left: 3px solid var(--blue); }',
'.cluster.arriving { border-left: 3px solid var(--green); }',
'.cluster.other { border-left: 3px solid #f59e0b; }',
'.cluster-head { display: flex; align-items: center; padding: 12px 14px; cursor: pointer; user-select: none; gap: 12px; background: #fafaf8; border-bottom: 1px solid var(--border); }',
'.cluster-head:active { background: #f0f0ee; }',
'.cluster-info { flex: 1; min-width: 0; }',
'.cluster-route { font-size: 15px; font-weight: 700; color: var(--text); }',
'.cluster-arrow { color: var(--text-muted); margin: 0 2px; }',
'.cluster-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 3px; }',
'.pill { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 99px; }',
'.pill-offer { background: #dbeafe; color: #1d4ed8; }',
'.pill-need { background: #fef3c7; color: #92400e; }',
'.pill-no-offer { background: #fef3c7; color: #b45309; }',
'.pill-signal { background: #fff8e7; color: #7a5b00; border: 1px solid #f1dfab; }',
'.cluster-time { font-size: 12px; font-weight: 600; color: var(--text-secondary); white-space: nowrap; }',
'.cluster-summary { font-size: 12px; color: var(--text-secondary); margin-top: 4px; line-height: 1.35; }',
'.cluster-summary strong { color: var(--text); font-weight: 600; }',
'.expand-hint { font-size: 11px; color: var(--text-muted); margin-top: 2px; }',
'.cluster.open .expand-hint { display: none; }',
'.cluster-chevron { font-size: 18px; color: #888; flex-shrink: 0; transition: transform 0.2s ease; width: 24px; text-align: center; }',
'.cluster.open .cluster-chevron { transform: rotate(90deg); }',
'.cluster-body { max-height: 0; overflow: hidden; transition: max-height 0.3s ease; border-top: 0 solid var(--border); }',
'.cluster.open .cluster-body { max-height: 800px; border-top-width: 1px; }',
'.person-card { padding: 10px 14px; border-top: 1px solid var(--border); font-size: 13px; }',
'.person-card.offer { background: #fafcff; }',
'.person-card.need { background: var(--card); }',
'.person-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }',
'.type-badge { font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.02em; }',
'.type-badge.offer { background: #dbeafe; color: #1d4ed8; }',
'.type-badge.need { background: #fef3c7; color: #92400e; }',
'.person-name { font-size: 14px; font-weight: 600; color: var(--text); }',
'.person-depart { margin-left: auto; font-size: 12px; font-weight: 600; color: var(--text-secondary); white-space: nowrap; }',
'.person-msg { font-size: 13px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4; }',
'.person-meta { font-size: 11px; color: var(--text-muted); margin-top: 3px; }',
'.person-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px; }',
'.person-footer .person-meta { margin-top: 0; }',
'.wa-contact-btn { display: inline-flex; align-items: center; gap: 5px; background: #25D366; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 99px; text-decoration: none; white-space: nowrap; flex-shrink: 0; transition: background 0.15s; }',
'.wa-contact-btn:hover { background: #1da851; }',
'.wa-contact-btn svg { flex-shrink: 0; }',
'.wa-contact-btn.wa-locked { background: transparent; color: var(--maroon); border: 1px dashed #c8a4a4; font-weight: 600; }',
'.wa-contact-btn.wa-locked:hover { background: #fdf5f5; border-color: var(--maroon); }',
'.verified-tick { display: inline-flex; align-items: center; justify-content: center; margin-left: 3px; cursor: pointer; vertical-align: -2px; line-height: 0; }',
'.verified-tick svg { display: block; }',
'.verified-tick.verified-tick-legend { margin: 0 2px; cursor: default; }',
'.legend { font-size: 11px; color: var(--text-muted); margin-top: 4px; }',
'.verified-tip { position: absolute; background: #111; color: #fff; font-size: 11px; font-weight: 600; padding: 6px 10px; border-radius: 6px; z-index: 500; pointer-events: none; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }',
'.verified-tip::after { content: ""; position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 4px solid #111; }',
'.top-bar { position: absolute; top: 8px; right: 8px; z-index: 300; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end; max-width: calc(100vw - 16px); }',
'.tz-pill-wrap, .page-switch-btn-wrap, .now-pill-wrap { display: inline-flex; }',
'.tz-pill { display: inline-flex; align-items: center; gap: 4px; background: #fff; border: 1px solid #e5e5e5; color: #666; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 99px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }',
'.tz-pill label { color: #999; font-weight: 500; cursor: default; }',
'.tz-pill select { border: none; background: transparent; font: inherit; color: #1a1a1a; cursor: pointer; padding: 0 2px; outline: none; }',
'.now-wrap { position: relative; display: inline-flex; margin: 6px 0; }',
'.now-pill { display: inline-flex; align-items: center; gap: 6px; background: #fff; border: 1px solid #e5e5e5; color: #444; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 99px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); white-space: nowrap; cursor: pointer; user-select: none; transition: border-color 0.15s, box-shadow 0.15s; font: inherit; }',
'.now-pill:hover { border-color: #b3b3b3; box-shadow: 0 3px 12px rgba(0,0,0,0.12); }',
'.now-pill[aria-expanded="true"] { border-color: #888; }',
'.now-pill .now-label { color: #999; font-weight: 500; }',
'.now-pill .now-caret { color: #bbb; font-size: 9px; margin-left: 2px; transition: transform 0.15s; }',
'.now-text-short { display: none; }',
'.now-text-full { display: inline; }',
'.now-pill[aria-expanded="true"] .now-caret { transform: rotate(180deg); }',
'.now-menu { position: absolute; top: calc(100% + 6px); left: 0; background: #fff; border: 1px solid #e5e5e5; border-radius: 10px; box-shadow: 0 6px 20px rgba(0,0,0,0.12); padding: 4px; min-width: 220px; z-index: 400; display: none; }',
'.now-menu.open { display: block; }',
'.now-menu-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; border-radius: 7px; cursor: pointer; font-size: 12px; color: #333; }',
'.now-menu-item:hover { background: #f5f5f5; }',
'.now-menu-item .nm-zone { font-weight: 600; }',
'.now-menu-item .nm-time { color: #666; font-variant-numeric: tabular-nums; }',
'.now-menu-item.selected { background: #f0f4ff; }',
'.now-menu-item.selected .nm-zone::before { content: "\\2713 "; color: #2563eb; }',
'.now-menu-item.selected .nm-zone { color: #1e40af; }',
'.tz-footnote { text-align: center; font-size: 11px; color: #999; margin: 24px 0 0; padding: 0 12px; }',
'.page-switch-btn { display: inline-flex; align-items: center; gap: 5px; background: var(--card); border: 1px solid var(--border); color: var(--text-secondary); font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 99px; text-decoration: none; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: box-shadow 0.15s, border-color 0.15s; white-space: nowrap; }',
'.page-switch-btn:hover { border-color: #ccc; box-shadow: 0 3px 12px rgba(0,0,0,0.12); color: var(--text); }',
'.footer { text-align: center; padding: 16px 0; font-size: 11px; color: #ccc; border-top: 1px solid #eee; margin-top: 20px; }',
'.footer a { color: #aaa; text-decoration: none; }',
'.footer a:hover { text-decoration: underline; }',
'@media (max-width: 700px) {',
'  .container { padding: 8px 8px 32px; }',
'  .top-bar { right: 6px; top: 6px; gap: 4px; }',
'  .now-pill, .page-switch-btn { font-size: 11px; padding: 3px 8px; }',
'  .now-text-full { display: none; }',
'  .now-text-short { display: inline; }',
'  .hero h1 { font-size: 18px; }',
'  .hero .tagline { display: none; }',
'  .hero { margin-bottom: 8px; }',
'  .filter-bar { display: none; }',
'  .mobile-filter-fab { display: flex; }',
'  .container { padding-bottom: 80px; }',
'  .date-label { font-size: 13px; padding: 8px 10px; margin: 0 0 8px; top: 0; }',
'  .direction-label { margin: 0 0 8px; }',
'  .cluster-head { padding: 10px 12px; gap: 8px; }',
'  .cluster-route { font-size: 14px; }',
'  .person-card { padding: 10px 12px; }',
'  .person-name { font-size: 13px; }',
'  .person-msg { font-size: 12px; }',
'  .person-sent { display: none; }',
'}'
].join('\n');

// ── JS (from mockup) ───────────────────────────────────────────────────
var JS = [
'function beaconJson(url,data){navigator.sendBeacon(url,new Blob([JSON.stringify(data)],{type:"application/json"}));}',
'function showVerifiedTip(el){var existing=document.querySelector(".verified-tip");if(existing)existing.remove();var tip=document.createElement("div");tip.className="verified-tip";tip.textContent="Phone number verified";document.body.appendChild(tip);var r=el.getBoundingClientRect();tip.style.left=(r.left+window.scrollX+r.width/2-tip.offsetWidth/2)+"px";tip.style.top=(r.top+window.scrollY-tip.offsetHeight-6)+"px";setTimeout(function(){if(tip.parentNode)tip.remove();},1800);}',
'function toggleCluster(el) { el.classList.toggle("open"); el.setAttribute("aria-expanded", el.classList.contains("open")); if (el.classList.contains("open")) { beaconJson("/log-expand",{page:"clusters",origin:el.getAttribute("data-from"),destination:el.getAttribute("data-to"),ride_date:el.getAttribute("data-date"),user_email:_userEmail,phone:_userPhone}); } }',
'var activeFilters = { from: new Set(), to: new Set() };',
'function toggleFilter(pill) { var type = pill.getAttribute("data-filter"); var city = pill.getAttribute("data-city"); if (activeFilters[type].has(city)) { activeFilters[type].delete(city); } else { activeFilters[type].add(city); } syncPills(); applyFilters(); updateFab(); }',
'function clearFilters(type) { activeFilters[type].clear(); syncPills(); applyFilters(); updateFab(); }',
'function syncPills() { document.querySelectorAll(".filter-pill").forEach(function(pill) { var type = pill.getAttribute("data-filter"); var city = pill.getAttribute("data-city"); pill.classList.toggle("active", activeFilters[type].has(city)); }); }',
'function applyFilters() {',
'  var clusters = document.querySelectorAll(".cluster");',
'  var fromActive = activeFilters.from.size > 0;',
'  var toActive = activeFilters.to.size > 0;',
'  clusters.forEach(function(cluster) {',
'    var from = cluster.getAttribute("data-from");',
'    var to = cluster.getAttribute("data-to");',
'    var fromMatch = !fromActive || activeFilters.from.has(from);',
'    var toMatch = !toActive || activeFilters.to.has(to);',
'    cluster.style.display = (fromMatch && toMatch) ? "" : "none";',
'  });',
'  document.querySelectorAll(".direction-label").forEach(function(label) {',
'    var sibling = label.nextElementSibling; var visibleCount = 0;',
'    while (sibling && sibling.classList.contains("cluster")) { if (sibling.style.display !== "none") visibleCount++; sibling = sibling.nextElementSibling; }',
'    var countSpan = label.querySelector(".direction-count"); if (countSpan) countSpan.textContent = "(" + visibleCount + ")";',
'    label.style.display = visibleCount > 0 ? "" : "none";',
'  });',
'  document.querySelectorAll(".date-block").forEach(function(block) {',
'    var visLeav = 0, visArr = 0, visOth = 0;',
'    block.querySelectorAll(".cluster").forEach(function(c) {',
'      if (c.style.display === "none") return;',
'      if (c.classList.contains("leaving")) visLeav++;',
'      else if (c.classList.contains("arriving")) visArr++;',
'      else if (c.classList.contains("other")) visOth++;',
'    });',
'    var summary = block.querySelector(".date-summary");',
'    if (summary) {',
'      var parts = [];',
'      if (visLeav > 0) parts.push(visLeav + " leaving");',
'      if (visArr > 0) parts.push(visArr + " arriving");',
'      if (visOth > 0) parts.push(visOth + " other");',
'      summary.textContent = parts.join(" \\u00b7 ");',
'    }',
'    var anyVisible = block.querySelector(".cluster:not([style*=\\"display: none\\"])");',
'    block.style.display = anyVisible ? "" : "none";',
'  });',
'}',
'function toggleFromRow() { var bar = document.getElementById("filterBar"); bar.classList.toggle("show-from"); var link = bar.querySelector(".filter-more"); link.textContent = bar.classList.contains("show-from") ? "- Hide from" : "+ From filter"; setStickyOffsets(); }',
'function openSheet() { syncCityList(); document.getElementById("sheetOverlay").classList.add("open"); document.getElementById("mobileSheet").classList.add("open"); document.body.style.overflow = "hidden"; }',
'function closeSheet() { document.getElementById("sheetOverlay").classList.remove("open"); document.getElementById("mobileSheet").classList.remove("open"); document.body.style.overflow = ""; }',
'function toggleMobileCity(el) { var city = el.getAttribute("data-city"); if (activeFilters.to.has(city)) { activeFilters.to.delete(city); } else { activeFilters.to.add(city); } syncPills(); syncCityList(); applyFilters(); updateFab(); if (activeFilters.to.size === 1) { setTimeout(closeSheet, 150); } }',
'function clearMobileFilter() { activeFilters.to.clear(); syncPills(); syncCityList(); applyFilters(); updateFab(); setTimeout(closeSheet, 150); }',
'function syncCityList() { document.querySelectorAll(".city-option").forEach(function(opt) { var city = opt.getAttribute("data-city"); opt.classList.toggle("selected", activeFilters.to.has(city)); }); var clearBtn = document.getElementById("mobileClear"); if (clearBtn) clearBtn.style.display = activeFilters.to.size > 0 ? "block" : "none"; }',
'function updateFab() { var fab = document.getElementById("mobileFab"); var label = document.getElementById("fabLabel"); var toCities = Array.from(activeFilters.to); if (toCities.length) { label.textContent = toCities.join(", "); fab.classList.add("has-filters"); } else { label.textContent = "Filter by city"; fab.classList.remove("has-filters"); } }',
'function setStickyOffsets() {',
'  var filterBar = document.getElementById("filterBar");',
'  if (!filterBar || filterBar.offsetHeight === 0) {',
'    document.documentElement.style.setProperty("--sticky-date-top", "0px");',
'    document.documentElement.style.setProperty("--sticky-dir-top", "0px");',
'    var dl = document.querySelector(".date-label"); if (dl) document.documentElement.style.setProperty("--sticky-dir-top", dl.offsetHeight + "px");',
'    return;',
'  }',
'  var filterH = filterBar.offsetHeight;',
'  var dateLabels = document.querySelectorAll(".date-label");',
'  var dateLabelH = dateLabels.length ? dateLabels[0].offsetHeight : 0;',
'  document.documentElement.style.setProperty("--sticky-date-top", filterH + "px");',
'  document.documentElement.style.setProperty("--sticky-dir-top", (filterH + dateLabelH) + "px");',
'}',
'setStickyOffsets();',
'window.addEventListener("resize", setStickyOffsets);',
'var TZ_MAP={CT:"America/Chicago",ET:"America/New_York",PT:"America/Los_Angeles"};',
'function fmtNow(iana,full){var opts=full?{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:iana,timeZoneName:"short"}:{hour:"numeric",minute:"2-digit",timeZone:iana,timeZoneName:"short"};return new Intl.DateTimeFormat("en-US",opts).format(new Date());}',
'function tickNowClock(){var el=document.getElementById("nowPill");if(!el)return;var pref=el.getAttribute("data-tz")||"CT";var iana=TZ_MAP[pref]||TZ_MAP.CT;var f=document.getElementById("nowTextFull");if(f)f.textContent=fmtNow(iana,true);var s=document.getElementById("nowTextShort");if(s)s.textContent=fmtNow(iana,false);var items=document.querySelectorAll("[data-tz-time]");for(var i=0;i<items.length;i++){var z=items[i].getAttribute("data-tz-time");items[i].textContent=fmtNow(TZ_MAP[z]||TZ_MAP.CT,false);}}',
'tickNowClock();',
'setInterval(tickNowClock,30000);',
'(function(){var btn=document.getElementById("nowPill");var menu=document.getElementById("nowMenu");if(!btn||!menu)return;var cur=btn.getAttribute("data-tz")||"CT";var items=menu.querySelectorAll(".now-menu-item");for(var i=0;i<items.length;i++){if(items[i].getAttribute("data-tz")===cur)items[i].classList.add("selected");}function close(){menu.classList.remove("open");btn.setAttribute("aria-expanded","false");}function open(){menu.classList.add("open");btn.setAttribute("aria-expanded","true");}btn.addEventListener("click",function(e){e.stopPropagation();menu.classList.contains("open")?close():open();});items.forEach(function(it){it.addEventListener("click",function(){var z=it.getAttribute("data-tz");var u=new URL(window.location.href);u.searchParams.set("tz",z);window.location.href=u.toString();});});document.addEventListener("click",function(e){if(!menu.contains(e.target)&&e.target!==btn)close();});document.addEventListener("keydown",function(e){if(e.key==="Escape")close();});})();'
].join('\n');

module.exports = router;
