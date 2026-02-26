/**
 * Aggie Connect — Dashboard v3.1
 * Public ride board at v3.myburrow.club
 * Port: 3004
 */

require('dotenv').config();

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3004;
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
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return h12 + ':' + String(m).padStart(2, '0') + ' ' + ampm;
}

// ── Cluster Logic (from dashboard3) ───────────────────────────────────────

function datesOverlap(a, b) {
    if (!a.ride_plan_date && !b.ride_plan_date) return true;
    if (!a.ride_plan_date || !b.ride_plan_date) return true;
    if (a.ride_plan_date === b.ride_plan_date) return true;
    if (a.date_fuzzy && (a.possible_dates || []).includes(b.ride_plan_date)) return true;
    if (b.date_fuzzy && (b.possible_dates || []).includes(a.ride_plan_date)) return true;
    const da = new Date(a.ride_plan_date);
    const db = new Date(b.ride_plan_date);
    return Math.abs((da - db) / 86400000) <= 1;
}

function buildClusters(requests) {
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
                if (datesOverlap(members[a], members[b])) assigned[b] = idx;
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
        supabase.from('monitored_groups').select('group_id, group_name').eq('active', true),
        supabase.from('v3_requests').select('id')
            .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
        supabase.from('v3_requests').select('id')
            .gte('created_at', today + 'T00:00:00')
    ]);

    // Exclude test/dump groups from dashboard
    var allGroups = results[1].data || [];
    var testGroupIds = new Set();
    var activeGroupIds = [];
    for (var gi = 0; gi < allGroups.length; gi++) {
        var gname = (allGroups[gi].group_name || '').toLowerCase();
        if (gname.includes('dump') || gname.includes('test')) {
            testGroupIds.add(allGroups[gi].group_id);
        } else {
            activeGroupIds.push(allGroups[gi]);
        }
    }

    var rawReqs = results[0].data || [];
    var allReqs = rawReqs.filter(function(r) {
        return !r.source_group || !testGroupIds.has(r.source_group);
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
            '  .hero { text-align: center; margin-bottom: 40px; }',
            '  .hero h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 6px; }',
            '  .hero .subtitle { font-size: 15px; color: #666; }',
            '  .hero .subtitle strong { color: #1a1a1a; }',
            '',
            '  .section { margin-bottom: 36px; }',
            '  .section-header { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #999; margin-bottom: 16px; }',
            '',
            '  .date-group { margin-bottom: 24px; }',
            '  .date-label { font-size: 15px; font-weight: 600; color: #333; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e5e5e5; }',
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
            '  }',
            '</style>',
            '</head>',
            '<body>',
            '<div class="container">',
            '',
            '  <div class="hero">',
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
            '</body>',
            '</html>'
        ].join('\n');

        res.send(html);
    } catch (err) {
        console.error('[Dashboard] Error:', err.message);
        res.status(500).send('Error loading dashboard');
    }
});

app.listen(PORT, '0.0.0.0', function() {
    console.log('[Dashboard] v3.1 running at http://localhost:' + PORT);
});
