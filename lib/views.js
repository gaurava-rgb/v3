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
        '    <a href="/login">Sign in with @tamu.edu instead</a>',
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

function renderHousingBoard(listings, activeFilter, isLoggedIn) {
    var navRight = isLoggedIn
        ? '<a href="/profile">My Profile</a>'
        : '<a href="/login/phone">Sign in</a>';

    var filterDefs = [
        { key: 'all',            label: 'All' },
        { key: 'sublease',       label: 'Sublease' },
        { key: 'roommate',       label: 'Roommate' },
        { key: 'lease_transfer', label: 'Lease Transfer' }
    ];

    var filterChips = filterDefs.map(function(f) {
        var isActive = (activeFilter === f.key) || (f.key === 'all' && !activeFilter);
        var href = f.key === 'all' ? '/housing' : '/housing?type=' + f.key;
        var cls = isActive ? 'chip chip-active' : 'chip chip-inactive';
        return '<a class="' + cls + '" href="' + href + '">' + f.label + '</a>';
    }).join('\n        ');

    var cardsHtml;
    if (!listings || listings.length === 0) {
        cardsHtml = '<div class="empty">No listings yet.</div>';
    } else {
        var cardParts = [];
        for (var i = 0; i < listings.length; i++) {
            var l = listings[i];
            var type = (l.listing_type || 'other').toLowerCase();
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
            var badgeLabel = (l.listing_type || 'other').toUpperCase().replace('_', ' ');
            var price = l.price ? '$' + l.price + '/mo' : 'Price TBD';
            var beds = (l.bedrooms && l.bathrooms)
                ? h.escHtml(String(l.bedrooms)) + 'bd / ' + h.escHtml(String(l.bathrooms)) + 'bath'
                : (l.bedrooms ? h.escHtml(String(l.bedrooms)) + 'bd' : '');
            var avail = l.available_date
                ? new Date(l.available_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' })
                : 'Flexible';
            var senderName = l.sender_name ? h.escHtml(l.sender_name) : '';
            var location = l.location ? h.escHtml(l.location) : 'Housing Listing';
            var slug = h.escHtml(l.slug || '');

            cardParts.push(
                '<a class="card-link" href="/listing/' + slug + '">' +
                '<div class="listing-card">' +
                '  <div class="listing-badge" style="color:' + badgeColor + ';background:' + badgeBg + ';">' + h.escHtml(badgeLabel) + '</div>' +
                '  <div class="listing-location">' + location + '</div>' +
                '  <div class="listing-price">' + h.escHtml(price) + '</div>' +
                (beds ? '  <div class="listing-beds">' + beds + '</div>' : '') +
                '  <div class="listing-avail">Available: ' + h.escHtml(avail) + '</div>' +
                (senderName ? '  <div class="listing-sender">' + senderName + '</div>' : '') +
                '</div>' +
                '</a>'
            );
        }
        cardsHtml = '<div class="listing-grid">' + cardParts.join('\n') + '</div>';
    }

    return [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '<head>',
        h.GA_TAG,
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<title>Housing Board — RideSplit</title>',
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
        '  .page { max-width: 960px; margin: 0 auto; padding: 32px 20px 60px; }',
        '  h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 20px; }',
        '  .filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }',
        '  .chip { display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 13px;',
        '          font-weight: 500; text-decoration: none; transition: background 0.15s, color 0.15s; }',
        '  .chip-active { background: #500000; color: #fff; border: 1.5px solid #500000; }',
        '  .chip-inactive { background: #fff; color: #444; border: 1.5px solid #e8e8e8; }',
        '  .chip-inactive:hover { border-color: #500000; color: #500000; }',
        '  .empty { color: #888; font-size: 15px; padding: 40px 0; }',
        '  .listing-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }',
        '  @media (max-width: 600px) { .listing-grid { grid-template-columns: 1fr; } }',
        '  .card-link { text-decoration: none; color: inherit; display: block; }',
        '  .listing-card { background: #fff; border: 1px solid #e8e8e8; border-radius: 12px;',
        '                  padding: 18px 20px; transition: box-shadow 0.15s, transform 0.15s; }',
        '  .listing-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.10); transform: translateY(-2px); }',
        '  .listing-badge { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;',
        '                   border-radius: 6px; padding: 2px 8px; margin-bottom: 10px; }',
        '  .listing-location { font-size: 16px; font-weight: 700; margin-bottom: 6px; }',
        '  .listing-price { font-size: 15px; color: #500000; font-weight: 600; margin-bottom: 4px; }',
        '  .listing-beds { font-size: 13px; color: #555; margin-bottom: 4px; }',
        '  .listing-avail { font-size: 13px; color: #555; margin-bottom: 6px; }',
        '  .listing-sender { font-size: 12px; color: #999; }',
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
        '  <h1>Housing Board</h1>',
        '  <div class="filters">',
        '    ' + filterChips,
        '  </div>',
        cardsHtml,
        '</div>',
        '</body>',
        '</html>'
    ].join('\n');
}

// ── Listing Detail Page ─────────────────────────────────────────────────

function renderListingPage(listing, isLoggedIn) {
    var navRight = isLoggedIn
        ? '<a href="/profile">My Profile</a>'
        : '<a href="/login/phone">Sign in</a>';

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
    if (isLoggedIn) {
        // Prefer poster_phone (from wa_contacts), fall back to contact_phone (parsed from message text)
        var resolvedPhone = listing.poster_phone || listing.contact_phone || null;
        var phoneDisplay = '';
        if (resolvedPhone) {
            var cp = String(resolvedPhone).replace(/\D/g, '');
            phoneDisplay = cp.length === 10
                ? '(' + cp.slice(0,3) + ') ' + cp.slice(3,6) + '-' + cp.slice(6)
                : resolvedPhone;
        }
        contactHtml = [
            '<div class="section">',
            '  <div class="section-heading">Contact</div>',
            resolvedPhone ? '  <div class="contact-row"><strong>Phone:</strong> ' + h.escHtml(phoneDisplay) + '</div>' : '',
            listing.contact_info ? '  <div class="contact-row">' + h.escHtml(listing.contact_info) + '</div>' : '',
            (!resolvedPhone && !listing.contact_info) ? '  <div class="contact-row muted">No contact info provided.</div>' : '',
            '</div>'
        ].filter(function(s) { return s !== ''; }).join('\n');
    } else {
        contactHtml = [
            '<div class="signin-prompt">',
            '  <div class="signin-prompt-text">Sign in to see contact info</div>',
            '  <a class="signin-btn" href="/login/phone">Sign in via WhatsApp</a>',
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
        '  h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 24px; }',
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
        '  .signin-prompt { background: #fff; border: 1px solid #e8e8e8; border-radius: 12px;',
        '                   padding: 24px; text-align: center; }',
        '  .signin-prompt-text { font-size: 15px; color: #555; margin-bottom: 14px; }',
        '  .signin-btn { display: inline-block; padding: 10px 24px; background: #500000; color: #fff;',
        '                border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; }',
        '  .signin-btn:hover { background: #6b0000; }',
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
