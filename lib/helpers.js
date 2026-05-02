/**
 * Shared utility / formatting functions for dashboard views
 */

var GA_TAG = [
    '<!-- Google tag (gtag.js) -->',
    '<script async src="https://www.googletagmanager.com/gtag/js?id=G-MC6FDBQ4MZ"></script>',
    '<script>',
    '  window.dataLayer = window.dataLayer || [];',
    '  function gtag(){dataLayer.push(arguments);}',
    "  gtag('js', new Date());",
    "  gtag('config', 'G-MC6FDBQ4MZ');",
    '</script>'
].join('\n');

function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

var ROUTE_SHORT = {
    'college station': 'CS', 'cstat': 'CS', 'c station': 'CS',
    'houston': 'HOU', 'houston iah': 'IAH', 'houston hobby': 'HOU Hobby',
    'dallas': 'Dallas', 'dallas dfw': 'DFW', 'dallas love': 'DAL',
    'austin': 'Austin', 'austin airport': 'AUS',
    'san antonio': 'SA', 'waco': 'Waco', 'bryan': 'Bryan',
    'denton': 'Denton', 'towerpark': 'Towerpark'
};

function shortRoute(place) {
    if (!place) return '?';
    return ROUTE_SHORT[place.toLowerCase().trim()] || place;
}

function redactPhone(phone) {
    if (!phone) return '';
    var s = String(phone).trim();
    var digits = s.replace(/\D/g, '');
    if (digits.length <= 3) return s;
    var prefix = s.startsWith('+') ? '+' : '';
    return prefix + digits.slice(0, 2) + '*'.repeat(digits.length - 3) + digits.slice(-1);
}

function redactName(name) {
    if (!name) return '';
    var s = String(name).trim();
    if (s.length <= 2) return s;
    return s[0] + '*'.repeat(s.length - 2) + s[s.length - 1];
}

function redactContact(contact) {
    if (!contact) return '';
    var s = String(contact).trim();
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
    var date = new Date(d + 'T00:00:00');
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    var base = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (date.getTime() === today.getTime()) return 'Today, ' + base;
    if (date.getTime() === tomorrow.getTime()) return 'Tomorrow, ' + base;
    return base;
}

function shortDate(d) {
    if (!d) return '';
    var date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

// ── Timezone helpers ───────────────────────────────────────────────────
// Post timestamps shift to viewer TZ; ride times stay anchored to Central
// (origin city). When viewer ≠ Central, parenthetical shows the other side.

var TZ_MAP = {
    CT: { ianaTz: 'America/Chicago',     label: 'Central' },
    ET: { ianaTz: 'America/New_York',    label: 'Eastern' },
    PT: { ianaTz: 'America/Los_Angeles', label: 'Pacific' }
};

function parseTzPref(req) {
    var raw = req && req.cookies && req.cookies.tz_pref;
    if (raw === 'ET' || raw === 'PT' || raw === 'CT') return raw;
    return 'CT';
}

function tzMeta(tzPref) {
    return TZ_MAP[tzPref] || TZ_MAP.CT;
}

// Format a Date object in a given IANA TZ as "Apr 30, 10:30 PM CDT"
function _fmtInTz(d, ianaTz) {
    if (!d || isNaN(d.getTime())) return '';
    var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: ianaTz,
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
        timeZoneName: 'short'
    }).formatToParts(d);
    var m = {};
    for (var i = 0; i < parts.length; i++) {
        if (parts[i].type !== 'literal') m[parts[i].type] = parts[i].value;
    }
    return (m.month || '') + ' ' + (m.day || '') + ', ' +
           (m.hour || '') + ':' + (m.minute || '') + ' ' + (m.dayPeriod || '') +
           ' ' + (m.timeZoneName || '');
}

// Just hour:minute + tz abbrev, no date — used for parentheticals
function _fmtTimeOnlyInTz(d, ianaTz) {
    if (!d || isNaN(d.getTime())) return '';
    var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: ianaTz,
        hour: 'numeric', minute: '2-digit', hour12: true,
        timeZoneName: 'short'
    }).formatToParts(d);
    var m = {};
    for (var i = 0; i < parts.length; i++) {
        if (parts[i].type !== 'literal') m[parts[i].type] = parts[i].value;
    }
    return (m.hour || '') + ':' + (m.minute || '') + ' ' + (m.dayPeriod || '') +
           ' ' + (m.timeZoneName || '');
}

// Post timestamp display. Default Central → just "Apr 30, 10:30 PM CDT".
// Viewer ≠ Central → "Apr 30, 11:30 PM EDT (10:30 PM CDT)".
function fmtMsgTimeTz(isoStr, tzPref) {
    if (!isoStr) return '';
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    var meta = tzMeta(tzPref);
    var primary = _fmtInTz(d, meta.ianaTz);
    if (tzPref === 'CT') return primary;
    var central = _fmtTimeOnlyInTz(d, 'America/Chicago');
    return primary + ' (' + central + ')';
}

// Ride date label: always anchored to Central, regardless of viewer TZ.
// Same output as formatDate for now (formatDate already uses local Date math
// against a YYYY-MM-DD string; ride dates are calendar dates not timestamps).
function fmtRideDateTz(dateStr /*, tzPref */) {
    return formatDate(dateStr);
}

// Ride time: always Central. If viewer TZ ≠ CT, append parenthetical with
// viewer-TZ time. Combine date + time so DST is correct.
function fmtRideTimeTz(timeStr, tzPref, dateStr) {
    if (!timeStr) return '';
    if (!/^\d{1,2}:\d{2}$/.test(timeStr)) {
        // fuzzy label like "evening" — leave as-is
        return timeStr;
    }
    var primary = formatTime(timeStr) + ' CDT';
    // Build a Date anchored to Central. Using a calendar date + HH:MM, we
    // compute the equivalent UTC instant by shifting through the offset.
    var dStr = dateStr || (function() {
        var n = new Date();
        return n.getFullYear() + '-' +
               String(n.getMonth() + 1).padStart(2, '0') + '-' +
               String(n.getDate()).padStart(2, '0');
    })();
    // Construct a Date at that wall-clock time in Central.
    // Trick: build an ISO string with no offset, then compute the offset
    // Central had at that instant and adjust.
    var naive = new Date(dStr + 'T' + timeStr + ':00');
    if (isNaN(naive.getTime())) return primary;
    // Compute Central offset at this moment in minutes.
    var centralStr = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago', hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(naive);
    var cm = {};
    for (var i = 0; i < centralStr.length; i++) {
        if (centralStr[i].type !== 'literal') cm[centralStr[i].type] = centralStr[i].value;
    }
    var centralAsUtc = Date.UTC(+cm.year, +cm.month - 1, +cm.day, +cm.hour === 24 ? 0 : +cm.hour, +cm.minute, +cm.second);
    var offsetMin = (centralAsUtc - naive.getTime()) / 60000;
    var trueInstant = new Date(naive.getTime() - offsetMin * 60000);
    // Now format in Central (gets DST-correct CDT/CST) and re-derive the
    // primary string that way for accuracy.
    primary = _fmtTimeOnlyInTz(trueInstant, 'America/Chicago');
    if (tzPref === 'CT') return primary;
    var meta = tzMeta(tzPref);
    var alt = _fmtTimeOnlyInTz(trueInstant, meta.ianaTz);
    return primary + ' (' + alt + ')';
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

function datesOverlap(a, b, strict) {
    if (!a.ride_plan_date && !b.ride_plan_date) return true;
    if (!a.ride_plan_date || !b.ride_plan_date) return !strict;
    if (a.ride_plan_date === b.ride_plan_date) return true;
    if (a.date_fuzzy && (a.possible_dates || []).includes(b.ride_plan_date)) return true;
    if (b.date_fuzzy && (b.possible_dates || []).includes(a.ride_plan_date)) return true;
    if (strict) return false;
    var da = new Date(a.ride_plan_date);
    var db = new Date(b.ride_plan_date);
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

module.exports = {
    GA_TAG,
    escHtml,
    shortRoute,
    redactPhone,
    redactName,
    redactContact,
    displayName,
    displayPhone,
    formatDate,
    shortDate,
    formatTime,
    digestFormatPhone,
    digestFirstName,
    phoneDigitsOnly,
    formatMsgTime,
    parseTzPref,
    tzMeta,
    fmtMsgTimeTz,
    fmtRideDateTz,
    fmtRideTimeTz,
    generateRiderMessage,
    generateDriverMessage,
    generateSameWayMessage,
    datesOverlap,
    buildClusters
};
