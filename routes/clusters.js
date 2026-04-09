/**
 * Clusters homepage route: GET /clusters
 * Serves the clusters mockup with live Supabase data.
 */

var express = require('express');
var router = express.Router();
var { readClient } = require('../lib/supabase');
var { escHtml, formatDate, formatTime, formatMsgTime, buildClusters, displayName } = require('../lib/helpers');
var { filterActiveRequests, buildTestGroupSet } = require('../lib/dateFilter');
var { optionalAuth } = require('../middleware/auth');

// ── College Station is the hub ──────────────────────────────────────────
var CS = 'College Station';

function isLeaving(cluster) {
    var o = (cluster.origin || '').toLowerCase();
    return o === 'college station' || o === 'cstat' || o === 'bryan' || o === 'cs';
}

// Format a ride_plan_time value. Passes HH:MM through formatTime(),
// leaves fuzzy labels (e.g. "evening", "morning") as-is.
function fmtTime(t) {
    if (!t) return '';
    if (/^\d{1,2}:\d{2}$/.test(t)) return formatTime(t);
    return t;
}

function timeRange(members) {
    var times = [];
    for (var i = 0; i < members.length; i++) {
        if (members[i].ride_plan_time) times.push(members[i].ride_plan_time);
    }
    if (times.length === 0) return '';
    // Prefer a range of concrete HH:MM times; fall back to the first fuzzy label.
    var hhmm = times.filter(function(t) { return /^\d{1,2}:\d{2}$/.test(t); }).sort();
    if (hhmm.length > 0) {
        var first = formatTime(hhmm[0]);
        var last = formatTime(hhmm[hhmm.length - 1]);
        return first === last ? first : first + ' &ndash; ' + last;
    }
    return times[0];
}

function clusterSummary(cluster, isLoggedIn) {
    var offers = cluster.offers;
    var needs = cluster.needs;
    if (offers.length > 0) {
        var o = offers[0];
        var name = escHtml(displayName(o, isLoggedIn));
        var timeStr = o.ride_plan_time ? ' at ' + fmtTime(o.ride_plan_time) : '';
        var seats = o.original_message && o.original_message.match(/(\d)\s*seat/i);
        var seatStr = seats ? ' with ' + seats[1] + ' seats' : '';
        if (needs.length > 0) {
            return '<strong>' + name + '</strong> is driving' + timeStr + seatStr +
                ' &mdash; ' + needs.length + ' rider' + (needs.length > 1 ? 's need' : ' needs') + ' this route';
        }
        return '<strong>' + name + '</strong> is driving' + timeStr + seatStr + ' &mdash; no riders yet';
    }
    return needs.length + ' rider' + (needs.length > 1 ? 's' : '') + ' headed this way &mdash; no driver yet';
}

function personHtml(req, isLoggedIn) {
    var isOffer = req.request_type === 'offer';
    var typeClass = isOffer ? 'offer' : 'need';
    var badge = isOffer ? '&#128663; Offering' : '&#9995; Looking';
    var name = escHtml(displayName(req, isLoggedIn));
    var timeStr = req.ride_plan_time ? fmtTime(req.ride_plan_time) : '&mdash;';
    var msg = escHtml(req.original_message || '');
    var group = escHtml(req.source_group_name || req.source_group || '');
    var sent = req.created_at ? formatMsgTime(req.created_at) : '';

    return '<div class="person-card ' + typeClass + '">' +
        '<div class="person-top">' +
            '<span class="type-badge ' + typeClass + '">' + badge + '</span>' +
            '<span class="person-name">' + name + '</span>' +
            '<span class="person-depart">' + (req.ride_plan_time ? timeStr : '&mdash;') + '</span>' +
        '</div>' +
        (msg ? '<div class="person-msg">"' + msg + '"</div>' : '') +
        '<div class="person-meta">via ' + group + (sent ? ' &middot; sent ' + sent : '') + '</div>' +
    '</div>';
}

function clusterHtml(cluster, direction, isLoggedIn) {
    var allMembers = cluster.offers.concat(cluster.needs);
    var from = escHtml(cluster.origin || '?');
    var to = escHtml(cluster.destination || '?');
    var offerCount = cluster.offers.length;
    var needCount = cluster.needs.length;
    var totalCount = allMembers.length;
    var tRange = timeRange(allMembers);

    var metaPills = '';
    if (offerCount > 0) metaPills += '<span class="pill pill-offer">&#128663; ' + offerCount + ' offering</span>';
    if (needCount > 0) metaPills += '<span class="pill pill-need">&#9995; ' + needCount + ' looking</span>';
    if (offerCount === 0) metaPills += '<span class="pill pill-no-offer">No driver yet</span>';
    if (needCount === 0 && offerCount > 0) metaPills += '<span class="pill pill-signal">No riders yet</span>';
    if (tRange) metaPills += '<span class="cluster-time">' + tRange + '</span>';

    var personCards = '';
    // offers first, then needs
    for (var i = 0; i < cluster.offers.length; i++) personCards += personHtml(cluster.offers[i], isLoggedIn);
    for (var j = 0; j < cluster.needs.length; j++) personCards += personHtml(cluster.needs[j], isLoggedIn);

    return '<article class="cluster ' + direction + '" data-from="' + from + '" data-to="' + to + '" tabindex="0" role="button" aria-expanded="false">' +
        '<div class="cluster-head" onclick="toggleCluster(this.parentElement)">' +
            '<div class="cluster-info">' +
                '<div class="cluster-route">' + from + ' <span class="cluster-arrow">&rarr;</span> ' + to + '</div>' +
                '<div class="cluster-meta">' + metaPills + '</div>' +
                '<div class="cluster-summary">' + clusterSummary(cluster, isLoggedIn) + '</div>' +
                '<div class="expand-hint">Tap to see ' + totalCount + ' ' + (totalCount === 1 ? 'person' : 'people') + '</div>' +
            '</div>' +
            '<span class="cluster-chevron">&#9656;</span>' +
        '</div>' +
        '<div class="cluster-body"><div class="cluster-body-inner">' + personCards + '</div></div>' +
    '</article>';
}

router.get('/clusters', optionalAuth, async function(req, res) {
    try {
        var isLoggedIn = !!req.user;
        var userEmail = req.user ? req.user.email : '';
        var today = new Date().toISOString().split('T')[0];
        var cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

        var results = await Promise.all([
            readClient.from('v3_requests').select('*')
                .eq('request_category', 'ride')
                .or('ride_plan_date.gte.' + today + ',date_fuzzy.eq.true,ride_plan_date.is.null')
                .order('created_at', { ascending: false }),
            readClient.from('monitored_groups').select('group_id, group_name, is_test').eq('active', true)
        ]);

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

            // Split into leaving / arriving CS
            var leaving = [];
            var arriving = [];
            for (var dci = 0; dci < dateClusters.length; dci++) {
                if (isLeaving(dateClusters[dci])) {
                    leaving.push(dateClusters[dci]);
                } else {
                    arriving.push(dateClusters[dci]);
                }
            }

            var leavingCount = leaving.length;
            var arrivingCount = arriving.length;
            var summaryParts = [];
            if (leavingCount > 0) summaryParts.push(leavingCount + ' leaving');
            if (arrivingCount > 0) summaryParts.push(arrivingCount + ' arriving');

            dateBlocksHtml += '<div class="date-block">';
            dateBlocksHtml += '<div class="date-label">' + escHtml(dateLabel) +
                (isToday ? ' <span class="today-badge">Today</span>' : '') +
                '<span class="date-summary">' + summaryParts.join(' &middot; ') + '</span></div>';

            if (leaving.length > 0) {
                dateBlocksHtml += '<div class="direction-label leaving">&#8593; Leaving College Station <span class="direction-count">(' + leavingCount + ')</span></div>';
                for (var li = 0; li < leaving.length; li++) {
                    dateBlocksHtml += clusterHtml(leaving[li], 'leaving', isLoggedIn);
                }
            }

            if (arriving.length > 0) {
                dateBlocksHtml += '<div class="direction-label arriving">&#8595; Coming to College Station <span class="direction-count">(' + arrivingCount + ')</span></div>';
                for (var ari = 0; ari < arriving.length; ari++) {
                    dateBlocksHtml += clusterHtml(arriving[ari], 'arriving', isLoggedIn);
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

        res.send(PAGE_HTML(subtitle, toPills, fromPills, cityOptions, dateBlocksHtml, totalCount, activeGroupCount, isLoggedIn, userEmail));
    } catch (err) {
        console.error('[Clusters] Error:', err);
        res.status(500).send('Internal error');
    }
});

function PAGE_HTML(subtitle, toPills, fromPills, cityOptions, dateBlocksHtml, totalCount, groupCount, isLoggedIn, userEmail) {
    var authHtml = isLoggedIn
        ? '<div class="auth-link"><span class="auth-email-display">' + escHtml(userEmail) + '</span> &middot; <a href="/logout">Sign out</a></div>'
        : '<div class="auth-link"><a href="/login">Sign in with @tamu.edu</a> to see full names</div>';

    var bannerHtml = isLoggedIn ? '' :
        '<div class="auth-banner" id="auth-banner">' +
            '<span>&#128274; Names are redacted. <a href="/login">Sign in with your @tamu.edu email</a> to see full contact details.</span>' +
            '<button class="auth-banner-close" onclick="document.getElementById(\'auth-banner\').style.display=\'none\'" aria-label="Dismiss">&times;</button>' +
        '</div>';

    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
        '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
        '<title>Aggie Connect — Ride Clusters</title>\n' +
        '<style>\n' + CSS + '\n</style>\n</head>\n<body>\n' +
        '<div class="container">\n' +
        '<div class="hero"><h1>Aggie Connect</h1>' +
        '<p class="subtitle">' + subtitle + '</p>' +
        '<p class="tagline">Find someone going your way. Updated in real time.</p>' +
        authHtml +
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

        '<div class="footer">' + totalCount + ' total requests &middot; ' + groupCount + ' groups monitored &middot; v3.6</div>\n' +
        '</div>\n<script>\n' + JS + '\n</script>\n</body>\n</html>';
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
'html, body { overflow-x: hidden; }',
'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); line-height: 1.4; -webkit-font-smoothing: antialiased; }',
'.container { max-width: 640px; margin: 0 auto; padding: 16px 16px 40px; }',
'.hero { text-align: center; margin-bottom: 14px; }',
'.hero h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }',
'.hero .subtitle { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }',
'.hero .subtitle strong { color: var(--text); }',
'.hero .tagline { font-size: 13px; color: var(--text-muted); margin-top: 4px; }',
'.auth-link { font-size: 12px; color: var(--text-muted); margin-top: 6px; }',
'.auth-link a { color: var(--maroon); text-decoration: none; font-weight: 600; }',
'.auth-link a:hover { text-decoration: underline; }',
'.auth-email-display { font-weight: 600; color: var(--text-secondary); }',
'.auth-banner { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 10px 14px; border-radius: var(--radius-sm); font-size: 12px; margin: 0 0 12px; display: flex; align-items: center; gap: 8px; line-height: 1.45; }',
'.auth-banner a { color: var(--maroon); font-weight: 700; text-decoration: none; }',
'.auth-banner a:hover { text-decoration: underline; }',
'.auth-banner-close { margin-left: auto; background: none; border: none; font-size: 20px; cursor: pointer; color: #92400e; line-height: 1; padding: 0 4px; flex-shrink: 0; }',
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
'.direction-label.leaving { color: #1d4ed8; background: #eff6ff; border-top: 1px solid #dbeafe; border-bottom: 1px solid #dbeafe; }',
'.direction-label.arriving { color: #15803d; background: #f0fdf4; border-top: 1px solid #dcfce7; border-bottom: 1px solid #dcfce7; }',
'.direction-count { font-weight: 400; opacity: 0.7; }',
'.cluster { border: 1px solid var(--border); border-radius: var(--radius); background: var(--card); overflow: hidden; margin-bottom: 10px; transition: box-shadow 0.15s; }',
'.cluster:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }',
'.cluster.leaving { border-left: 3px solid var(--blue); }',
'.cluster.arriving { border-left: 3px solid var(--green); }',
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
'.footer { text-align: center; padding: 16px 0; font-size: 11px; color: #ccc; border-top: 1px solid #eee; margin-top: 20px; }',
'@media (max-width: 700px) {',
'  .container { padding: 8px 8px 32px; }',
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
'function toggleCluster(el) { el.classList.toggle("open"); el.setAttribute("aria-expanded", el.classList.contains("open")); }',
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
'window.addEventListener("resize", setStickyOffsets);'
].join('\n');

module.exports = router;
