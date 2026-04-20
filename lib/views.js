/**
 * HTML rendering functions for dashboard views.
 */

var h = require('./helpers');

// ── Auth Pages ──────────────────────────────────────────────────────────

function renderLoginPage(errorMsg, prefillEmail) {
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

function renderVerifyPage(email, errorMsg) {
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

function renderPhoneLoginPage(errorMsg, prefillPhone) {
    var errorHtml = errorMsg
        ? '<div class="auth-error">' + h.escHtml(errorMsg) + '</div>'
        : '';
    var SHARED_CSS = [
        '  * { margin: 0; padding: 0; box-sizing: border-box; }',
        '  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
        '         background: #fafafa; color: #1a1a1a; min-height: 100vh;',
        '         display: flex; align-items: center; justify-content: center; }',
        '  .auth-card { background: #fff; border: 1px solid #e8e8e8; border-radius: 12px;',
        '               padding: 32px 28px; max-width: 380px; width: 100%; margin: 20px; }',
        '  h1 { font-size: 22px; font-weight: 700; text-align: center; letter-spacing: -0.5px; margin-bottom: 4px; }',
        '  .auth-subtitle { text-align: center; font-size: 14px; color: #666; margin-bottom: 24px; line-height: 1.4; }',
        '  .auth-label { display: block; font-size: 13px; font-weight: 600; color: #555; margin-bottom: 6px; }',
        '  .auth-input { width: 100%; padding: 10px 12px; font-size: 16px; border: 1px solid #d0d0d0;',
        '                border-radius: 8px; outline: none; transition: border-color 0.2s; }',
        '  .auth-input:focus { border-color: #500000; }',
        '  .auth-btn { width: 100%; padding: 12px; font-size: 15px; font-weight: 600;',
        '              background: #500000; color: #fff; border: none; border-radius: 8px;',
        '              cursor: pointer; margin-top: 16px; transition: background 0.2s; }',
        '  .auth-btn:hover { background: #6b0000; }',
        '  .auth-error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;',
        '                border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; }',
        '  .auth-links { text-align: center; margin-top: 16px; font-size: 13px; }',
        '  .auth-links a { color: #500000; text-decoration: none; }',
        '  .auth-links a:hover { text-decoration: underline; }',
        '  .auth-divider { color: #ddd; margin: 0 8px; }',
        '  .wa-icon { display: block; text-align: center; font-size: 36px; margin-bottom: 12px; }',
    ].join('\n');

    return [
        '<!DOCTYPE html><html lang="en"><head>',
        h.GA_TAG,
        '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
        '<title>Sign in — RideSplit</title>',
        '<style>' + SHARED_CSS + '</style>',
        '</head><body>',
        '<div class="auth-card">',
        '  <span class="wa-icon">💬</span>',
        '  <h1>Sign in via WhatsApp</h1>',
        '  <p class="auth-subtitle">We\'ll send a code to your WhatsApp.<br>No app download needed.</p>',
        errorHtml,
        '  <form method="POST" action="/login/phone">',
        '    <label class="auth-label" for="phone">Your WhatsApp number</label>',
        '    <input class="auth-input" type="tel" id="phone" name="phone"',
        '           placeholder="+1 (979) 555-0000" value="' + h.escHtml(prefillPhone) + '"',
        '           inputmode="tel" autocomplete="tel" required autofocus>',
        '    <button class="auth-btn" type="submit">Send code →</button>',
        '  </form>',
        '  <div class="auth-links">',
        '  </div>',
        '</div>',
        '</body></html>'
    ].join('\n');
}

function renderPhoneVerifyPage(phone, errorMsg) {
    var errorHtml = errorMsg
        ? '<div class="auth-error">' + h.escHtml(errorMsg) + '</div>'
        : '';
    // Format phone for display: +1 (979) 350-0982
    var display = phone.replace(/^1?(\d{3})(\d{3})(\d{4})$/, '+1 ($1) $2-$3') || phone;

    return [
        '<!DOCTYPE html><html lang="en"><head>',
        h.GA_TAG,
        '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
        '<title>Verify — RideSplit</title>',
        '<style>',
        '  * { margin: 0; padding: 0; box-sizing: border-box; }',
        '  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
        '         background: #fafafa; color: #1a1a1a; min-height: 100vh;',
        '         display: flex; align-items: center; justify-content: center; }',
        '  .auth-card { background: #fff; border: 1px solid #e8e8e8; border-radius: 12px;',
        '               padding: 32px 28px; max-width: 380px; width: 100%; margin: 20px; }',
        '  h1 { font-size: 22px; font-weight: 700; text-align: center; letter-spacing: -0.5px; margin-bottom: 4px; }',
        '  .auth-subtitle { text-align: center; font-size: 14px; color: #666; margin-bottom: 24px; line-height: 1.4; }',
        '  .auth-phone { font-weight: 600; color: #1a1a1a; }',
        '  .auth-label { display: block; font-size: 13px; font-weight: 600; color: #555; margin-bottom: 6px; }',
        '  .auth-input { width: 100%; padding: 10px 12px; font-size: 28px; border: 1px solid #d0d0d0;',
        '                border-radius: 8px; outline: none; text-align: center; letter-spacing: 10px;',
        '                font-weight: 700; transition: border-color 0.2s; }',
        '  .auth-input:focus { border-color: #500000; }',
        '  .auth-btn { width: 100%; padding: 12px; font-size: 15px; font-weight: 600;',
        '              background: #500000; color: #fff; border: none; border-radius: 8px;',
        '              cursor: pointer; margin-top: 16px; transition: background 0.2s; }',
        '  .auth-btn:hover { background: #6b0000; }',
        '  .auth-error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;',
        '                border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; }',
        '  .auth-links { text-align: center; margin-top: 16px; font-size: 13px; }',
        '  .auth-links a { color: #500000; text-decoration: none; }',
        '  .auth-links a:hover { text-decoration: underline; }',
        '  .auth-divider { color: #ddd; margin: 0 8px; }',
        '  .wa-hint { font-size: 12px; color: #888; text-align: center; margin-top: 10px; }',
        '</style>',
        '</head><body>',
        '<div class="auth-card">',
        '  <h1>Check WhatsApp</h1>',
        '  <p class="auth-subtitle">We sent a 6-digit code to<br>',
        '     <span class="auth-phone">' + h.escHtml(display) + '</span></p>',
        errorHtml,
        '  <form method="POST" action="/verify/phone">',
        '    <input type="hidden" name="phone" value="' + h.escHtml(phone) + '">',
        '    <label class="auth-label" for="code">Verification code</label>',
        '    <input class="auth-input" type="text" id="code" name="code"',
        '           placeholder="000000" maxlength="6" pattern="[0-9]{6}"',
        '           inputmode="numeric" autocomplete="one-time-code" required autofocus>',
        '    <button class="auth-btn" type="submit">Verify →</button>',
        '  </form>',
        '  <p class="wa-hint">Code may take up to 30 seconds to arrive.</p>',
        '  <div class="auth-links">',
        '    <a href="/login/phone?phone=' + encodeURIComponent(phone) + '">Resend code</a>',
        '    <span class="auth-divider">|</span>',
        '    <a href="/login/phone">Different number</a>',
        '  </div>',
        '</div>',
        '</body></html>'
    ].join('\n');
}

function renderProfilePage(user, profile) {
    var isPhoneAuth = user.auth_type === 'phone';
    var phone   = user.phone || '';
    var masked  = phone.replace(/^(d*)(d{4})$/, function(_, pre, last) {
        return (pre.length ? '+1 (•••) •••-' : '') + last;
    }) || phone;

    var name = (profile && (profile.display_name || profile.wa_name))
        || (user.email ? user.email.split('@')[0] : 'No name set');

    var created = profile && profile.created_at
        ? new Date(profile.created_at).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' })
        : 'Today';

    // Email field: three states
    var emailHtml;
    if (!isPhoneAuth && user.email) {
        // State b: email-auth user
        emailHtml = '<div class="field-value">' + h.escHtml(user.email)
            + '<span class="verified-badge">✓ Verified</span></div>';
    } else if (isPhoneAuth && profile && profile.email) {
        // State c: phone-auth with linked email
        emailHtml = '<div class="field-value">' + h.escHtml(profile.email)
            + '<span class="verified-badge">✓ Linked</span></div>';
    } else {
        // State a: phone-auth, no email linked
        emailHtml = '<div class="field-value muted">Not linked — <a href="/login" style="color:#500000;">sign in with @tamu.edu</a> to link</div>';
    }

    // Name row: inline-editable for phone-auth users only
    var nameRowHtml;
    if (isPhoneAuth) {
        nameRowHtml = [
            '<div class="field-row" id="name-row">',
            '  <div class="field-label">Name</div>',
            '  <div id="name-display" style="display:flex;align-items:center;gap:8px;">',
            '    <span id="name-text" class="field-value">' + h.escHtml(name) + '</span>',
            '    <button id="name-edit-btn" onclick="startEdit()" style="background:none;border:none;cursor:pointer;padding:2px 4px;color:#8e8e93;font-size:13px;" title="Edit name">✏</button>',
            '  </div>',
            '  <div id="name-edit" style="display:none;">',
            '    <input id="name-input" type="text" maxlength="60" value="' + h.escHtml(name) + '"',
            '      style="font-size:15px;font-weight:500;border:1.5px solid #500000;border-radius:8px;padding:6px 10px;width:100%;outline:none;"/>',
            '    <div style="display:flex;gap:8px;margin-top:8px;">',
            '      <button onclick="saveName()" style="flex:1;padding:8px;border-radius:8px;border:none;background:#500000;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Save</button>',
            '      <button onclick="cancelEdit()" style="flex:1;padding:8px;border-radius:8px;border:1.5px solid #e5e5ea;background:#fff;color:#666;font-size:13px;font-weight:500;cursor:pointer;">Cancel</button>',
            '    </div>',
            '    <div id="name-error" style="font-size:12px;color:#c00;margin-top:6px;display:none;"></div>',
            '  </div>',
            '</div>'
        ].join('\n');
    } else {
        nameRowHtml = [
            '<div class="field-row">',
            '  <div class="field-label">Name</div>',
            '  <div class="field-value">' + h.escHtml(name) + '</div>',
            '</div>'
        ].join('\n');
    }

    var nameEditScript = isPhoneAuth ? [
        '<script>',
        'function startEdit() {',
        '  document.getElementById("name-display").style.display = "none";',
        '  document.getElementById("name-edit").style.display = "block";',
        '  document.getElementById("name-input").focus();',
        '}',
        'function cancelEdit() {',
        '  document.getElementById("name-edit").style.display = "none";',
        '  document.getElementById("name-display").style.display = "flex";',
        '  document.getElementById("name-error").style.display = "none";',
        '}',
        'async function saveName() {',
        '  var name = document.getElementById("name-input").value.trim();',
        '  var errEl = document.getElementById("name-error");',
        '  errEl.style.display = "none";',
        '  if (!name) { errEl.textContent = "Name cannot be empty."; errEl.style.display = "block"; return; }',
        '  if (name.length > 60) { errEl.textContent = "Name must be 60 characters or fewer."; errEl.style.display = "block"; return; }',
        '  try {',
        '    var res = await fetch("/profile/name", {',
        '      method: "POST",',
        '      headers: { "Content-Type": "application/json" },',
        '      body: JSON.stringify({ name })',
        '    });',
        '    var data = await res.json();',
        '    if (data.ok) {',
        '      document.getElementById("name-text").textContent = data.name;',
        '      document.getElementById("name-input").value = data.name;',
        '      cancelEdit();',
        '    } else {',
        '      errEl.textContent = data.error || "Failed to save.";',
        '      errEl.style.display = "block";',
        '    }',
        '  } catch(e) {',
        '    errEl.textContent = "Network error. Please try again.";',
        '    errEl.style.display = "block";',
        '  }',
        '}',
        'document.addEventListener("keydown", function(e) {',
        '  if (e.key === "Enter" && document.getElementById("name-edit").style.display === "block") saveName();',
        '  if (e.key === "Escape" && document.getElementById("name-edit").style.display === "block") cancelEdit();',
        '});',
        '</script>'
    ].join('\n') : '';

    return [
        '<!DOCTYPE html><html lang="en"><head>',
        h.GA_TAG,
        '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
        '<title>Profile — RideSplit</title>',
        '<style>',
        '* { margin:0; padding:0; box-sizing:border-box; }',
        'body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:#f2f2f7; color:#1a1a1a; min-height:100vh; }',
        '.topbar { background:#fff; border-bottom:1px solid #e5e5ea; padding:12px 20px; display:flex; align-items:center; justify-content:space-between; }',
        '.topbar-logo { font-size:15px; font-weight:700; color:#500000; letter-spacing:-0.3px; text-decoration:none; }',
        '.topbar-right a { font-size:13px; color:#500000; text-decoration:none; }',
        '.page { max-width:480px; margin:0 auto; padding:24px 16px 60px; }',
        '.card { background:#fff; border-radius:16px; padding:24px; margin-bottom:12px; box-shadow:0 1px 3px rgba(0,0,0,0.06); }',
        '.avatar { width:64px; height:64px; border-radius:50%; background:linear-gradient(135deg,#500000,#7a3030); display:flex; align-items:center; justify-content:center; color:#fff; font-size:26px; font-weight:700; margin-bottom:14px; }',
        '.profile-name { font-size:22px; font-weight:700; letter-spacing:-0.4px; margin-bottom:2px; }',
        '.profile-since { font-size:13px; color:#888; }',
        '.divider { height:1px; background:#f2f2f7; margin:16px 0; }',
        '.field-label { font-size:11px; font-weight:600; color:#8e8e93; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px; }',
        '.field-value { font-size:15px; font-weight:500; color:#1a1a1a; }',
        '.field-value.muted { color:#8e8e93; }',
        '.verified-badge { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; color:#2d6a2d; background:#f0faf0; border-radius:6px; padding:2px 7px; margin-left:6px; vertical-align:middle; }',
        '.field-row { margin-bottom:16px; }',
        '.field-row:last-child { margin-bottom:0; }',
        '.btn-signout { display:block; text-align:center; margin-top:4px; padding:12px; border-radius:12px; border:1.5px solid #e5e5ea; background:#fff; font-size:14px; font-weight:500; color:#666; text-decoration:none; cursor:pointer; }',
        '.btn-signout:hover { background:#f2f2f7; }',
        '</style>',
        '</head><body>',
        '<div class="topbar">',
        '  <a class="topbar-logo" href="/">ridesplit.app</a>',
        '  <div class="topbar-right"><a href="/">← Back</a></div>',
        '</div>',
        '<div class="page">',

        '<div class="card">',
        '  <div class="avatar">' + h.escHtml(name.charAt(0).toUpperCase()) + '</div>',
        '  <div class="profile-name">' + h.escHtml(name) + '</div>',
        '  <div class="profile-since">Member since ' + created + '</div>',
        '  <div class="divider"></div>',

        isPhoneAuth ? [
            '  <div class="field-row">',
            '    <div class="field-label">Phone</div>',
            '    <div class="field-value">' + h.escHtml(masked),
            '      <span class="verified-badge">✓ Verified via WhatsApp</span>',
            '    </div>',
            '  </div>'
        ].join('\n') : '',

        nameRowHtml,

        '  <div class="field-row">',
        '    <div class="field-label">Email</div>',
        emailHtml,
        '  </div>',

        '</div>',

        '<a class="btn-signout" href="/logout">Sign out</a>',

        '</div>',
        nameEditScript,
        '</body></html>'
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

// ── Housing Board ───────────────────────────────────────────────────────

var WA_SVG = '<svg width="10" height="10" viewBox="0 0 24 24" fill="#25d366" style="flex-shrink:0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.528 5.855L0 24l6.335-1.654A11.956 11.956 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.805 9.805 0 01-4.99-1.366l-.356-.213-3.762.982.999-3.653-.234-.374A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>';

function relTime(dateStr) {
    if (!dateStr) return '';
    var diff = Date.now() - new Date(dateStr).getTime();
    var days = Math.floor(diff / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return '1d ago';
    if (days < 8) return days + 'd ago';
    return Math.floor(days / 7) + 'w ago';
}

function freshClass(dateStr) {
    if (!dateStr) return 'gray';
    var days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (days < 2) return 'green';
    if (days < 8) return 'yellow';
    return 'gray';
}

function renderHousingBoard(listings, activeFilter, tier, userEmail, userPhone) {
    userEmail = userEmail || '';
    userPhone = userPhone || '';

    // Format created_at as "Apr 14, 2026 · 9:32 AM CDT"
    function postedAt(isoStr) {
        if (!isoStr) return '';
        var d = new Date(isoStr);
        var parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Chicago',
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true,
            timeZoneName: 'short'
        }).formatToParts(d);
        var m = {};
        parts.forEach(function(p) { if (p.type !== 'literal') m[p.type] = p.value; });
        return (m.month||'') + ' ' + (m.day||'') + ', ' + (m.year||'') + ' \u00b7 ' +
               (m.hour||'') + ':' + (m.minute||'') + ' ' + (m.dayPeriod||'') + ' ' + (m.timeZoneName||'');
    }

    // Derive data-city attribute from location string
    function cityAttr(location) {
        if (!location) return '';
        var loc = location.toLowerCase();
        if (loc.indexOf('bryan') !== -1) return ' data-city="bryan"';
        if (loc.indexOf('college station') !== -1 || /\bcs\b/i.test(location)) return ' data-city="college-station"';
        return '';
    }

    // Map listing_type to CSS class
    function typeClass(type) {
        if (type === 'sublease') return 'sublease';
        if (type === 'roommate') return 'roommate';
        return 'lease'; // lease_transfer and anything else
    }

    // Build one collapsible card
    function buildCard(l) {
        var type = (l.listing_type || 'sublease').toLowerCase();
        var cls = typeClass(type);
        var city = cityAttr(l.location || '');

        var locationName = l.location ? h.escHtml(l.location) : 'Housing Listing';
        var beds = '';
        if (l.bedrooms || l.bathrooms) {
            beds = (l.bedrooms ? l.bedrooms + 'BR' : '') + (l.bathrooms ? '/' + l.bathrooms + 'BA' : '');
        }
        var headingName = locationName + (beds ? ' \u2014 ' + h.escHtml(beds) : '');

        var price = l.price ? '$' + l.price + '/mo' : null;
        var timestamp = l.sent_at || l.created_at; // prefer sent_at (original WA timestamp) over created_at (DB insertion)
        var rt = relTime(timestamp);
        var fc = freshClass(timestamp);
        var freshPillCls = fc === 'green' ? 'pill-fresh' : 'pill-stale';

        var typePillCls = cls === 'sublease' ? 'pill-sub' : cls === 'roommate' ? 'pill-room' : 'pill-lease';
        var typeLabel = type === 'lease_transfer' ? 'Lease Transfer' : type === 'sublease' ? 'Sublease' : 'Roommate';

        // Summary line: "Priya S. · May 15 – Aug 15, 2026 · amenity1, amenity2"
        var summaryParts = [];
        if (l.sender_name) summaryParts.push(h.escHtml(l.sender_name));
        var av = l.available_date ? new Date(l.available_date).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric', timeZone:'America/Chicago'}) : '';
        var ed = l.end_date ? new Date(l.end_date).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric', timeZone:'America/Chicago'}) : '';
        if (av && ed) summaryParts.push(h.escHtml(av) + ' &ndash; ' + h.escHtml(ed));
        else if (av) summaryParts.push(h.escHtml(av));
        if (l.amenities && l.amenities.length > 0) summaryParts.push(h.escHtml(l.amenities.slice(0, 3).join(', ')));
        var summary = summaryParts.join(' &middot; ');

        // Detail rows
        var availStr = (av && ed) ? h.escHtml(av) + ' &ndash; ' + h.escHtml(ed) : h.escHtml(av || ed || '');
        var bedsBathStr = '';
        if (l.bedrooms && l.bathrooms) bedsBathStr = h.escHtml(String(l.bedrooms)) + ' bed / ' + h.escHtml(String(l.bathrooms)) + ' bath';
        else if (l.bedrooms) bedsBathStr = h.escHtml(String(l.bedrooms)) + ' bed';
        else if (l.bathrooms) bedsBathStr = h.escHtml(String(l.bathrooms)) + ' bath';

        var postedByStr = l.sender_name ? h.escHtml(l.sender_name) : '—';
        if (l.source_group) postedByStr += ' &middot; via ' + h.escHtml(l.source_group);
        var postedAtStr = postedAt(timestamp);

        // Amenity pills
        var amenitiesHtml = '';
        if (l.amenities && l.amenities.length > 0) {
            amenitiesHtml = '<div class="amenities-row">' +
                l.amenities.map(function(a) { return '<span class="amenity">' + h.escHtml(String(a)) + '</span>'; }).join('') +
                '</div>';
        }

        // WA message snippet
        var snippetHtml = '';
        if (l.message_text) {
            snippetHtml = '<div class="snippet-row">&ldquo;' + h.escHtml(l.message_text) + '&rdquo;</div>';
        }

        // Contact info or auth gate
        var contactHtml = '';
        if (tier >= 2) {
            // Show contact info for WA-verified users - raw phone number, no formatting
            // Prefer source_contact (WhatsApp JID) over parsed contact_phone
            var resolvedPhone = l.source_contact || l.poster_phone || l.contact_phone || null;
            if (resolvedPhone) {
                var phoneDigits = String(resolvedPhone).replace(/\D/g, '');
                var waHousingBtn = '<a class="wa-contact-btn" href="https://wa.me/' + h.escHtml(phoneDigits) + '" target="_blank" rel="noopener noreferrer" onclick="navigator.sendBeacon(\'/log-click\',JSON.stringify({phone:\'' + h.escHtml(phoneDigits) + '\',page:\'housing\',user_email:_userEmail}))">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.852L0 24l6.335-1.507A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.807 9.807 0 01-5.032-1.384l-.361-.214-3.762.895.952-3.664-.235-.376A9.808 9.808 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/></svg>' +
                    'Message' +
                    '</a>';
                contactHtml = [
                    '<div class="detail-row contact-row">',
                    '<span class="dr-label">Contact</span>',
                    '<span class="dr-val contact-val">',
                    '<span class="contact-phone">+' + h.escHtml(String(resolvedPhone)) + '</span>',
                    waHousingBtn,
                    '</span></div>'
                ].join('');
            }
        } else if (tier === 1) {
            // Email signed in but not WA verified yet
            contactHtml = [
                '<div class="card-auth">',
                '  <div class="card-auth-title">&#128242; One more step</div>',
                '  <div class="card-auth-body">Verify your WhatsApp number to see contact info. Takes ~30 seconds.</div>',
                '  <div class="card-auth-actions">',
                '    <a class="btn btn-primary" href="/verify/wa">Verify WhatsApp &rarr;</a>',
                '  </div>',
                '</div>'
            ].join('\n');
        } else {
            // Not signed in at all
            contactHtml = [
                '<div class="card-auth">',
                '  <div class="card-auth-title">&#128274; Sign in to see contact</div>',
                '  <div class="card-auth-body">Sign in with your @tamu.edu email, then verify your WhatsApp number.</div>',
                '  <div class="card-auth-actions">',
                '    <a class="btn btn-primary" href="/login">Sign in with @tamu.edu</a>',
                '  </div>',
                '</div>'
            ].join('\n');
        }

        var dataPriceAttr = l.price ? ' data-price="' + l.price + '"' : '';
        var dataBedsAttr = l.bedrooms ? ' data-beds="' + l.bedrooms + '"' : '';
        var dataSlugAttr = l.slug ? ' data-slug="' + h.escHtml(l.slug) + '"' : '';

        return [
            '<article class="listing ' + cls + '"' + city + dataPriceAttr + dataBedsAttr + dataSlugAttr + ' tabindex="0" role="button" aria-expanded="false">',
            '  <div class="listing-head" onclick="toggleListing(this.parentElement)">',
            '    <div class="listing-info">',
            '      <div class="listing-name">' + headingName + '</div>',
            '      <div class="listing-meta">',
            '        <span class="pill ' + typePillCls + '">' + typeLabel + '</span>',
            price ? '        <span class="pill pill-price">' + h.escHtml(price) + '</span>' : '',
            rt    ? '        <span class="pill ' + freshPillCls + '">' + h.escHtml(rt) + '</span>' : '',
            '      </div>',
            summary ? '      <div class="listing-summary">' + summary + '</div>' : '',
            '      <div class="expand-hint">Tap to see details</div>',
            '    </div>',
            '    <span class="listing-chevron">&#9656;</span>',
            '  </div>',
            '  <div class="listing-body">',
            '    <div class="listing-body-inner">',
            availStr    ? '      <div class="detail-row"><span class="dr-label">Available</span><span class="dr-val">' + availStr + '</span></div>' : '',
            bedsBathStr ? '      <div class="detail-row"><span class="dr-label">Beds/Bath</span><span class="dr-val">' + bedsBathStr + '</span></div>' : '',
            '      <div class="detail-row"><span class="dr-label">Posted by</span><span class="dr-val">' + postedByStr +
                (postedAtStr ? '<div class="posted-at">' + h.escHtml(postedAtStr) + '</div>' : '') + '</span></div>',
            amenitiesHtml,
            snippetHtml,
            contactHtml,
            '    </div>',
            '  </div>',
            '</article>'
        ].filter(function(s) { return s !== ''; }).join('\n');
    }

    // Group into three ordered buckets
    var buckets = { sublease: [], roommate: [], lease_transfer: [] };
    (listings || []).forEach(function(l) {
        var t = (l.listing_type || '').toLowerCase();
        if (buckets[t]) buckets[t].push(l);
        else buckets.sublease.push(l);
    });

    var sectionsHtml = '';
    if (buckets.sublease.length > 0) {
        sectionsHtml += '<div class="section-label sublease" data-section="sublease">&#127968; Subleases <span class="section-count">(' + buckets.sublease.length + ')</span></div>\n';
        sectionsHtml += buckets.sublease.map(buildCard).join('\n') + '\n';
    }
    if (buckets.roommate.length > 0) {
        sectionsHtml += '<div class="section-label roommate" data-section="roommate">&#128101; Roommate Wanted <span class="section-count">(' + buckets.roommate.length + ')</span></div>\n';
        sectionsHtml += buckets.roommate.map(buildCard).join('\n') + '\n';
    }
    if (buckets.lease_transfer.length > 0) {
        sectionsHtml += '<div class="section-label lease" data-section="lease_transfer">&#128196; Lease Transfer <span class="section-count">(' + buckets.lease_transfer.length + ')</span></div>\n';
        sectionsHtml += buckets.lease_transfer.map(buildCard).join('\n') + '\n';
    }
    if (!sectionsHtml) {
        sectionsHtml = '<div class="empty-state">No listings yet.</div>';
    }

    var totalCount = (listings || []).length;

    var authLinkHtml = '';
    if (tier === 0) {
        authLinkHtml = '<div class="auth-link"><a href="/login">Sign in with @tamu.edu</a></div>';
    } else if (tier === 1) {
        authLinkHtml = '<div class="auth-link"><a href="/verify/wa" style="color:var(--maroon);font-weight:700;">&#128242; Verify WhatsApp to unlock contact info</a> &middot; <a href="/profile">Profile</a></div>';
    } else {
        authLinkHtml = '<div class="auth-link"><a href="/profile">My Profile</a> <span style="display:inline-flex;align-items:center;gap:3px;background:#f0fdf4;color:#15803d;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;border:1px solid #bbf7d0;">&#10003; WA Verified</span></div>';
    }

    var authBannerHtml = '';
    if (tier === 0) {
        authBannerHtml = '<div class="auth-banner" id="auth-banner"><span>&#128274; Contact info hidden. <a href="/login">Sign in with @tamu.edu</a> then verify WhatsApp to unlock.</span><button class="auth-banner-close" onclick="document.getElementById(\'auth-banner\').style.display=\'none\'" aria-label="Dismiss">&times;</button></div>';
    } else if (tier === 1) {
        authBannerHtml = '<div class="auth-banner auth-banner-blue" id="auth-banner"><span>&#128242; <a href="/verify/wa" style="color:inherit;font-weight:700;">Verify your WhatsApp number</a> to see poster contact info.</span><button class="auth-banner-close" onclick="document.getElementById(\'auth-banner\').style.display=\'none\'" aria-label="Dismiss">&times;</button></div>';
    }

    var filterBarHtml = tier >= 1 ? [
        '<div class="h-filter-bar">',
        '  <div class="h-filter-row">',
        '    <label class="h-filter-label" for="f-price">Price</label>',
        '    <select class="h-filter-select" id="f-price" onchange="applyHFilters()">',
        '      <option value="">Any price</option>',
        '      <option value="500">Under $500</option>',
        '      <option value="600">Under $600</option>',
        '      <option value="800">Under $800</option>',
        '      <option value="1000">Under $1,000</option>',
        '    </select>',
        '    <label class="h-filter-label" for="f-beds">Beds</label>',
        '    <select class="h-filter-select" id="f-beds" onchange="applyHFilters()">',
        '      <option value="">Any</option>',
        '      <option value="1">1</option>',
        '      <option value="2">2</option>',
        '      <option value="3">3+</option>',
        '    </select>',
        '  </div>',
        '</div>'
    ].join('\n') : '';

    var CSS = [
        ':root {',
        '  --maroon: #500000; --maroon-light: #6b0000; --bg: #fafafa; --card: #fff;',
        '  --border: #e5e5e5; --text: #1a1a1a; --text-secondary: #666; --text-muted: #999;',
        '  --blue: #3b82f6; --blue-bg: #eff6ff; --green: #22c55e; --green-bg: #f0fdf4;',
        '  --radius: 12px; --radius-sm: 8px;',
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
        '.auth-link { font-size: 12px; color: var(--text-muted); margin-top: 6px; }',
        '.auth-link a { color: var(--maroon); text-decoration: none; font-weight: 600; }',
        '.auth-link a:hover { text-decoration: underline; }',
        '.auth-banner { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 10px 14px; border-radius: var(--radius-sm); font-size: 12px; margin: 0 0 12px; display: flex; align-items: center; gap: 8px; line-height: 1.45; }',
        '.auth-banner a { color: var(--maroon); font-weight: 700; text-decoration: none; }',
        '.auth-banner a:hover { text-decoration: underline; }',
        '.auth-banner-close { margin-left: auto; background: none; border: none; font-size: 20px; cursor: pointer; color: #92400e; line-height: 1; padding: 0 4px; flex-shrink: 0; }',
        '.auth-banner-blue { background: #eff6ff; border-color: #bfdbfe; color: #1e40af; }',
        '.auth-banner-blue .auth-banner-close { color: #1e40af; }',
        '.h-filter-bar { padding: 10px 0; border-bottom: 1px solid var(--border); margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px; }',
        '.h-filter-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }',
        '.h-filter-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); min-width: 36px; }',
        '.h-filter-select { font-size: 12px; padding: 4px 24px 4px 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--card); color: var(--text); appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\'%3E%3Cpath d=\'M0 0l5 6 5-6z\' fill=\'%23999\'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 8px center; }',
        '.filter-bar { position: sticky; top: 0; z-index: 18; background: var(--bg); padding: 8px 0; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 6px; }',
        '.filter-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }',
        '.filter-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); flex-shrink: 0; min-width: 34px; }',
        '.filter-pill { display: inline-block; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 99px; border: 1px solid var(--border); background: var(--card); color: var(--text-secondary); cursor: pointer; user-select: none; transition: all 0.15s ease; -webkit-tap-highlight-color: transparent; }',
        '.filter-pill:active { transform: scale(0.96); }',
        '.filter-pill.active { background: var(--maroon); color: #fff; border-color: var(--maroon); }',
        '.posted-at { font-size: 11px; color: var(--text-muted); margin-top: 2px; }',
        '.section-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 8px 12px; margin: 0 0 8px; display: flex; align-items: center; gap: 6px; position: sticky; top: 75px; z-index: 14; box-shadow: 0 2px 0 0 var(--bg); }',
        '.section-label.sublease { color: #7a0000; background: #fef2f2; border-top: 1px solid #fecaca; border-bottom: 1px solid #fecaca; }',
        '.section-label.roommate { color: #15803d; background: var(--green-bg); border-top: 1px solid #dcfce7; border-bottom: 1px solid #dcfce7; }',
        '.section-label.lease    { color: #1d4ed8; background: var(--blue-bg);  border-top: 1px solid #dbeafe; border-bottom: 1px solid #dbeafe; }',
        '.section-count { font-weight: 400; opacity: 0.7; }',
        '.listing { border: 1px solid var(--border); border-radius: var(--radius); background: var(--card); overflow: hidden; margin-bottom: 10px; transition: box-shadow 0.15s; }',
        '.listing:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }',
        '.listing.sublease { border-left: 3px solid #f87171; }',
        '.listing.roommate { border-left: 3px solid var(--green); }',
        '.listing.lease    { border-left: 3px solid var(--blue); }',
        '.listing-head { display: flex; align-items: center; padding: 12px 14px; cursor: pointer; user-select: none; gap: 12px; background: #fafaf8; border-bottom: 1px solid var(--border); }',
        '.listing-head:active { background: #f0f0ee; }',
        '.listing-info { flex: 1; min-width: 0; }',
        '.listing-name { font-size: 15px; font-weight: 700; color: var(--text); }',
        '.listing-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 3px; }',
        '.pill { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 99px; }',
        '.pill-sub   { background: #fee2e2; color: #7a0000; }',
        '.pill-room  { background: #dcfce7; color: #15803d; }',
        '.pill-lease { background: #dbeafe; color: #1d4ed8; }',
        '.pill-price { background: #f5f5f5; color: var(--text-secondary); }',
        '.pill-fresh { background: #dcfce7; color: #15803d; }',
        '.pill-stale { background: #f5f5f5; color: var(--text-muted); }',
        '.listing-summary { font-size: 12px; color: var(--text-secondary); margin-top: 4px; line-height: 1.35; }',
        '.expand-hint { font-size: 11px; color: var(--text-muted); margin-top: 2px; }',
        '.listing.open .expand-hint { display: none; }',
        '.listing-chevron { font-size: 18px; color: #888; flex-shrink: 0; transition: transform 0.2s ease; width: 24px; text-align: center; }',
        '.listing.open .listing-chevron { transform: rotate(90deg); }',
        '.listing-body { max-height: 0; overflow: hidden; transition: max-height 0.3s ease; border-top: 0 solid var(--border); }',
        '.listing.open .listing-body { max-height: 1000px; border-top-width: 1px; }',
        '.detail-row { padding: 9px 14px; border-bottom: 1px solid #f0f0f0; font-size: 13px; display: flex; align-items: center; gap: 10px; }',
        '.detail-row:last-child { border-bottom: 0; }',
        '.dr-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); flex-shrink: 0; width: 72px; }',
        '.dr-val { color: var(--text); }',
        '.contact-val { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }',
        '.contact-phone { color: var(--text-secondary); font-size: 13px; }',
        '.wa-contact-btn { display: inline-flex; align-items: center; gap: 5px; background: #25D366; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 99px; text-decoration: none; white-space: nowrap; flex-shrink: 0; transition: background 0.15s; }',
        '.wa-contact-btn:hover { background: #1da851; }',
        '.amenities-row { padding: 9px 14px 10px; border-bottom: 1px solid #f0f0f0; display: flex; flex-wrap: wrap; gap: 5px; }',
        '.amenity { font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 99px; background: #f3f3f3; color: var(--text-secondary); border: 1px solid var(--border); }',
        '.snippet-row { padding: 9px 14px 10px; border-bottom: 1px solid #f0f0f0; font-size: 12px; color: var(--text-secondary); font-style: italic; line-height: 1.45; }',
        '.card-auth { padding: 14px; background: #fef3c7; border-bottom: 1px solid #fde68a; }',
        '.card-auth-title { font-size: 13px; font-weight: 700; color: #92400e; margin-bottom: 4px; }',
        '.card-auth-body { font-size: 12px; color: #92400e; margin-bottom: 10px; line-height: 1.4; }',
        '.card-auth-actions { display: flex; flex-direction: column; gap: 7px; }',
        '.btn { display: block; width: 100%; padding: 9px 16px; border: none; border-radius: var(--radius-sm); font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; text-align: center; text-decoration: none; }',
        '.btn-primary { background: var(--maroon); color: #fff; }',
        '.btn-primary:hover { background: var(--maroon-light); }',
        '.empty-state { color: #888; font-size: 15px; padding: 40px 0; text-align: center; }',
        '.footer { text-align: center; padding: 16px 0; font-size: 11px; color: #ccc; border-top: 1px solid #eee; margin-top: 20px; }',
        '@media (max-width: 700px) {',
        '  .container { padding: 8px 8px 32px; }',
        '  .hero h1 { font-size: 18px; }',
        '  .hero .tagline { display: none; }',
        '  .hero { margin-bottom: 8px; }',
        '  .listing-head { padding: 10px 12px; gap: 8px; }',
        '  .listing-name { font-size: 14px; }',
        '  .detail-row { padding: 8px 12px; }',
        '  .amenities-row { padding: 8px 12px 10px; }',
        '  .snippet-row { padding: 8px 12px 10px; }',
        '  .card-auth { padding: 12px; }',
        '}'
    ].join('\n');

    var JS = [
        'function toggleListing(el) {',
        '  el.classList.toggle(\'open\');',
        '  el.setAttribute(\'aria-expanded\', el.classList.contains(\'open\'));',
        '  if (el.classList.contains(\'open\')) {',
        '    var slug = el.getAttribute(\'data-slug\') || null;',
        '    navigator.sendBeacon(\'/log-expand\', JSON.stringify({page:\'housing\',listing_slug:slug,user_email:_userEmail,phone:_userPhone}));',
        '  }',
        '}',
        'var activeType = \'all\';',
        'var activeCity = null;',
        'function applyFilters() {',
        '  document.querySelectorAll(\'.listing\').forEach(function(card) {',
        '    var typeMatch = activeType === \'all\' || card.classList.contains(activeType);',
        '    var cityMatch = !activeCity || card.getAttribute(\'data-city\') === activeCity;',
        '    card.style.display = (typeMatch && cityMatch) ? \'\' : \'none\';',
        '  });',
        '  document.querySelectorAll(\'.section-label\').forEach(function(label) {',
        '    var sectionType = label.classList.contains(\'sublease\') ? \'sublease\'',
        '      : label.classList.contains(\'roommate\') ? \'roommate\' : \'lease\';',
        '    var typeVisible = activeType === \'all\' || activeType === sectionType;',
        '    if (!typeVisible) { label.style.display = \'none\'; return; }',
        '    var next = label.nextElementSibling;',
        '    var anyVisible = false;',
        '    while (next && next.classList.contains(\'listing\')) {',
        '      if (next.style.display !== \'none\') { anyVisible = true; break; }',
        '      next = next.nextElementSibling;',
        '    }',
        '    label.style.display = anyVisible ? \'\' : \'none\';',
        '  });',
        '}',
        'function toggleType(pill, type) {',
        '  document.querySelectorAll(\'.type-pill\').forEach(function(p) { p.classList.remove(\'active\'); });',
        '  pill.classList.add(\'active\');',
        '  activeType = type;',
        '  applyFilters();',
        '}',
        'function toggleCity(pill, city) {',
        '  if (activeCity === city) { activeCity = null; pill.classList.remove(\'active\'); }',
        '  else {',
        '    document.querySelectorAll(\'.city-pill\').forEach(function(p) { p.classList.remove(\'active\'); });',
        '    pill.classList.add(\'active\'); activeCity = city;',
        '  }',
        '  applyFilters();',
        '}',
        'function applyHFilters() {',
        '  var maxPrice = parseInt(document.getElementById(\'f-price\')?.value || \'0\') || 0;',
        '  var beds = parseInt(document.getElementById(\'f-beds\')?.value || \'0\') || 0;',
        '  document.querySelectorAll(\'.listing\').forEach(function(card) {',
        '    var cardPrice = parseInt(card.getAttribute(\'data-price\') || \'0\') || 0;',
        '    var cardBeds = parseInt(card.getAttribute(\'data-beds\') || \'0\') || 0;',
        '    var priceOk = !maxPrice || !cardPrice || cardPrice <= maxPrice;',
        '    var bedsOk = !beds || cardBeds === beds || (beds === 3 && cardBeds >= 3);',
        '    card.style.display = (priceOk && bedsOk) ? \'\' : \'none\';',
        '  });',
        '}'
    ].join('\n');

    return [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '<head>',
        h.GA_TAG,
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<title>Housing — RideSplit</title>',
        '<style>' + CSS + '</style>',
        '</head>',
        '<body>',
        '<a href="/clusters" style="position:fixed;top:14px;right:16px;z-index:300;display:inline-flex;align-items:center;gap:5px;background:#fff;border:1px solid #e5e5e5;color:#666;font-size:12px;font-weight:600;padding:6px 12px;border-radius:99px;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,0.08);white-space:nowrap;" onmouseover="this.style.color=\'#1a1a1a\'" onmouseout="this.style.color=\'#666\'">&#128664; Rides</a>',
        '<div class="container">',
        '<div class="hero">',
        '  <h1>Aggie Housing</h1>',
        '  <p class="subtitle">Tracking <strong>' + totalCount + ' listings</strong> from student WhatsApp groups</p>',
        '  <p class="tagline">Find subleases, roommates, and lease transfers. Updated in real time.</p>',
        authLinkHtml,
        '</div>',
        authBannerHtml,
        filterBarHtml,
        '<div class="filter-bar">',
        '  <div class="filter-row">',
        '    <span class="filter-label">Type</span>',
        '    <span class="filter-pill type-pill active" onclick="toggleType(this,\'all\')">All</span>',
        '    <span class="filter-pill type-pill" onclick="toggleType(this,\'sublease\')">Sublease</span>',
        '    <span class="filter-pill type-pill" onclick="toggleType(this,\'roommate\')">Roommate</span>',
        '    <span class="filter-pill type-pill" onclick="toggleType(this,\'lease\')">Lease Transfer</span>',
        '  </div>',
        '  <div class="filter-row">',
        '    <span class="filter-label">City</span>',
        '    <span class="filter-pill city-pill" onclick="toggleCity(this,\'bryan\')">Bryan</span>',
        '    <span class="filter-pill city-pill" onclick="toggleCity(this,\'college-station\')">College Station</span>',
        '  </div>',
        '</div>',
        sectionsHtml,
        '<div class="footer">' + totalCount + ' listings &middot; RideSplit</div>',
        '</div>',
        '<script>var _userEmail=' + JSON.stringify(userEmail) + ';var _userPhone=' + JSON.stringify(userPhone) + ';<\/script>',
        '<script>' + JS + '<\/script>',
        '</body>',
        '</html>'
    ].join('\n');
}

// ── Listing Detail Page ─────────────────────────────────────────────────

function renderListingPage(listing, tier) {
    var navRight;
    if (tier >= 2) {
        navRight = '<a href="/profile">My Profile</a> <span style="display:inline-flex;align-items:center;gap:3px;background:#f0fdf4;color:#15803d;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;border:1px solid #bbf7d0;">&#10003; WA Verified</span>';
    } else if (tier === 1) {
        navRight = '<a href="/verify/wa" style="color:#500000;font-weight:700;">&#128242; Verify WhatsApp</a> &middot; <a href="/profile">Profile</a>';
    } else {
        navRight = '<a href="/login">Sign in</a>';
    }

    var type = (listing.listing_type || 'other').toLowerCase();
    var badgeColor, badgeBg;
    if (type === 'sublease') {
        badgeColor = '#fff'; badgeBg = '#500000';
    } else if (type === 'roommate') {
        badgeColor = '#166534'; badgeBg = '#dcfce7';
    } else if (type === 'lease_transfer') {
        badgeColor = '#1d4ed8'; badgeBg = '#dbeafe';
    } else {
        badgeColor = '#444'; badgeBg = '#e8e8e8';
    }
    var badgeLabel = (listing.listing_type || 'other').toUpperCase().replace('_', ' ');

    var price = listing.price ? '$' + listing.price + '/mo' : 'Price TBD';
    var avail = listing.available_date
        ? new Date(listing.available_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' })
        : 'Flexible';
    var endDate = listing.end_date
        ? new Date(listing.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' })
        : '—';
    var posted = listing.created_at
        ? new Date(listing.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' })
        : '—';
    var heading = listing.location ? h.escHtml(listing.location) : 'Housing Listing';
    var senderName = listing.sender_name ? h.escHtml(listing.sender_name) : '—';

    var detailRows = [
        '<tr><td class="dl-label">Price</td><td class="dl-val">' + h.escHtml(price) + '</td></tr>',
        '<tr><td class="dl-label">Available</td><td class="dl-val">' + h.escHtml(avail) + '</td></tr>',
        '<tr><td class="dl-label">End Date</td><td class="dl-val">' + h.escHtml(endDate) + '</td></tr>',
        listing.bedrooms ? '<tr><td class="dl-label">Bedrooms</td><td class="dl-val">' + h.escHtml(String(listing.bedrooms)) + '</td></tr>' : '',
        listing.bathrooms ? '<tr><td class="dl-label">Bathrooms</td><td class="dl-val">' + h.escHtml(String(listing.bathrooms)) + '</td></tr>' : '',
        '<tr><td class="dl-label">Posted by</td><td class="dl-val">' + senderName + '</td></tr>',
        '<tr><td class="dl-label">Posted</td><td class="dl-val">' + h.escHtml(posted) + '</td></tr>'
    ].filter(Boolean).join('\n        ');

    var amenitiesHtml = '';
    if (listing.amenities && listing.amenities.length > 0) {
        var pills = listing.amenities.map(function(a) {
            return '<span class="amenity-pill">' + h.escHtml(String(a)) + '</span>';
        }).join(' ');
        amenitiesHtml = [
            '<div class="section">',
            '  <div class="section-heading">Amenities</div>',
            '  <div class="amenities">' + pills + '</div>',
            '</div>'
        ].join('\n');
    }

    var contactHtml;
    if (tier >= 2) {
        // Prefer source_contact (WhatsApp JID) over parsed contact_phone
        var resolvedPhone = listing.source_contact || listing.poster_phone || listing.contact_phone || null;
        contactHtml = [
            '<div class="section">',
            '  <div class="section-heading">Contact</div>',
            resolvedPhone ? '  <div class="contact-row"><strong>Phone:</strong> +' + h.escHtml(String(resolvedPhone)) + '</div>' : '',
            (!resolvedPhone) ? '  <div class="contact-row muted">No contact info provided.</div>' : '',
            '</div>'
        ].filter(function(s) { return s !== ''; }).join('\n');
    } else if (tier === 1) {
        // Email logged in but not WhatsApp-verified yet
        contactHtml = [
            '<div class="auth-gate">',
            '  <div class="auth-gate-icon">&#128242;</div>',
            '  <div class="auth-gate-title">One more step &mdash; verify your WhatsApp</div>',
            '  <div class="auth-gate-body">This listing was posted by a real TAMU student. We verify phone numbers so the poster only hears from legit students, not spam.</div>',
            '  <div class="auth-gate-trust"><span class="check">&#10003;</span><span>One-time verification via WhatsApp OTP &mdash; takes about 30 seconds.</span></div>',
            '  <div class="auth-gate-actions">',
            '    <a class="btn-primary" href="/verify/wa">Verify WhatsApp &rarr;</a>',
            '  </div>',
            '</div>'
        ].join('\n');
    } else {
        // Not logged in at all
        contactHtml = [
            '<div class="auth-gate">',
            '  <div class="auth-gate-icon">&#128242;</div>',
            '  <div class="auth-gate-title">Sign in to see contact info</div>',
            '  <div class="auth-gate-body">This listing was posted by a real TAMU student in a private WhatsApp group. Sign in with your TAMU email, then verify your WhatsApp number to see contact details.</div>',
            '  <div class="auth-gate-trust"><span class="check">&#10003;</span><span>Sign in with your TAMU email, then confirm your number via WhatsApp OTP. Takes about 60 seconds.</span></div>',
            '  <div class="auth-gate-actions">',
            '    <a class="btn-primary" href="/login">Sign in with @tamu.edu</a>',
            '  </div>',
            '  <div class="auth-gate-skip">Your info is never shared with third parties.</div>',
            '</div>'
        ].join('\n');
    }

    return [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '<head>',
        h.GA_TAG,
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<title>' + heading + ' — RideSplit</title>',
        '<style>',
        '  * { margin: 0; padding: 0; box-sizing: border-box; }',
        '  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
        '         background: #fafafa; color: #1a1a1a; min-height: 100vh; }',
        '  .nav { background: #fff; border-bottom: 1px solid #e8e8e8; padding: 0 20px;',
        '         display: flex; align-items: center; gap: 20px; height: 52px; }',
        '  .nav-logo { font-size: 16px; font-weight: 700; color: #500000; text-decoration: none;',
        '              letter-spacing: -0.3px; margin-right: 8px; }',
        '  .nav-link { font-size: 14px; color: #444; text-decoration: none; }',
        '  .nav-link:hover { color: #500000; }',
        '  .nav-link.current { font-weight: 700; color: #500000; }',
        '  .nav-right { margin-left: auto; font-size: 13px; }',
        '  .nav-right a { color: #500000; text-decoration: none; }',
        '  .nav-right a:hover { text-decoration: underline; }',
        '  .page { max-width: 700px; margin: 0 auto; padding: 32px 20px 60px; }',
        '  .back-link { display: inline-block; font-size: 13px; color: #500000; text-decoration: none;',
        '               margin-bottom: 20px; }',
        '  .back-link:hover { text-decoration: underline; }',
        '  .listing-badge { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;',
        '                   border-radius: 6px; padding: 3px 10px; margin-bottom: 14px; }',
        '  h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 6px; }',
        '  .detail-meta { font-size: 13px; color: #888; display: flex; align-items: center; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }',
        '  .wa-pill { display: inline-flex; align-items: center; gap: 4px; background: #f0fdf4; color: #166534;',
        '             font-size: 12px; font-weight: 600; border-radius: 20px; padding: 2px 8px; }',
        '  .card { background: #fff; border: 1px solid #e8e8e8; border-radius: 12px;',
        '          padding: 24px; margin-bottom: 16px; }',
        '  .section { margin-bottom: 20px; }',
        '  .section-heading { font-size: 12px; font-weight: 700; text-transform: uppercase;',
        '                     letter-spacing: 0.5px; color: #888; margin-bottom: 10px; }',
        '  .detail-table { width: 100%; border-collapse: collapse; }',
        '  .dl-label { font-size: 13px; color: #888; padding: 6px 12px 6px 0; width: 120px;',
        '              vertical-align: top; white-space: nowrap; }',
        '  .dl-val { font-size: 14px; color: #1a1a1a; padding: 6px 0; }',
        '  .amenities { display: flex; flex-wrap: wrap; gap: 6px; }',
        '  .amenity-pill { background: #f0f0f0; color: #444; font-size: 12px; font-weight: 500;',
        '                  border-radius: 20px; padding: 3px 10px; }',
        '  .contact-row { font-size: 14px; color: #1a1a1a; margin-bottom: 6px; }',
        '  .contact-row.muted { color: #999; }',
        '  .auth-gate { background: #fff; border: 1px solid #e8e8e8; border-radius: 12px; padding: 28px 24px; }',
        '  .auth-gate-icon { font-size: 32px; margin-bottom: 12px; }',
        '  .auth-gate-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; }',
        '  .auth-gate-body { font-size: 14px; color: #555; line-height: 1.6; margin-bottom: 6px; }',
        '  .auth-gate-trust { display: flex; align-items: flex-start; gap: 8px; background: #f0fdf4;',
        '                     border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px;',
        '                     margin: 16px 0 20px; font-size: 13px; color: #166534; line-height: 1.5; }',
        '  .auth-gate-trust .check { flex-shrink: 0; font-size: 14px; margin-top: 1px; }',
        '  .auth-gate-actions { display: flex; flex-direction: column; gap: 10px; }',
        '  .btn-primary { display: inline-block; padding: 11px 24px; background: #500000; color: #fff;',
        '                 border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; text-align: center; }',
        '  .btn-primary:hover { background: #6b0000; }',
        '  .btn-secondary { display: inline-block; padding: 11px 24px; background: #fff; color: #444;',
        '                   border-radius: 8px; font-size: 14px; font-weight: 500; text-decoration: none;',
        '                   text-align: center; border: 1.5px solid #e8e8e8; }',
        '  .btn-secondary:hover { border-color: #aaa; }',
        '  .auth-gate-skip { font-size: 12px; color: #aaa; margin-top: 8px; text-align: center; }',
        '</style>',
        '</head>',
        '<body>',
        '<nav class="nav">',
        '  <a class="nav-logo" href="/">RideSplit</a>',
        '  <a class="nav-link current" href="/housing">Housing</a>',
        '  <a class="nav-link" href="/">Rides</a>',
        '  <div class="nav-right">' + navRight + '</div>',
        '</nav>',
        '<div class="page">',
        '  <a class="back-link" href="/housing">&larr; All listings</a>',
        '  <div class="listing-badge" style="color:' + badgeColor + ';background:' + badgeBg + ';">' + h.escHtml(badgeLabel) + '</div>',
        '  <h1>' + heading + '</h1>',
        '  <div class="detail-meta">',
        '    <span>' + h.escHtml(posted) + '</span>',
        '    <span class="wa-pill">' + WA_SVG + 'Posted via TAMU WhatsApp group</span>',
        '  </div>',
        '  <div class="card">',
        '    <div class="section">',
        '      <div class="section-heading">Details</div>',
        '      <table class="detail-table">',
        '        ' + detailRows,
        '      </table>',
        '    </div>',
        amenitiesHtml,
        '  </div>',
        contactHtml,
        '</div>',
        '</body>',
        '</html>'
    ].join('\n');
}

module.exports = {
    renderLoginPage,
    renderVerifyPage,
    renderPhoneLoginPage,
    renderPhoneVerifyPage,
    renderProfilePage,
    renderStaticPage,
    renderMatchCard,
    renderClusterCard,
    renderDateTable,
    renderHousingBoard,
    renderListingPage
};
