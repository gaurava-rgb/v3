/**
 * Aggie Connect — Dashboard v3.2
 * Public ride board at ridesplit.app
 * Port: 3004
 */

require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const { createClient } = require('@supabase/supabase-js');
const { saveRequest } = require('./db');
const { processRequest } = require('./matcher');
const { normalizeLocation } = require('./normalize');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use('/public', express.static(__dirname + '/public'));
const PORT = process.env.DASHBOARD_PORT || 3004;
const DIGEST_KEY = process.env.DIGEST_KEY || '';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const GA_TAG = [
    '<!-- Google tag (gtag.js) -->',
    '<script async src="https://www.googletagmanager.com/gtag/js?id=G-MC6FDBQ4MZ"></script>',
    '<script>',
    '  window.dataLayer = window.dataLayer || [];',
    '  function gtag(){dataLayer.push(arguments);}',
    "  gtag('js', new Date());",
    "  gtag('config', 'G-MC6FDBQ4MZ');",
    '</script>'
].join('\n');

// ── Auth Helpers ──────────────────────────────────────────────────────────

var COOKIE_OPTS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
};

function setAuthCookies(res, accessToken, refreshToken) {
    res.cookie('access_token', accessToken,
        Object.assign({}, COOKIE_OPTS, { maxAge: 60 * 60 * 1000 }));
    res.cookie('refresh_token', refreshToken,
        Object.assign({}, COOKIE_OPTS, { maxAge: 7 * 24 * 60 * 60 * 1000 }));
}

function clearAuthCookies(res) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
}

// Separate client for auth operations — prevents poisoning the service_role client's state
var supabaseAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function optionalAuth(req, res, next) {
    req.user = null;
    var accessToken = req.cookies.access_token;
    var refreshToken = req.cookies.refresh_token;

    if (!accessToken && !refreshToken) return next();

    if (accessToken) {
        try {
            var result = await supabaseAuth.auth.getUser(accessToken);
            if (result.data && result.data.user) {
                req.user = result.data.user;
                return next();
            }
        } catch (e) { /* token invalid, try refresh */ }
    }

    if (refreshToken) {
        try {
            var refreshResult = await supabaseAuth.auth.refreshSession({ refresh_token: refreshToken });
            if (refreshResult.data && refreshResult.data.session) {
                var session = refreshResult.data.session;
                setAuthCookies(res, session.access_token, session.refresh_token);
                req.user = refreshResult.data.user;
                return next();
            }
        } catch (e) {
            console.error('[Auth] Refresh error:', e.message);
        }
    }

    clearAuthCookies(res);
    next();
}

function renderLoginPage(errorMsg, prefillEmail) {
    var errorHtml = errorMsg
        ? '<div class="auth-error">' + escHtml(errorMsg) + '</div>'
        : '';
    return [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '<head>',
        GA_TAG,
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<title>Sign In — RideSplit</title>',
        '<style>',
        '  * { margin: 0; padding: 0; box-sizing: border-box; }',
        '  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
        '         background: #fafafa; color: #1a1a1a; min-height: 100vh;',
        '         display: flex; align-items: center; justify-content: center; }',
        '  .auth-card { background: #fff; border: 1px solid #e8e8e8; border-radius: 12px;',
        '               padding: 32px 28px; max-width: 380px; width: 100%; margin: 20px; }',
        '  .auth-card h1 { font-size: 22px; font-weight: 700; text-align: center;',
        '                   letter-spacing: -0.5px; margin-bottom: 4px; }',
        '  .auth-subtitle { text-align: center; font-size: 14px; color: #666;',
        '                    margin-bottom: 24px; }',
        '  .auth-label { display: block; font-size: 13px; font-weight: 600;',
        '                color: #555; margin-bottom: 6px; }',
        '  .auth-input { width: 100%; padding: 10px 12px; font-size: 15px;',
        '                border: 1px solid #d0d0d0; border-radius: 8px;',
        '                outline: none; transition: border-color 0.2s; }',
        '  .auth-input:focus { border-color: #500000; }',
        '  .auth-btn { width: 100%; padding: 12px; font-size: 15px; font-weight: 600;',
        '              background: #500000; color: #fff; border: none; border-radius: 8px;',
        '              cursor: pointer; margin-top: 16px; transition: background 0.2s; }',
        '  .auth-btn:hover { background: #6b0000; }',
        '  .auth-btn:active { background: #3a0000; }',
        '  .auth-error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;',
        '                border-radius: 8px; padding: 10px 14px; font-size: 13px;',
        '                margin-bottom: 16px; }',
        '  .auth-footer { text-align: center; font-size: 11px; color: #bbb;',
        '                  margin-top: 20px; }',
        '</style>',
        '</head>',
        '<body>',
        '<div class="auth-card">',
        '  <h1>Aggie Connect</h1>',
        '  <p class="auth-subtitle">Sign in with your TAMU email</p>',
        errorHtml,
        '  <form method="POST" action="/login">',
        '    <label class="auth-label" for="email">Email address</label>',
        '    <input class="auth-input" type="email" id="email" name="email"',
        '           placeholder="netid@tamu.edu" required autocomplete="email"',
        '           value="' + escHtml(prefillEmail || '') + '" autofocus>',
        '    <button class="auth-btn" type="submit">Send Verification Code</button>',
        '  </form>',
        '  <div class="auth-footer">Only @tamu.edu emails are accepted</div>',
        '</div>',
        '</body>',
        '</html>'
    ].join('\n');
}

function renderVerifyPage(email, errorMsg) {
    var errorHtml = errorMsg
        ? '<div class="auth-error">' + escHtml(errorMsg) + '</div>'
        : '';
    return [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '<head>',
        GA_TAG,
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<title>Verify — RideSplit</title>',
        '<style>',
        '  * { margin: 0; padding: 0; box-sizing: border-box; }',
        '  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
        '         background: #fafafa; color: #1a1a1a; min-height: 100vh;',
        '         display: flex; align-items: center; justify-content: center; }',
        '  .auth-card { background: #fff; border: 1px solid #e8e8e8; border-radius: 12px;',
        '               padding: 32px 28px; max-width: 380px; width: 100%; margin: 20px; }',
        '  .auth-card h1 { font-size: 22px; font-weight: 700; text-align: center;',
        '                   letter-spacing: -0.5px; margin-bottom: 4px; }',
        '  .auth-subtitle { text-align: center; font-size: 14px; color: #666;',
        '                    margin-bottom: 24px; line-height: 1.4; }',
        '  .auth-email { font-weight: 600; color: #1a1a1a; }',
        '  .auth-label { display: block; font-size: 13px; font-weight: 600;',
        '                color: #555; margin-bottom: 6px; }',
        '  .auth-input { width: 100%; padding: 10px 12px; font-size: 20px;',
        '                border: 1px solid #d0d0d0; border-radius: 8px;',
        '                outline: none; text-align: center; letter-spacing: 6px;',
        '                font-weight: 600; transition: border-color 0.2s; }',
        '  .auth-input:focus { border-color: #500000; }',
        '  .auth-btn { width: 100%; padding: 12px; font-size: 15px; font-weight: 600;',
        '              background: #500000; color: #fff; border: none; border-radius: 8px;',
        '              cursor: pointer; margin-top: 16px; transition: background 0.2s; }',
        '  .auth-btn:hover { background: #6b0000; }',
        '  .auth-btn:active { background: #3a0000; }',
        '  .auth-error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;',
        '                border-radius: 8px; padding: 10px 14px; font-size: 13px;',
        '                margin-bottom: 16px; }',
        '  .auth-links { text-align: center; margin-top: 16px; font-size: 13px; }',
        '  .auth-links a { color: #500000; text-decoration: none; }',
        '  .auth-links a:hover { text-decoration: underline; }',
        '  .auth-divider { color: #ddd; margin: 0 8px; }',
        '</style>',
        '</head>',
        '<body>',
        '<div class="auth-card">',
        '  <h1>Check your email</h1>',
        '  <p class="auth-subtitle">We sent a 6-digit code to<br>',
        '     <span class="auth-email">' + escHtml(email) + '</span></p>',
        errorHtml,
        '  <form method="POST" action="/verify">',
        '    <input type="hidden" name="email" value="' + escHtml(email) + '">',
        '    <label class="auth-label" for="token">Verification code</label>',
        '    <input class="auth-input" type="text" id="token" name="token"',
        '           placeholder="00000000" maxlength="8" pattern="[0-9]{6,8}"',
        '           inputmode="numeric" autocomplete="one-time-code" required autofocus>',
        '    <button class="auth-btn" type="submit">Verify</button>',
        '  </form>',
        '  <div class="auth-links">',
        '    <a href="/login?email=' + encodeURIComponent(email) + '">Resend code</a>',
        '    <span class="auth-divider">|</span>',
        '    <a href="/login">Different email</a>',
        '  </div>',
        '</div>',
        '</body>',
        '</html>'
    ].join('\n');
}

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

function displayName(req, isLoggedIn) {
    if (isLoggedIn) {
        return req.sender_name || req.source_contact || 'Unknown';
    }
    if (req.sender_name) return redactName(req.sender_name);
    return redactContact(req.source_contact);
}

function displayPhone(req, isLoggedIn) {
    if (!req.source_contact) return '';
    if (isLoggedIn) return req.source_contact;
    return redactPhone(req.source_contact);
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

function formatMsgTime(isoStr) {
    if (!isoStr) return '';
    var d = new Date(isoStr);
    var month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
    var day = d.getDate();
    var h = d.getHours();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    var min = d.getMinutes();
    var minStr = min < 10 ? '0' + min : '' + min;
    return month + ' ' + day + ', ' + h + ':' + minStr + ' ' + ampm;
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


// ── Mockup Layout Renderers ──────────────────────────────────────────────

function groupByDirection(requests) {
    var collegeStation = 'College Station';
    var leaving = [];  // origin = CS
    var arriving = []; // destination = CS
    var others = [];   // neither
    
    for (var i = 0; i < requests.length; i++) {
        var r = requests[i];
        var origin = r.request_origin || '';
        var dest = r.request_destination || '';
        
        if (origin === collegeStation && dest !== collegeStation) {
            leaving.push(r);
        } else if (dest === collegeStation && origin !== collegeStation) {
            arriving.push(r);
        } else {
            others.push(r);
        }
    }
    
    return { leaving: leaving, arriving: arriving, others: others };
}

function renderDateTable(dateKey, requests, isLoggedIn) {
    var dateLabel = dateKey === 'flexible' ? 'Flexible Dates' : formatDate(dateKey);
    var isToday = dateLabel.startsWith('Today');
    var todayBadge = isToday ? ' <span class="today-badge">Today</span>' : '';

    var grouped = groupByDirection(requests);
    var summaryParts = [];
    if (grouped.leaving.length > 0) summaryParts.push(grouped.leaving.length + ' leaving');
    if (grouped.arriving.length > 0) summaryParts.push(grouped.arriving.length + ' arriving');
    if (grouped.others.length > 0) summaryParts.push(grouped.others.length + ' other' + (grouped.others.length > 1 ? 's' : ''));
    var summary = summaryParts.length > 0 ? '<span class="date-summary">' + summaryParts.join(' &middot; ') + '</span>' : '';

    // Sort within each group: by destination, then offers before needs, then name
    function sortGroup(arr) {
        return arr.slice().sort(function(a, b) {
            var destA = (a.request_destination || '').toLowerCase();
            var destB = (b.request_destination || '').toLowerCase();
            if (destA !== destB) return destA.localeCompare(destB);
            if (a.request_type !== b.request_type) return a.request_type === 'offer' ? -1 : 1;
            var nameA = (a.sender_name || a.source_contact || '').toLowerCase();
            var nameB = (b.sender_name || b.source_contact || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
    }

    function renderRow(r, dirClass) {
        var isOffer = r.request_type === 'offer';
        var emoji = isOffer ? '🚗' : '✋';
        var name = displayName(r, isLoggedIn);
        var phone = displayPhone(r, isLoggedIn);
        var route = escHtml(r.request_origin || '?') + ' → ' + escHtml(r.request_destination || '?');
        var msg = r.raw_message ? escHtml(r.raw_message) : '';
        var time = r.ride_plan_time ? formatTime(r.ride_plan_time) : formatMsgTime(r.created_at);
        return '<tr class="' + dirClass + '">' +
            '<td class="col-type">' + emoji + '</td>' +
            '<td class="col-name">' + escHtml(name) + '</td>' +
            '<td class="col-phone">' + escHtml(phone) + '</td>' +
            '<td class="col-route">' + route + '</td>' +
            '<td class="col-msg">' + msg + '</td>' +
            '<td class="col-time">sent ' + escHtml(time) + '</td>' +
            '</tr>';
    }

    var rows = [];
    var sortedLeaving = sortGroup(grouped.leaving);
    var sortedArriving = sortGroup(grouped.arriving);
    var sortedOthers = sortGroup(grouped.others);

    if (sortedLeaving.length > 0) {
        rows.push('<tr class="section-header section-leaving"><td colspan="6">↑ Leaving College Station (' + sortedLeaving.length + ')</td></tr>');
        for (var i = 0; i < sortedLeaving.length; i++) rows.push(renderRow(sortedLeaving[i], 'row-leaving'));
    }
    if (sortedArriving.length > 0) {
        rows.push('<tr class="section-header section-arriving"><td colspan="6">↓ Coming to College Station (' + sortedArriving.length + ')</td></tr>');
        for (var i = 0; i < sortedArriving.length; i++) rows.push(renderRow(sortedArriving[i], 'row-arriving'));
    }
    if (sortedOthers.length > 0) {
        rows.push('<tr class="section-header section-others"><td colspan="6">Other Routes (' + sortedOthers.length + ')</td></tr>');
        for (var i = 0; i < sortedOthers.length; i++) rows.push(renderRow(sortedOthers[i], 'row-others'));
    }

    return [
        '<div class="date-block">',
        '  <div class="date-label"><span class="date-text">' + dateLabel + '</span>' + todayBadge + summary + '</div>',
        '  <table class="ride-table">',
        rows.join('\n'),
        '  </table>',
        '</div>'
    ].join('\n');
}

// ── Data ──────────────────────────────────────────────────────────────────

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
        .select('id, source_group, source_contact, sender_name, request_type, ride_plan_date, ride_plan_time, request_origin, request_destination, raw_message, created_at')
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

        // Skip matches where both dates are known but different
        if (need.ride_plan_date && offer.ride_plan_date && need.ride_plan_date !== offer.ride_plan_date) continue;

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

    enriched.sort(function(a, b) {
        var da = a.need.ride_plan_date || a.offer.ride_plan_date || '9999';
        var db = b.need.ride_plan_date || b.offer.ride_plan_date || '9999';
        return da.localeCompare(db);
    });

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
        supabase.from('v3_requests').select('id, source_group, source_contact, sender_name, request_type, request_category, ride_plan_date, ride_plan_time, date_fuzzy, possible_dates, request_origin, request_destination, raw_message, created_at')
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
        parts.push('    <div class="match-person-msg">&ldquo;' + escHtml(need.raw_message) + '&rdquo; <span class="msg-time">' + escHtml(formatMsgTime(need.created_at)) + '</span></div>');
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
        parts.push('    <div class="match-person-msg">&ldquo;' + escHtml(offer.raw_message) + '&rdquo; <span class="msg-time">' + escHtml(formatMsgTime(offer.created_at)) + '</span></div>');
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
            parts.push('    <div class="match-person-msg">&ldquo;' + escHtml(person.raw_message) + '&rdquo; <span class="msg-time">' + escHtml(formatMsgTime(person.created_at)) + '</span></div>');
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

// ── Auth Routes ───────────────────────────────────────────────────────────

app.get('/login', function(req, res) {
    var prefill = req.query.email || '';
    res.send(renderLoginPage('', prefill));
});

app.post('/login', async function(req, res) {
    var email = (req.body.email || '').trim().toLowerCase();

    if (!email || !email.endsWith('@tamu.edu')) {
        return res.send(renderLoginPage('Please use your @tamu.edu email address.', email));
    }
    if (!/^[^\s@]+@tamu\.edu$/.test(email)) {
        return res.send(renderLoginPage('Please enter a valid @tamu.edu email.', email));
    }

    try {
        var result = await supabaseAuth.auth.signInWithOtp({
            email: email,
            options: { shouldCreateUser: true }
        });

        if (result.error) {
            console.error('[Auth] OTP send error:', JSON.stringify(result.error));
            var errMsg = result.error.message || result.error.msg || JSON.stringify(result.error);
            if (errMsg.includes('rate')) {
                return res.send(renderLoginPage('Too many attempts. Please wait a minute and try again.', email));
            }
            return res.send(renderLoginPage('Failed to send verification code. Please try again.', email));
        }

        res.redirect('/verify?email=' + encodeURIComponent(email));
    } catch (err) {
        console.error('[Auth] OTP send exception:', err.message);
        res.send(renderLoginPage('Something went wrong. Please try again.', email));
    }
});

app.get('/verify', function(req, res) {
    var email = (req.query.email || '').trim();
    if (!email) return res.redirect('/login');
    res.send(renderVerifyPage(email, ''));
});

app.post('/verify', async function(req, res) {
    var email = (req.body.email || '').trim().toLowerCase();
    var token = (req.body.token || '').replace(/\s/g, '');

    if (!email || !token) return res.redirect('/login');

    if (!/^\d{6,8}$/.test(token)) {
        return res.send(renderVerifyPage(email, 'Please enter the code from your email.'));
    }

    try {
        // Try 'email' type first (returning users), then 'signup' (new users)
        var result = await supabaseAuth.auth.verifyOtp({
            email: email,
            token: token,
            type: 'email'
        });

        if (result.error) {
            // Might be a signup OTP — try signup type
            var signupResult = await supabaseAuth.auth.verifyOtp({
                email: email,
                token: token,
                type: 'signup'
            });
            if (!signupResult.error) {
                result = signupResult;
            }
        }

        if (result.error) {
            console.error('[Auth] OTP verify error:', JSON.stringify(result.error));
            var errMsg = 'Invalid code. Please check and try again.';
            if (result.error.message.toLowerCase().includes('expired')) {
                errMsg = 'Code expired. Please request a new one.';
            }
            return res.send(renderVerifyPage(email, errMsg));
        }

        if (!result.data.session) {
            return res.send(renderVerifyPage(email, 'Verification failed. Please try again.'));
        }

        setAuthCookies(res, result.data.session.access_token, result.data.session.refresh_token);
        res.redirect('/');
    } catch (err) {
        console.error('[Auth] OTP verify exception:', err.message);
        res.send(renderVerifyPage(email, 'Something went wrong. Please try again.'));
    }
});

app.get('/logout', function(req, res) {
    clearAuthCookies(res);
    res.redirect('/');
});

// ── Submit Ride (Web Form) ───────────────────────────────────────────────

app.post('/submit', optionalAuth, async function(req, res) {
    if (!req.user) {
        return res.status(401).json({ error: 'You must be signed in to submit a ride.' });
    }

    var type = (req.body.type || '').trim();
    var origin = (req.body.origin || '').trim();
    var destination = (req.body.destination || '').trim();
    var date = (req.body.date || '').trim();
    var name = (req.body.name || '').trim();
    var phone = (req.body.phone || '').trim();
    var time = (req.body.time || '').trim();
    var comments = (req.body.comments || '').trim();
    var originOther = (req.body.originOther || '').trim();
    var destOther = (req.body.destOther || '').trim();

    if (origin === 'Other' && originOther) origin = originOther;
    if (destination === 'Other' && destOther) destination = destOther;

    var errors = [];
    var errorFields = [];
    if (type !== 'need' && type !== 'offer') { errors.push('Select Looking or Offering.'); errorFields.push('type'); }
    if (!origin) { errors.push('Origin is required.'); errorFields.push('origin'); }
    if (!destination) { errors.push('Destination is required.'); errorFields.push('destination'); }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push('Valid date is required.'); errorFields.push('date'); }
    if (!name) { errors.push('Name is required.'); errorFields.push('name'); }
    if (!phone || !/^\+?[\d\s\-()]{7,}$/.test(phone)) { errors.push('Valid phone number is required.'); errorFields.push('phone'); }
    if (origin && destination && normalizeLocation(origin) === normalizeLocation(destination)) {
        errors.push('Origin and destination cannot be the same.');
        errorFields.push('origin', 'destination');
    }
    if (date) {
        var today = new Date().toISOString().split('T')[0];
        if (date < today) { errors.push('Date must be today or in the future.'); errorFields.push('date'); }
    }
    if (errors.length > 0) {
        return res.status(400).json({ error: errors.join(' '), fields: errorFields });
    }

    var phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length === 10) phoneDigits = '1' + phoneDigits;

    var typeLabel = type === 'offer' ? 'Offering ride' : 'Looking for ride';
    var rawMessage = typeLabel + ' from ' + origin + ' to ' + destination;
    if (time) rawMessage += ' around ' + time;
    if (comments) rawMessage += '. ' + comments;

    var details = {};
    if (comments) details.description = comments;

    try {
        var request = await saveRequest({
            source: 'web-form',
            sourceGroup: null,
            sourceContact: phoneDigits,
            senderName: name,
            type: type,
            category: 'ride',
            date: date,
            ridePlanTime: time || null,
            dateFuzzy: false,
            possibleDates: [],
            timeFuzzy: !time,
            origin: origin,
            destination: destination,
            details: details,
            rawMessage: rawMessage
        });

        if (!request) {
            return res.status(409).json({ error: 'A matching ride request already exists.' });
        }

        var matches = await processRequest(request);
        var matchCount = matches ? matches.length : 0;
        console.log('[Dashboard] Web form submission saved:', request.id,
            matchCount > 0 ? '(' + matchCount + ' matches)' : '');

        return res.json({ success: true, requestId: request.id, matches: matchCount });
    } catch (err) {
        console.error('[Dashboard] Submit error:', err.message);
        return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// ── Static Pages ─────────────────────────────────────────────────────────

function renderStaticPage(title, bodyHtml) {
    return [
        '<!DOCTYPE html><html lang="en"><head>',
        GA_TAG,
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<title>' + title + ' — RideSplit</title>',
        '<style>',
        '  * { margin: 0; padding: 0; box-sizing: border-box; }',
        '  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fafafa; color: #1a1a1a; line-height: 1.7; }',
        '  .page { max-width: 700px; margin: 0 auto; padding: 40px 20px; }',
        '  h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }',
        '  .updated { font-size: 12px; color: #999; margin-bottom: 24px; }',
        '  h2 { font-size: 15px; font-weight: 700; margin-top: 20px; margin-bottom: 4px; color: #333; }',
        '  p, li { font-size: 14px; color: #444; }',
        '  ul { margin-left: 20px; margin-bottom: 8px; }',
        '  li { margin-bottom: 2px; }',
        '  a { color: #500000; }',
        '  .back { display: inline-block; margin-bottom: 20px; font-size: 13px; color: #500000; text-decoration: none; }',
        '  .back:hover { text-decoration: underline; }',
        '  .faq-q { font-size: 14px; font-weight: 700; color: #1a1a1a; margin-top: 16px; }',
        '  .faq-a { font-size: 14px; color: #444; margin-top: 2px; }',
        '</style></head><body>',
        '<div class="page">',
        '<a class="back" href="/">&larr; Back to board</a>',
        bodyHtml,
        '</div></body></html>'
    ].join('\n');
}

app.get('/terms', function(req, res) {
    var body = [
        '<h1>Terms of Use</h1>',
        '<p class="updated">Last updated: March 1, 2026</p>',
        '<h2>1. What RideSplit Is (and Isn\'t)</h2>',
        '<p>RideSplit is a free, informational bulletin board that aggregates publicly posted ride-share messages from WhatsApp groups. We do not arrange, broker, or provide transportation services. We are not a ride-sharing company, a taxi service, or a transportation network company.</p>',
        '<h2>2. No Guarantees</h2>',
        '<p>All ride information is posted by third parties in WhatsApp groups. We make no guarantees about the accuracy, safety, reliability, or availability of any ride listed. Information may be outdated, incorrect, or no longer available.</p>',
        '<h2>3. Your Responsibility</h2>',
        '<p>By using this site, you acknowledge that:</p>',
        '<ul>',
        '<li>You are solely responsible for any arrangements you make with other users.</li>',
        '<li>You assume all risk when sharing rides with others.</li>',
        '<li>You should exercise your own judgment about the safety of any ride arrangement.</li>',
        '<li>RideSplit is not a party to any agreement between riders and drivers.</li>',
        '</ul>',
        '<h2>4. We Are Not Liable</h2>',
        '<p>To the maximum extent permitted by law, RideSplit and its creator(s) shall not be liable for any damages, injuries, losses, or disputes arising from ride arrangements made using information found on this site. This includes but is not limited to: accidents, property damage, personal injury, theft, fraud, or any other harm.</p>',
        '<h2>5. No Vetting</h2>',
        '<p>We do not verify the identity, driving record, insurance status, vehicle condition, or background of any person listed on this site. @tamu.edu email verification confirms university affiliation only, not trustworthiness.</p>',
        '<h2>6. Data &amp; Privacy</h2>',
        '<ul>',
        '<li>We display messages that were already posted publicly in WhatsApp groups.</li>',
        '<li>Full names and contact details are only visible to authenticated @tamu.edu users.</li>',
        '<li>We do not sell or share your data with third parties.</li>',
        '<li>We store login sessions via cookies. No passwords are stored.</li>',
        '</ul>',
        '<h2>7. Acceptable Use</h2>',
        '<p>Do not use this site to: harass other users, post false information, scrape data for commercial purposes, or any unlawful activity.</p>',
        '<h2>8. Changes</h2>',
        '<p>We may update these terms at any time. Continued use of the site constitutes acceptance.</p>',
        '<h2>9. Contact</h2>',
        '<p><a href="mailto:gaurav_a@tamu.edu?subject=ridesplit">gaurav_a@tamu.edu</a> (subject: ridesplit)</p>'
    ].join('\n');
    res.send(renderStaticPage('Terms', body));
});

app.get('/faq', async function(req, res) {
    // Fetch active monitored groups for Q4
    var groupNames = [];
    try {
        var gRes = await supabase.from('monitored_groups').select('group_name')
            .eq('active', true).neq('group_name', 'Dump');
        if (gRes.data) {
            var seen = {};
            gRes.data.forEach(function(g) {
                var n = g.group_name.trim();
                if (!seen[n]) { seen[n] = true; groupNames.push(n); }
            });
            groupNames.sort();
        }
    } catch (e) { /* fallback: empty list */ }

    var groupListHtml = groupNames.length
        ? '<ul>' + groupNames.map(function(n) { return '<li>' + escHtml(n) + '</li>'; }).join('') + '</ul>'
        : '<p class="faq-a"><em>Unable to load group list.</em></p>';

    var body = [
        '<h1>FAQs</h1>',
        '<p class="updated">ridesplit.app</p>',
        '<div class="faq-q">1. What is this website?</div>',
        '<p class="faq-a">Hi, I made this to track groups on WhatsApp that I am in. I see a lot of messages across all these groups for tracking ride requests. It\'s hard to track who is going when, etc. I hope this helps, especially next week (spring break).</p>',
        '<div class="faq-q">2. How to use this?</div>',
        '<p class="faq-a">For now, find someone with whom you can split a ride on a date you like. If you login with your <strong>@tamu.edu</strong> email, you can see their details to contact them.</p>',
        '<div class="faq-q">3. Who is it for?</div>',
        '<p class="faq-a">Aggies only \u2014 You can only log in by verifying your <strong>@tamu.edu</strong> email. It was the simplest way I could add authentication and determine who actually sees our data.</p>',
        '<div class="faq-q">4. Which groups are being tracked?</div>',
        '<p class="faq-a">Currently tracking ' + groupNames.length + ' WhatsApp groups:</p>',
        groupListHtml,
        '<div class="faq-q">5. Can you track our group?</div>',
        '<p class="faq-a">Add +1-979-344-5977 (that\'s me \u2014 Gaurav), then I\'ll track rides in your group too.</p>',
        '<div class="faq-q">6. This has bugs / I have questions / I have complaints. Who do I contact?</div>',
        '<p class="faq-a"><a href="mailto:gaurav_a@tamu.edu?subject=ridesplit">gaurav_a@tamu.edu</a> (subject: ridesplit would be nice). Will add a contact form later.</p>',
        '<div class="faq-q">7. Who made this?</div>',
        '<p class="faq-a">Hi, it\'s me, <strong>Gaurav Arora</strong>. MS MIS \'26.</p>',
        '<div class="faq-q">8. Is this made by AI?</div>',
        '<p class="faq-a"><img src="/public/faq-ai.webp" alt="Is this made by AI?" style="max-width: 300px; border-radius: 8px; margin-top: 8px;"></p>'
    ].join('\n');
    res.send(renderStaticPage('FAQ', body));
});

// ── Route ─────────────────────────────────────────────────────────────────

app.get('/', optionalAuth, async function(req, res) {
    try {
        var today = new Date().toISOString().split('T')[0];

        var results = await Promise.all([
            supabase.from('v3_requests').select('*')
                .eq('request_category', 'ride')
                .or('ride_plan_date.gte.' + today + ',date_fuzzy.eq.true,ride_plan_date.is.null')
                .order('created_at', { ascending: false }),
            supabase.from('monitored_groups').select('group_id, group_name, is_test').eq('active', true)
        ]);

        var allGroups = results[1].data || [];
        var testGroupFilter = new Set();
        var activeCount = 0;
        for (var gi = 0; gi < allGroups.length; gi++) {
            if (allGroups[gi].is_test) {
                testGroupFilter.add(allGroups[gi].group_id);
                if (allGroups[gi].group_name) {
                    testGroupFilter.add(allGroups[gi].group_name);
                }
            } else {
                activeCount++;
            }
        }

        var rawReqs = results[0].data || [];
        var allReqs = rawReqs.filter(function(r) {
            return !r.source_group || !testGroupFilter.has(r.source_group);
        });

        // Group by date
        var byDate = {};
        for (var i = 0; i < allReqs.length; i++) {
            var key = allReqs[i].ride_plan_date || 'flexible';
            if (!byDate[key]) byDate[key] = [];
            byDate[key].push(allReqs[i]);
        }

        var sortedDates = Object.keys(byDate).sort(function(a, b) {
            if (a === 'flexible') return 1;
            if (b === 'flexible') return -1;
            return a.localeCompare(b);
        });

        // Auth state
        var isLoggedIn = !!req.user;
        var userEmail = req.user ? req.user.email : '';

        // Render date blocks
        var dateBlocksHtml;
        if (sortedDates.length === 0) {
            dateBlocksHtml = '<div class="empty">No ride activity yet.</div>';
        } else {
            var blocks = [];
            for (var di = 0; di < sortedDates.length; di++) {
                var dk = sortedDates[di];
                blocks.push(renderDateTable(dk, byDate[dk], isLoggedIn));
            }
            dateBlocksHtml = blocks.join('\n');
        }

        var totalCount = allReqs.length;
        var subtitle = 'Tracking <strong>' + totalCount + ' ride request' + (totalCount !== 1 ? 's' : '') +
                      '</strong> across <strong>' + activeCount + ' WhatsApp group' + (activeCount !== 1 ? 's' : '') +
                      '</strong> this week';

        // Auth UI in legend bar
        var authHtml = isLoggedIn
            ? '<div class="auth-link"><span class="auth-email-display">' + escHtml(userEmail) + '</span> · <a href="/logout">Sign out</a></div>'
            : '<div class="auth-link"><a href="/login">Sign in with @tamu.edu</a> to see full names &amp; numbers</div>';

        var html = [
            '<!DOCTYPE html>',
            '<html lang="en">',
            '<head>',
            GA_TAG,
            '<meta charset="utf-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1">',
            '<title>Aggie Connect</title>',
            '<style>',
            '  * { margin: 0; padding: 0; box-sizing: border-box; }',
            '  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fafafa; color: #1a1a1a; line-height: 1.45; }',
            '  .container { max-width: 100%; margin: 0 auto; padding: 20px 24px; }',
            '  .hero { text-align: center; margin-bottom: 16px; }',
            '  .hero h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }',
            '  .hero .subtitle { font-size: 13px; color: #666; margin-top: 2px; }',
            '  .hero .subtitle strong { color: #1a1a1a; }',
            '  .hero .tagline { font-size: 13px; color: #999; margin-top: 4px; }',
            '  .hero .tagline a { color: #500000; text-decoration: none; }',
            '  .hero .tagline a:hover { text-decoration: underline; }',
            '  .legend { display: flex; gap: 20px; align-items: center; font-size: 14px; font-weight: 600; color: #555; padding: 8px 0; margin-bottom: 8px; position: sticky; top: 0; background: #fafafa; z-index: 20; border-bottom: 1px solid #e8e8e8; justify-content: center; }',
            '  .legend-right { position: absolute; right: 0; top: 0; bottom: 0; display: flex; align-items: center; gap: 10px; }',
            '  .legend-date { position: absolute; left: 0; top: 0; bottom: 0; display: flex; align-items: center; font-size: 13px; font-weight: 700; color: #333; opacity: 0; transition: opacity 0.2s; }',
            '  .legend-date.visible { opacity: 1; }',
            '  .legend-item { display: flex; align-items: center; gap: 5px; }',
            '  .clock { font-size: 12px; font-weight: 600; color: #888; white-space: nowrap; }',
            '  .date-block { margin-bottom: 24px; }',
            '  .date-label { font-size: 14px; font-weight: 700; color: #333; padding: 6px 0 4px; border-bottom: 2px solid #e0e0e0; margin-bottom: 0; display: flex; align-items: center; gap: 8px; }',
            '  .today-badge { display: inline-block; background: #dcfce7; color: #16a34a; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 3px; }',
            '  .date-summary { margin-left: auto; font-size: 11px; font-weight: 400; color: #999; }',
            '  .ride-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 4px; }',
            '  .ride-table td { border: 1px solid #e8e8e8; padding: 5px 10px; vertical-align: top; }',
            '  .ride-table tr:hover { background: #f5f5f5; }',
            '  .col-type { width: 30px; text-align: center; font-size: 14px; }',
            '  .col-name { font-weight: 600; white-space: nowrap; color: #333; }',
            '  .col-phone { white-space: nowrap; color: #888; font-size: 12px; }',
            '  .col-route { white-space: nowrap; color: #555; }',
            '  .col-msg { color: #666; min-width: 200px; }',
            '  .col-time { white-space: nowrap; color: #999; font-size: 12px; text-align: right; }',
            '  .section-header td { padding: 4px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; border: 1px solid #e8e8e8; }',
            '  .section-leaving td { background: #dbeafe; color: #1d4ed8; }',
            '  .section-arriving td { background: #dcfce7; color: #16a34a; }',
            '  .section-others td { background: #f3f4f6; color: #6b7280; }',
            '  .row-leaving { background: #f0f7ff; }',
            '  .row-arriving { background: #f0fdf4; }',
            '  .row-others { background: #fafafa; }',
            '  .row-leaving:hover { background: #e0efff; }',
            '  .row-arriving:hover { background: #e0f9e8; }',
            '  .empty { padding: 40px; text-align: center; color: #aaa; font-size: 14px; }',
            '  .footer { text-align: center; padding: 16px 0; font-size: 11px; color: #ccc; border-top: 1px solid #eee; margin-top: 20px; }',
            '  .auth-link { font-size: 12px; font-weight: 600; white-space: nowrap; }',
            '  .auth-link a { color: #500000; text-decoration: none; }',
            '  .auth-link a:hover { text-decoration: underline; }',
            '  .auth-email-display { color: #888; font-weight: 400; }',
            '  .auth-banner { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 8px 16px; margin-bottom: 10px; font-size: 13px; color: #92400e; display: flex; align-items: center; justify-content: center; position: relative; }',
            '  .auth-banner a { color: #500000; font-weight: 700; text-decoration: underline; }',
            '  .auth-banner-close { cursor: pointer; color: #92400e; font-size: 18px; line-height: 1; opacity: 0.6; background: none; border: none; position: absolute; right: 12px; }',
            '  .auth-banner-close:hover { opacity: 1; }',
            '  @media (max-width: 700px) {',
            '    .container { padding: 12px 8px; }',
            '    .hero h1 { font-size: 18px; }',
            '    .hero .subtitle { font-size: 12px; }',
            '    .hero .tagline { font-size: 11px; }',
            '    .legend { flex-direction: column; gap: 4px; padding: 6px 0; position: sticky; top: 0; }',
            '    .legend-right { position: static; justify-content: center; }',
            '    .legend-date { position: static; opacity: 1; justify-content: center; font-size: 12px; }',
            '    .legend-item { font-size: 12px; }',
            '    .auth-link { font-size: 11px; }',
            '    .clock { font-size: 11px; }',
            '    .auth-banner { font-size: 12px; padding: 8px 32px 8px 12px; text-align: center; }',
            '    .date-label { font-size: 13px; }',
            '    .date-block { overflow-x: auto; -webkit-overflow-scrolling: touch; }',
            '    .ride-table { font-size: 12px; min-width: 600px; }',
            '    .ride-table td { padding: 4px 6px; }',
            '    .col-msg { min-width: 150px; }',
            '  }',
            '  .fab { position: fixed; bottom: 28px; right: 28px; width: 60px; height: 60px; border-radius: 50%; background: #500000; color: #fff; border: none; font-size: 32px; line-height: 60px; text-align: center; cursor: pointer; box-shadow: 0 4px 16px rgba(80,0,0,0.35); z-index: 1000; transition: transform 0.2s, background 0.2s; }',
            '  .fab:hover { background: #6b0000; transform: scale(1.08); }',
            '  .fab:active { background: #3a0000; transform: scale(0.96); }',
            '  .fab.open { transform: rotate(45deg); }',
            '  .fab-tooltip { display: none; position: fixed; bottom: 100px; right: 20px; background: #fff; border: 1px solid #e0e0e0; border-radius: 10px; padding: 14px 18px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index: 1001; font-size: 14px; color: #333; max-width: 260px; text-align: center; }',
            '  .fab-tooltip.visible { display: block; animation: fadeIn 0.2s ease-out; }',
            '  .fab-tooltip a { color: #500000; font-weight: 700; text-decoration: underline; }',
            '  .fab-tooltip .fab-tooltip-arrow { position: absolute; bottom: -8px; right: 30px; width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 8px solid #fff; }',
            '  .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 999; justify-content: center; align-items: flex-end; padding: 20px; }',
            '  .modal-overlay.active { display: flex; }',
            '  .ride-form-panel { background: #fff; border-radius: 16px 16px 0 0; width: 100%; max-width: 480px; max-height: 85vh; overflow-y: auto; padding: 24px 20px 20px; box-shadow: 0 -4px 24px rgba(0,0,0,0.15); animation: slideUp 0.25s ease-out; }',
            '  @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }',
            '  @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }',
            '  .ride-form-panel h2 { font-size: 18px; font-weight: 700; margin-bottom: 16px; color: #1a1a1a; }',
            '  .form-group { margin-bottom: 14px; }',
            '  .form-label { display: block; font-size: 13px; font-weight: 600; color: #555; margin-bottom: 4px; }',
            '  .form-input, .form-select, .form-textarea { width: 100%; padding: 10px 12px; font-size: 15px; border: 1px solid #d0d0d0; border-radius: 8px; outline: none; transition: border-color 0.2s; font-family: inherit; background: #fff; }',
            '  .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: #500000; }',
            '  .form-textarea { resize: vertical; min-height: 60px; }',
            '  .type-toggle { display: flex; border: 2px solid #500000; border-radius: 8px; overflow: hidden; }',
            '  .type-toggle label { flex: 1; text-align: center; padding: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s, color 0.2s; color: #500000; background: #fff; }',
            '  .type-toggle input { display: none; }',
            '  .type-toggle input:checked + label { background: #500000; color: #fff; }',
            '  .other-input { display: none; margin-top: 6px; }',
            '  .other-input.visible { display: block; }',
            '  .form-submit { width: 100%; padding: 12px; font-size: 15px; font-weight: 600; background: #500000; color: #fff; border: none; border-radius: 8px; cursor: pointer; margin-top: 8px; transition: background 0.2s; }',
            '  .form-submit:hover { background: #6b0000; }',
            '  .form-submit:disabled { background: #999; cursor: not-allowed; }',
            '  .form-msg { padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 12px; display: none; }',
            '  .form-msg.error { display: block; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }',
            '  .form-msg.success { display: block; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }',
            '  .form-error { border-color: #ef4444 !important; background: #fef2f2 !important; }',
            '  @media (max-width: 700px) {',
            '    .fab { bottom: 20px; right: 20px; width: 54px; height: 54px; font-size: 28px; line-height: 54px; }',
            '    .fab-tooltip { bottom: 86px; right: 12px; }',
            '    .modal-overlay { padding: 0; }',
            '    .ride-form-panel { max-height: 90vh; padding: 20px 16px 16px; }',
            '  }',
            '</style>',
            '</head>',
            '<body>',
            '<div class="container">',
            '  <div class="hero">',
            '    <h1>Aggie Connect</h1>',
            '    <p class="subtitle">' + subtitle + '</p>',
            '    <p class="tagline">Find someone going your way. Updated in real time from WhatsApp groups. <a href="/faq">FAQs &mdash; how, why, what?</a></p>',
            '  </div>',
            '  <div class="legend">',
            '    <div class="legend-date" id="sticky-date"></div>',
            '    <div class="legend-item">✋ Looking for ride</div>',
            '    <div class="legend-item">🚗 Offering ride</div>',
            '    <div class="legend-right">',
            authHtml,
            '      <div class="clock"><span id="live-time"></span> CT</div>',
            '    </div>',
            '  </div>',
            isLoggedIn ? '' : '  <div class="auth-banner" id="auth-banner"><span>🔒 Names and phone numbers are redacted. &nbsp;<a href="/login">Sign in with your @tamu.edu email</a>&nbsp; to see full contact details.</span><button class="auth-banner-close" onclick="document.getElementById(\'auth-banner\').style.display=\'none\'">&times;</button></div>',
            dateBlocksHtml,
            '  <div class="footer">' + totalCount + ' total requests &middot; ' + activeCount + ' groups monitored &middot; <a href="/faq">FAQ</a> &middot; <a href="/terms">Terms</a> &middot; v3.2</div>',
            '</div>',
            '',
            '<!-- FAB -->',
            '<button class="fab" id="ride-fab" title="Post a ride" aria-label="Post a ride">+</button>',
            '',
            '<!-- Sign-in tooltip (unauthenticated) -->',
            '<div class="fab-tooltip" id="fab-tooltip">',
            '  <a href="/login">Sign in with @tamu.edu</a> to offer or post a ride',
            '  <div class="fab-tooltip-arrow"></div>',
            '</div>',
            '',
            '<!-- Ride form modal (authenticated) -->',
            '<div class="modal-overlay" id="ride-modal">',
            '  <div class="ride-form-panel">',
            '    <h2>Post a Ride</h2>',
            '    <div class="form-msg" id="form-msg"></div>',
            '    <form id="ride-form" autocomplete="off">',
            '      <div class="form-group">',
            '        <div class="form-label">I am... <span style="color:#ef4444">*</span></div>',
            '        <div class="type-toggle">',
            '          <input type="radio" name="type" id="type-need" value="need">',
            '          <label for="type-need">✋ Looking for a ride</label>',
            '          <input type="radio" name="type" id="type-offer" value="offer">',
            '          <label for="type-offer">🚗 Offering a ride</label>',
            '        </div>',
            '      </div>',
            '      <div class="form-group">',
            '        <label class="form-label" for="origin">From <span style="color:#ef4444">*</span></label>',
            '        <select class="form-select" id="origin" name="origin">',
            '          <option value="">Select origin...</option>',
            '          <option value="College Station">College Station</option>',
            '          <option value="Houston">Houston</option>',
            '          <option value="Houston IAH">Houston IAH</option>',
            '          <option value="Houston Hobby">Houston Hobby</option>',
            '          <option value="Dallas">Dallas</option>',
            '          <option value="Dallas DFW">Dallas DFW</option>',
            '          <option value="Fort Worth">Fort Worth</option>',
            '          <option value="Austin">Austin</option>',
            '          <option value="Austin Airport">Austin Airport</option>',
            '          <option value="San Antonio">San Antonio</option>',
            '          <option value="Other">Other</option>',
            '        </select>',
            '        <input class="form-input other-input" id="origin-other" name="originOther" placeholder="Enter city/location" maxlength="100">',
            '      </div>',
            '      <div class="form-group">',
            '        <label class="form-label" for="destination">To <span style="color:#ef4444">*</span></label>',
            '        <select class="form-select" id="destination" name="destination">',
            '          <option value="">Select destination...</option>',
            '          <option value="College Station">College Station</option>',
            '          <option value="Houston">Houston</option>',
            '          <option value="Houston IAH">Houston IAH</option>',
            '          <option value="Houston Hobby">Houston Hobby</option>',
            '          <option value="Dallas">Dallas</option>',
            '          <option value="Dallas DFW">Dallas DFW</option>',
            '          <option value="Fort Worth">Fort Worth</option>',
            '          <option value="Austin">Austin</option>',
            '          <option value="Austin Airport">Austin Airport</option>',
            '          <option value="San Antonio">San Antonio</option>',
            '          <option value="Other">Other</option>',
            '        </select>',
            '        <input class="form-input other-input" id="dest-other" name="destOther" placeholder="Enter city/location" maxlength="100">',
            '      </div>',
            '      <div class="form-group">',
            '        <label class="form-label" for="ride-date">Date <span style="color:#ef4444">*</span></label>',
            '        <input class="form-input" type="date" id="ride-date" name="date" required>',
            '      </div>',
            '      <div class="form-group">',
            '        <label class="form-label" for="ride-name">Name <span style="color:#ef4444">*</span></label>',
            '        <input class="form-input" type="text" id="ride-name" name="name" placeholder="Your name" required maxlength="100">',
            '      </div>',
            '      <div class="form-group">',
            '        <label class="form-label" for="ride-phone">Phone Number <span style="color:#ef4444">*</span></label>',
            '        <input class="form-input" type="tel" id="ride-phone" name="phone" placeholder="(XXX) XXX-XXXX" required maxlength="20">',
            '      </div>',
            '      <div class="form-group">',
            '        <label class="form-label" for="ride-time">Preferred Time <span style="color:#999;font-weight:400">(optional)</span></label>',
            '        <input class="form-input" type="time" id="ride-time" name="time">',
            '      </div>',
            '      <div class="form-group">',
            '        <label class="form-label" for="ride-comments">Comments <span style="color:#999;font-weight:400">(seats, charge, etc.)</span></label>',
            '        <textarea class="form-textarea" id="ride-comments" name="comments" placeholder="e.g. 2 seats available, splitting gas" maxlength="500"></textarea>',
            '      </div>',
            '      <button class="form-submit" type="submit" id="form-submit-btn">Submit</button>',
            '    </form>',
            '  </div>',
            '</div>',
            '',
            '<script>',
            '(function() {',
            '  function updateClock() {',
            '    var now = new Date();',
            '    var opts = { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Chicago" };',
            '    var el = document.getElementById("live-time");',
            '    if (el) el.textContent = now.toLocaleTimeString("en-US", opts);',
            '  }',
            '  updateClock();',
            '  setInterval(updateClock, 30000);',
            '',
            '  // Sticky date: show current date in legend bar when date-label scrolls out of view',
            '  var stickyEl = document.getElementById("sticky-date");',
            '  var dateBlocks = document.querySelectorAll(".date-block");',
            '  if (stickyEl && dateBlocks.length) {',
            '    var legend = document.querySelector(".legend");',
            '    function updateStickyDate() {',
            '      var legendBottom = legend.getBoundingClientRect().bottom;',
            '      var current = null;',
            '      for (var i = 0; i < dateBlocks.length; i++) {',
            '        var rect = dateBlocks[i].getBoundingClientRect();',
            '        if (rect.top < legendBottom + 10 && rect.bottom > legendBottom) {',
            '          var label = dateBlocks[i].querySelector(".date-label");',
            '          if (label && label.getBoundingClientRect().top < legendBottom) {',
            '            var dt = label.querySelector(".date-text");',
            '            var sm = label.querySelector(".date-summary");',
            '            current = (dt ? dt.textContent.trim() : label.textContent.trim().split("\\n")[0]) + (sm ? " \\u00B7 " + sm.textContent.trim() : "");',
            '          }',
            '        }',
            '      }',
            '      if (current) {',
            '        stickyEl.textContent = current;',
            '        stickyEl.classList.add("visible");',
            '      } else {',
            '        stickyEl.classList.remove("visible");',
            '      }',
            '    }',
            '    window.addEventListener("scroll", updateStickyDate, { passive: true });',
            '  }',
            '',
            '  // ── FAB + Form Logic ──────────────────────',
            '  var isLoggedIn = !!document.querySelector(".auth-email-display");',
            '  var fab = document.getElementById("ride-fab");',
            '  var tooltip = document.getElementById("fab-tooltip");',
            '  var modal = document.getElementById("ride-modal");',
            '  var form = document.getElementById("ride-form");',
            '  var msgEl = document.getElementById("form-msg");',
            '  var submitBtn = document.getElementById("form-submit-btn");',
            '',
            '  // Set date min to today',
            '  var dateInput = document.getElementById("ride-date");',
            '  if (dateInput) {',
            '    var d = new Date();',
            '    var todayStr = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");',
            '    dateInput.setAttribute("min", todayStr);',
            '    dateInput.value = todayStr;',
            '  }',
            '',
            '  // FAB click',
            '  fab.addEventListener("click", function() {',
            '    if (!isLoggedIn) {',
            '      var vis = tooltip.classList.contains("visible");',
            '      tooltip.classList.toggle("visible", !vis);',
            '      return;',
            '    }',
            '    var isOpen = modal.classList.contains("active");',
            '    if (isOpen) {',
            '      modal.classList.remove("active");',
            '      fab.classList.remove("open");',
            '    } else {',
            '      tooltip.classList.remove("visible");',
            '      modal.classList.add("active");',
            '      fab.classList.add("open");',
            '      msgEl.className = "form-msg";',
            '      msgEl.textContent = "";',
            '    }',
            '  });',
            '',
            '  // Close modal on overlay click',
            '  modal.addEventListener("click", function(e) {',
            '    if (e.target === modal) {',
            '      modal.classList.remove("active");',
            '      fab.classList.remove("open");',
            '    }',
            '  });',
            '',
            '  // Close on Escape',
            '  document.addEventListener("keydown", function(e) {',
            '    if (e.key === "Escape") {',
            '      modal.classList.remove("active");',
            '      fab.classList.remove("open");',
            '      tooltip.classList.remove("visible");',
            '    }',
            '  });',
            '',
            '  // Close tooltip on outside click',
            '  document.addEventListener("click", function(e) {',
            '    if (!fab.contains(e.target) && !tooltip.contains(e.target)) {',
            '      tooltip.classList.remove("visible");',
            '    }',
            '  });',
            '',
            '  // "Other" toggle for origin/destination',
            '  document.getElementById("origin").addEventListener("change", function() {',
            '    var oi = document.getElementById("origin-other");',
            '    if (this.value === "Other") { oi.classList.add("visible"); oi.focus(); }',
            '    else { oi.classList.remove("visible"); oi.value = ""; }',
            '  });',
            '  document.getElementById("destination").addEventListener("change", function() {',
            '    var di = document.getElementById("dest-other");',
            '    if (this.value === "Other") { di.classList.add("visible"); di.focus(); }',
            '    else { di.classList.remove("visible"); di.value = ""; }',
            '  });',
            '',
            '  // Form submit',
            '  form.addEventListener("submit", async function(e) {',
            '    e.preventDefault();',
            '    msgEl.className = "form-msg";',
            '    msgEl.textContent = "";',
            '    submitBtn.disabled = true;',
            '    submitBtn.textContent = "Submitting...";',
            '',
            '    // Clear previous error highlights',
            '    var fieldMap = { type: ".type-toggle", origin: "#origin", destination: "#destination", date: "#ride-date", name: "#ride-name", phone: "#ride-phone" };',
            '    Object.values(fieldMap).forEach(function(sel) {',
            '      var el = document.querySelector(sel);',
            '      if (el) el.classList.remove("form-error");',
            '    });',
            '',
            '    function showError(msg, fields) {',
            '      msgEl.className = "form-msg error";',
            '      msgEl.textContent = msg;',
            '      if (fields && fields.length) {',
            '        fields.forEach(function(f) {',
            '          var el = document.querySelector(fieldMap[f]);',
            '          if (el) el.classList.add("form-error");',
            '        });',
            '      }',
            '      document.querySelector(".ride-form-panel").scrollTo({ top: 0, behavior: "smooth" });',
            '      submitBtn.disabled = false;',
            '      submitBtn.textContent = "Submit";',
            '    }',
            '',
            '    var typeEl = form.querySelector(\'input[name="type"]:checked\');',
            '    if (!typeEl) {',
            '      showError("Please select Looking or Offering.", ["type"]);',
            '      return;',
            '    }',
            '',
            '    var body = {',
            '      type: typeEl.value,',
            '      origin: form.querySelector("#origin").value,',
            '      destination: form.querySelector("#destination").value,',
            '      date: form.querySelector("#ride-date").value,',
            '      name: form.querySelector("#ride-name").value.trim(),',
            '      phone: form.querySelector("#ride-phone").value.trim(),',
            '      time: form.querySelector("#ride-time").value || "",',
            '      comments: form.querySelector("#ride-comments").value.trim(),',
            '      originOther: (form.querySelector("#origin-other").value || "").trim(),',
            '      destOther: (form.querySelector("#dest-other").value || "").trim()',
            '    };',
            '',
            '    try {',
            '      var resp = await fetch("/submit", {',
            '        method: "POST",',
            '        headers: { "Content-Type": "application/json" },',
            '        body: JSON.stringify(body)',
            '      });',
            '      var data = await resp.json();',
            '',
            '      if (!resp.ok) {',
            '        if (resp.status === 401) { window.location.href = "/login"; return; }',
            '        showError(data.error || "Something went wrong.", data.fields || []);',
            '        return;',
            '      }',
            '',
            '      msgEl.className = "form-msg success";',
            '      var matchMsg = data.matches > 0 ? " We found " + data.matches + " potential match(es)!" : "";',
            '      msgEl.textContent = "Ride posted successfully!" + matchMsg;',
            '      submitBtn.textContent = "Done!";',
            '      document.querySelector(".ride-form-panel").scrollTo({ top: 0, behavior: "smooth" });',
            '      setTimeout(function() {',
            '        modal.classList.remove("active");',
            '        fab.classList.remove("open");',
            '        window.location.reload();',
            '      }, 2000);',
            '    } catch (err) {',
            '      showError("Network error. Please try again.", []);',
            '    }',
            '  });',
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
            GA_TAG,
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
            '  .msg-time { font-style: normal; color: #bbb; font-size: 11px; margin-left: 4px; }',
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
