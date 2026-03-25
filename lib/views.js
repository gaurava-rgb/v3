/**
 * HTML rendering functions for dashboard views.
 */

var h = require('./helpers');

// ── Auth Pages ──────────────────────────────────────────────────────────

function renderLoginPage(errorMsg, prefillEmail, redirect) {
    var errorHtml = errorMsg
        ? '<div class="auth-error">' + h.escHtml(errorMsg) + '</div>'
        : '';
    return [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '<head>',
        h.GA_TAG,
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
        '    <input type="hidden" name="redirect" value="' + h.escHtml(redirect || '') + '">',
        '    <label class="auth-label" for="email">Email address</label>',
        '    <input class="auth-input" type="email" id="email" name="email"',
        '           placeholder="netid@tamu.edu" required autocomplete="email"',
        '           value="' + h.escHtml(prefillEmail || '') + '" autofocus>',
        '    <button class="auth-btn" type="submit">Send Verification Code</button>',
        '  </form>',
        '  <div class="auth-footer">Only @tamu.edu emails are accepted</div>',
        '</div>',
        '</body>',
        '</html>'
    ].join('\n');
}

function renderVerifyPage(email, errorMsg, redirect) {
    var errorHtml = errorMsg
        ? '<div class="auth-error">' + h.escHtml(errorMsg) + '</div>'
        : '';
    return [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '<head>',
        h.GA_TAG,
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
        '     <span class="auth-email">' + h.escHtml(email) + '</span></p>',
        errorHtml,
        '  <form method="POST" action="/verify">',
        '    <input type="hidden" name="email" value="' + h.escHtml(email) + '">',
        '    <input type="hidden" name="redirect" value="' + h.escHtml(redirect || '') + '">',
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

// ── Phone Verification Pages ────────────────────────────────────────────

var PHONE_STYLE = [
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
    '  .auth-success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0;',
    '                  border-radius: 8px; padding: 10px 14px; font-size: 13px;',
    '                  margin-bottom: 16px; }',
    '  .auth-footer { text-align: center; font-size: 12px; color: #999;',
    '                  margin-top: 16px; }',
    '  .auth-footer a { color: #500000; text-decoration: none; }',
    '  .auth-footer a:hover { text-decoration: underline; }',
    '  .phone-row { display: flex; gap: 8px; }',
    '  .phone-prefix { width: 60px; padding: 10px 8px; font-size: 15px; text-align: center;',
    '                   border: 1px solid #d0d0d0; border-radius: 8px; background: #f9f9f9;',
    '                   color: #555; flex-shrink: 0; }',
    '  .phone-input { flex: 1; }',
    '  .verify-input { text-align: center; letter-spacing: 6px; font-weight: 600; font-size: 20px; }'
].join('\n');

function renderPhonePage(errorMsg, email) {
    var errorHtml = errorMsg
        ? '<div class="auth-error">' + h.escHtml(errorMsg) + '</div>'
        : '';
    return [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '<head>',
        h.GA_TAG,
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<title>Verify Phone — RideSplit</title>',
        '<style>',
        PHONE_STYLE,
        '</style>',
        '</head>',
        '<body>',
        '<div class="auth-card">',
        '  <h1>Verify Your Phone</h1>',
        '  <p class="auth-subtitle">Add your phone number to see contact details for ride posts.</p>',
        errorHtml,
        '  <form method="POST" action="/phone">',
        '    <label class="auth-label" for="phone">Phone number</label>',
        '    <div class="phone-row">',
        '      <input class="phone-prefix" type="text" value="+1" readonly>',
        '      <input class="auth-input phone-input" type="tel" id="phone" name="phone"',
        '             placeholder="9791234567" required pattern="[0-9]{10}"',
        '             maxlength="10" inputmode="numeric" autofocus>',
        '    </div>',
        '    <button class="auth-btn" type="submit">Send Verification Code</button>',
        '  </form>',
        '  <div class="auth-footer">',
        '    <a href="/clusters">Skip for now</a>',
        '  </div>',
        '</div>',
        '</body>',
        '</html>'
    ].join('\n');
}

function renderPhoneVerifyPage(phone, errorMsg) {
    var errorHtml = errorMsg
        ? '<div class="auth-error">' + h.escHtml(errorMsg) + '</div>'
        : '';
    var displayPhone = phone ? '+1 ' + phone.slice(0, 3) + '-' + phone.slice(3, 6) + '-' + phone.slice(6) : '';
    return [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '<head>',
        h.GA_TAG,
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<title>Verify Phone — RideSplit</title>',
        '<style>',
        PHONE_STYLE,
        '</style>',
        '</head>',
        '<body>',
        '<div class="auth-card">',
        '  <h1>Enter code</h1>',
        '  <p class="auth-subtitle">We sent a code to<br><strong>' + h.escHtml(displayPhone) + '</strong></p>',
        errorHtml,
        '  <form method="POST" action="/phone/verify">',
        '    <input type="hidden" name="phone" value="' + h.escHtml(phone || '') + '">',
        '    <label class="auth-label" for="code">Verification code</label>',
        '    <input class="auth-input verify-input" type="text" id="code" name="code"',
        '           placeholder="000000" maxlength="6" pattern="[0-9]{6}"',
        '           inputmode="numeric" autocomplete="one-time-code" required autofocus>',
        '    <button class="auth-btn" type="submit">Verify</button>',
        '  </form>',
        '  <div class="auth-footer">',
        '    <a href="/phone">Different number</a>',
        '  </div>',
        '</div>',
        '</body>',
        '</html>'
    ].join('\n');
}

// ── Static Page Shell ───────────────────────────────────────────────────

function renderStaticPage(title, bodyHtml) {
    return [
        '<!DOCTYPE html><html lang="en"><head>',
        h.GA_TAG,
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

// ── Digest Cards ────────────────────────────────────────────────────────

function renderMatchCard(match) {
    var need = match.need;
    var offer = match.offer;

    var needName = need.sender_name || need.source_contact || 'Unknown';
    var offerName = offer.sender_name || offer.source_contact || 'Unknown';
    var needPhone = h.digestFormatPhone(need.source_contact);
    var offerPhone = h.digestFormatPhone(offer.source_contact);
    var needDigits = h.phoneDigitsOnly(need.source_contact);
    var offerDigits = h.phoneDigitsOnly(offer.source_contact);

    var date = need.ride_plan_date || offer.ride_plan_date;
    var origin = need.request_origin || offer.request_origin || '?';
    var dest = need.request_destination || offer.request_destination || '?';

    var qualityEmoji = { strong: '\uD83D\uDFE2', medium: '\uD83D\uDFE1', low: '\uD83D\uDD34' }[match.matchQuality] || '\u26AA';

    var riderMsg = h.generateRiderMessage(need, offer);
    var driverMsg = h.generateDriverMessage(need, offer);

    var groupLine;
    if (need.groupName === offer.groupName) {
        groupLine = 'Same group: ' + h.escHtml(need.groupName);
    } else {
        groupLine = h.escHtml(need.groupName) + ' / ' + h.escHtml(offer.groupName);
    }

    var handledClass = match.notified ? ' handled' : '';
    var handledBadge = match.notified ? ' <span class="handled-badge">Handled</span>' : '';
    var markBtn = !match.notified
        ? '<button class="btn btn-mark" onclick="markHandled(\'' + match.matchId + '\')">Mark Handled</button>'
        : '';

    var dateLabel = date ? h.formatDate(date) : 'Flexible date';

    var parts = [];
    parts.push('<div class="match-card' + handledClass + '" id="match-' + match.matchId + '">');
    parts.push('  <div class="match-date">' + h.escHtml(dateLabel) + '</div>');
    parts.push('  <div class="match-route">' + h.escHtml(origin) + ' &rarr; ' + h.escHtml(dest) + handledBadge + '</div>');
    parts.push('  <div class="match-quality">' + qualityEmoji + ' ' + h.escHtml(match.matchQuality) + '</div>');
    parts.push('  <div class="match-group">' + groupLine + '</div>');

    parts.push('  <div class="match-person">');
    parts.push('    <div class="match-person-label">\uD83D\uDC4B Looking for a ride</div>');
    parts.push('    <div class="match-person-name">' + h.escHtml(needName) + '</div>');
    parts.push('    <div class="match-person-phone">' + h.escHtml(needPhone) + '</div>');
    if (need.raw_message) {
        parts.push('    <div class="match-person-msg">&ldquo;' + h.escHtml(need.raw_message) + '&rdquo; <span class="msg-time">' + h.escHtml(h.formatMsgTime(need.created_at)) + '</span></div>');
    }
    parts.push('    <div class="pre-msg">' + h.escHtml(riderMsg) + '</div>');
    if (needDigits) {
        parts.push('    <a class="wa-link" href="https://wa.me/' + needDigits + '?text=' + encodeURIComponent(riderMsg) + '" target="_blank">\uD83D\uDCAC Message ' + h.escHtml(h.digestFirstName(need.sender_name)) + '</a>');
    }
    parts.push('  </div>');

    parts.push('  <div class="match-person">');
    parts.push('    <div class="match-person-label">\uD83D\uDE97 Offering a ride</div>');
    parts.push('    <div class="match-person-name">' + h.escHtml(offerName) + '</div>');
    parts.push('    <div class="match-person-phone">' + h.escHtml(offerPhone) + '</div>');
    if (offer.raw_message) {
        parts.push('    <div class="match-person-msg">&ldquo;' + h.escHtml(offer.raw_message) + '&rdquo; <span class="msg-time">' + h.escHtml(h.formatMsgTime(offer.created_at)) + '</span></div>');
    }
    parts.push('    <div class="pre-msg">' + h.escHtml(driverMsg) + '</div>');
    if (offerDigits) {
        parts.push('    <a class="wa-link" href="https://wa.me/' + offerDigits + '?text=' + encodeURIComponent(driverMsg) + '" target="_blank">\uD83D\uDCAC Message ' + h.escHtml(h.digestFirstName(offer.sender_name)) + '</a>');
    }
    parts.push('  </div>');

    parts.push('  ' + markBtn);
    parts.push('</div>');
    return parts.join('\n');
}

function renderClusterCard(cluster) {
    var dateLabel = cluster.repDate ? h.formatDate(cluster.repDate) : 'Flexible date';
    var parts = [];

    parts.push('<div class="cluster-card">');
    parts.push('  <div class="match-date">' + h.escHtml(dateLabel) + '</div>');
    parts.push('  <div class="match-route">' + h.escHtml(cluster.origin) + ' &rarr; ' + h.escHtml(cluster.destination) + '</div>');
    parts.push('  <div class="cluster-count">\uD83D\uDC65 ' + cluster.needs.length + ' people looking for rides</div>');

    if (cluster.offers.length > 0) {
        parts.push('  <div class="cluster-has-offer">\uD83D\uDE97 ' + cluster.offers.length + ' offering — also shown in matches above</div>');
    }

    for (var i = 0; i < cluster.needs.length; i++) {
        var person = cluster.needs[i];
        var name = person.sender_name || person.source_contact || 'Unknown';
        var phone = h.digestFormatPhone(person.source_contact);
        var digits = h.phoneDigitsOnly(person.source_contact);
        var msg = h.generateSameWayMessage(person, cluster);
        var groupName = person.groupName || 'Unknown Group';

        parts.push('  <div class="match-person">');
        parts.push('    <div class="match-person-name">' + h.escHtml(name) + '</div>');
        parts.push('    <div class="match-person-phone">' + h.escHtml(phone) + '</div>');
        parts.push('    <div class="cluster-group-name" style="font-size:12px;color:#999;">' + h.escHtml(groupName) + '</div>');
        if (person.raw_message) {
            parts.push('    <div class="match-person-msg">&ldquo;' + h.escHtml(person.raw_message) + '&rdquo; <span class="msg-time">' + h.escHtml(h.formatMsgTime(person.created_at)) + '</span></div>');
        }
        parts.push('    <div class="pre-msg">' + h.escHtml(msg) + '</div>');
        if (digits) {
            parts.push('    <a class="wa-link" href="https://wa.me/' + digits + '?text=' + encodeURIComponent(msg) + '" target="_blank">\uD83D\uDCAC Message ' + h.escHtml(h.digestFirstName(person.sender_name)) + '</a>');
        }
        parts.push('  </div>');
    }

    parts.push('</div>');
    return parts.join('\n');
}

// ── Public Board: Date Table ────────────────────────────────────────────

function groupByDirection(requests) {
    var collegeStation = 'College Station';
    var leaving = [];
    var arriving = [];
    var others = [];

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
    var dateLabel = dateKey === 'flexible' ? 'Flexible Dates' : h.formatDate(dateKey);
    var isToday = dateLabel.startsWith('Today');
    var todayBadge = isToday ? ' <span class="today-badge">Today</span>' : '';

    var grouped = groupByDirection(requests);
    var summaryParts = [];
    if (grouped.leaving.length > 0) summaryParts.push(grouped.leaving.length + ' leaving');
    if (grouped.arriving.length > 0) summaryParts.push(grouped.arriving.length + ' arriving');
    if (grouped.others.length > 0) summaryParts.push(grouped.others.length + ' other' + (grouped.others.length > 1 ? 's' : ''));
    var summary = summaryParts.length > 0 ? '<span class="date-summary">' + summaryParts.join(' &middot; ') + '</span>' : '';

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
        var emoji = isOffer ? '\uD83D\uDE97' : '\u270B';
        var name = h.displayName(r, isLoggedIn);
        var phone = h.displayPhone(r, isLoggedIn);
        var routeFull = h.escHtml(r.request_origin || '?') + ' \u2192 ' + h.escHtml(r.request_destination || '?');
        var routeShort = h.escHtml(h.shortRoute(r.request_origin)) + ' \u2192 ' + h.escHtml(h.shortRoute(r.request_destination));
        var route = '<span class="route-full">' + routeFull + '</span><span class="route-short">' + routeShort + '</span>';
        var msg = r.raw_message ? h.escHtml(r.raw_message) : '';
        var depart = '';
        var departMobile = '';
        var sd = h.shortDate(r.ride_plan_date);
        if (r.ride_plan_time) {
            if (/^\d{1,2}:\d{2}$/.test(r.ride_plan_time)) {
                depart = (r.time_fuzzy ? '~' : '') + h.formatTime(r.ride_plan_time);
            } else {
                depart = r.ride_plan_time;
            }
            departMobile = sd ? sd + ', ' + depart : depart;
        } else {
            departMobile = sd || '';
        }
        var sentTime = h.formatMsgTime(r.created_at);
        return '<tr class="' + dirClass + '">' +
            '<td class="col-type">' + emoji + '</td>' +
            '<td class="col-name">' + h.escHtml(name) + '</td>' +
            '<td class="col-phone">' + h.escHtml(phone) + (isLoggedIn && r.source_contact ? ' <a href="https://wa.me/' + h.escHtml(r.source_contact) + '" target="_blank" rel="noopener" title="Chat on WhatsApp" class="wa-link" onclick="logWaClick(\'' + h.escHtml((r.request_origin || '') + ' to ' + (r.request_destination || '')) + '\',\'' + h.escHtml(r.request_type || '') + '\',\'' + h.escHtml(r.ride_plan_date || '') + '\')"><svg viewBox="0 0 32 32" class="wa-icon"><path fill="#25D366" d="M16.01 2.64C8.63 2.64 2.65 8.6 2.65 15.97c0 2.35.62 4.65 1.8 6.68L2.5 29.36l6.89-1.81a13.34 13.34 0 006.6 1.74h.01c7.37 0 13.36-5.97 13.36-13.33 0-3.56-1.39-6.91-3.9-9.43a13.27 13.27 0 00-9.45-3.89zm0 24.38a11.07 11.07 0 01-5.64-1.54l-.4-.24-4.2 1.1 1.12-4.1-.26-.42a11.03 11.03 0 01-1.7-5.86c0-6.12 4.98-11.1 11.1-11.1 2.97 0 5.75 1.16 7.85 3.26a11.03 11.03 0 013.24 7.85c0 6.13-4.99 11.1-11.11 11.1v-.05zm6.1-8.31c-.34-.17-1.98-1-2.29-1.1-.31-.12-.53-.17-.75.17-.22.34-.86 1.1-1.05 1.32-.2.22-.39.24-.72.08-.34-.17-1.42-.52-2.7-1.67-1-1.2-1.67-2.15-1.87-2.49-.2-.34-.02-.52.15-.69.15-.15.34-.39.5-.59.17-.2.22-.34.34-.56.11-.22.05-.42-.03-.59-.08-.17-.75-1.82-1.03-2.49-.27-.65-.55-.56-.75-.57h-.64c-.22 0-.59.08-.89.42-.31.34-1.17 1.14-1.17 2.78s1.2 3.22 1.36 3.44c.17.22 2.36 3.6 5.72 5.05.8.34 1.42.55 1.91.7.8.26 1.53.22 2.1.14.65-.1 1.98-.81 2.26-1.6.28-.78.28-1.45.2-1.59-.09-.14-.31-.22-.65-.39z"/></svg></a>' : '') + '</td>' +
            '<td class="col-route">' + route + '</td>' +
            '<td class="col-msg">' + msg + '<span class="msg-sent">' + h.escHtml(sentTime) + '</span></td>' +
            '<td class="col-depart">' + (depart ? '<span class="depart-full">' + h.escHtml(depart) + '</span>' : '<span class="depart-full na">\u2014</span>') + '<span class="depart-mobile">' + (departMobile ? h.escHtml(departMobile) : '<span class="na">\u2014</span>') + '</span></td>' +
            '<td class="col-time">' + h.escHtml(sentTime) + '</td>' +
            '</tr>';
    }

    var rows = [];
    var sortedLeaving = sortGroup(grouped.leaving);
    var sortedArriving = sortGroup(grouped.arriving);
    var sortedOthers = sortGroup(grouped.others);

    var colHeaders = '<tr class="col-headers"><th class="col-type"></th><th class="col-name">Name</th><th class="col-phone">Phone</th><th class="col-route">Route</th><th class="col-msg">Message</th><th class="col-depart">Departs at</th><th class="col-time">Sent</th></tr>';

    if (sortedLeaving.length > 0) {
        rows.push('<tr class="section-header section-leaving"><td colspan="7">\u2191 Leaving College Station (' + sortedLeaving.length + ')</td></tr>');
        rows.push(colHeaders);
        for (var i = 0; i < sortedLeaving.length; i++) rows.push(renderRow(sortedLeaving[i], 'row-leaving'));
    }
    if (sortedArriving.length > 0) {
        rows.push('<tr class="section-header section-arriving"><td colspan="7">\u2193 Coming to College Station (' + sortedArriving.length + ')</td></tr>');
        rows.push(colHeaders);
        for (var i = 0; i < sortedArriving.length; i++) rows.push(renderRow(sortedArriving[i], 'row-arriving'));
    }
    if (sortedOthers.length > 0) {
        rows.push('<tr class="section-header section-others"><td colspan="7">Other Routes (' + sortedOthers.length + ')</td></tr>');
        rows.push(colHeaders);
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

module.exports = {
    renderLoginPage,
    renderVerifyPage,
    renderPhonePage,
    renderPhoneVerifyPage,
    renderStaticPage,
    renderMatchCard,
    renderClusterCard,
    renderDateTable
};
