/**
 * WhatsApp tap-to-verify routes.
 *
 * GET  /verify/wa              — landing page, generates token, renders steps
 * POST /api/verify-wa          — Kapso webhook: receives phone+token from bot
 * GET  /api/wa-verify-status   — poll endpoint for client-side waiting state
 */

var express = require('express');
var router = express.Router();
var { optionalAuth } = require('../middleware/auth');
var { createVerifyToken, markTokenVerified, getTokenStatus } = require('../lib/wa-verify');
var { linkEmailToProfile } = require('../lib/profiles');

var KAPSO_VERIFY_SECRET = process.env.KAPSO_VERIFY_SECRET || '';
var BOT_WA_NUMBER = '12013225726';
var COOKIE_OPTS_VERIFY = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60 * 1000 // 10 minutes
};

// ── GET /verify/wa ────────────────────────────────────────────────────────────

router.get('/verify/wa', optionalAuth, async function(req, res) {
    if (!req.user) return res.redirect('/login');

    var email = req.user.email || '';
    // phone-session users may not have email — if so we can't proceed
    if (!email && req.user.auth_type === 'phone') {
        // Already phone-verified; redirect them back
        return res.redirect('/clusters');
    }

    try {
        var result = await createVerifyToken(email);
        var token = result.token;

        res.cookie('wa_verify_token', token, COOKIE_OPTS_VERIFY);

        var waLink = 'https://wa.me/' + BOT_WA_NUMBER + '?text=verify+' + token;

        res.send(renderWaVerifyPage(token, waLink));
    } catch (err) {
        console.error('[WA-Verify] createVerifyToken error:', err.message);
        res.status(500).send('<p>Something went wrong. Please try again.</p>');
    }
});

// ── POST /api/verify-wa ───────────────────────────────────────────────────────

router.post('/api/verify-wa', async function(req, res) {
    // Bearer auth check
    if (KAPSO_VERIFY_SECRET) {
        var authHeader = req.headers['authorization'] || '';
        var parts = authHeader.split(' ');
        if (parts[0] !== 'Bearer' || parts[1] !== KAPSO_VERIFY_SECRET) {
            return res.status(401).json({ ok: false, error: 'unauthorized' });
        }
    } else {
        console.warn('[WA-Verify] KAPSO_VERIFY_SECRET not set — skipping auth check');
    }

    var phone = (req.body.phone || '').replace(/\D/g, '');
    var token = (req.body.token || '').trim();

    if (!phone || !token) {
        return res.status(400).json({ ok: false, error: 'missing phone or token' });
    }

    try {
        var verifyResult = await markTokenVerified(token, phone);

        if (!verifyResult.ok) {
            console.warn('[WA-Verify] markTokenVerified failed:', verifyResult.error, 'token:', token);
            return res.json({ ok: false, error: verifyResult.error });
        }

        var email = verifyResult.email;
        console.log('[WA-Verify] Verified phone', phone, 'for email', email);

        // Link phone ↔ email in user_profiles (non-blocking)
        linkEmailToProfile(phone, email).catch(function(err) {
            console.error('[WA-Verify] linkEmailToProfile error:', err.message);
        });

        return res.json({ ok: true });
    } catch (err) {
        console.error('[WA-Verify] verify-wa exception:', err.message);
        return res.status(500).json({ ok: false, error: 'internal' });
    }
});

// ── GET /api/wa-verify-status ─────────────────────────────────────────────────

router.get('/api/wa-verify-status', async function(req, res) {
    var token = (req.query.token || '').trim() || (req.cookies.wa_verify_token || '').trim();

    if (!token) {
        return res.json({ verified: false, expired: true });
    }

    try {
        var status = await getTokenStatus(token);
        if (!status) return res.json({ verified: false, expired: true });
        return res.json({ verified: status.verified, expired: status.expired });
    } catch (err) {
        console.error('[WA-Verify] status check error:', err.message);
        return res.json({ verified: false, expired: false });
    }
});

// ── HTML renderer ─────────────────────────────────────────────────────────────

function renderWaVerifyPage(token, waLink) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your WhatsApp — Aggie Connect</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      color: #1a1a1a;
    }

    .card {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 2px 20px rgba(0,0,0,0.1);
      padding: 40px 32px;
      max-width: 480px;
      width: 100%;
    }

    .wa-icon {
      width: 64px;
      height: 64px;
      background: #25d366;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }

    .wa-icon svg { width: 38px; height: 38px; fill: #fff; }

    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      text-align: center;
      margin-bottom: 8px;
      color: #111;
    }

    .subtitle {
      font-size: 0.95rem;
      color: #555;
      text-align: center;
      margin-bottom: 28px;
      line-height: 1.5;
    }

    .steps {
      list-style: none;
      margin-bottom: 24px;
    }

    .steps li {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      margin-bottom: 16px;
      font-size: 0.92rem;
      line-height: 1.5;
      color: #333;
    }

    .step-num {
      flex-shrink: 0;
      width: 26px;
      height: 26px;
      background: #25d366;
      color: #fff;
      font-weight: 700;
      font-size: 0.8rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 1px;
    }

    .warning {
      background: #fffbeb;
      border: 1px solid #f59e0b;
      border-radius: 10px;
      padding: 14px 16px;
      font-size: 0.87rem;
      color: #92400e;
      margin-bottom: 28px;
      line-height: 1.5;
    }

    .warning strong { font-weight: 600; }

    .btn-wa {
      display: block;
      width: 100%;
      background: #25d366;
      color: #fff;
      text-decoration: none;
      text-align: center;
      font-size: 1rem;
      font-weight: 600;
      padding: 16px 20px;
      border-radius: 12px;
      transition: background 0.15s;
      line-height: 1.3;
    }

    .btn-wa:hover { background: #1ebe5d; }

    /* ── Waiting state (hidden by default) ── */
    #waiting-state { display: none; }
    #waiting-state.visible { display: block; }
    #main-content.hidden { display: none; }

    .spinner-wrap {
      text-align: center;
      margin: 28px 0 16px;
    }

    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #e5e7eb;
      border-top-color: #25d366;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .countdown {
      font-size: 2rem;
      font-weight: 700;
      color: #25d366;
      text-align: center;
      margin-bottom: 8px;
      font-variant-numeric: tabular-nums;
    }

    .waiting-label {
      text-align: center;
      font-size: 0.93rem;
      color: #555;
      margin-bottom: 20px;
    }

    .try-again {
      text-align: center;
      font-size: 0.85rem;
      color: #888;
    }

    .try-again a {
      color: #25d366;
      text-decoration: underline;
      cursor: pointer;
    }

    /* ── Success state ── */
    #success-state { display: none; }
    #success-state.visible { display: block; text-align: center; }

    .success-icon {
      width: 64px;
      height: 64px;
      background: #dcfce7;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }

    .success-icon svg { width: 36px; height: 36px; }

    .success-title {
      font-size: 1.3rem;
      font-weight: 700;
      color: #15803d;
      margin-bottom: 10px;
    }

    .success-sub {
      font-size: 0.93rem;
      color: #555;
      margin-bottom: 28px;
      line-height: 1.5;
    }

    .btn-go {
      display: inline-block;
      background: #111;
      color: #fff;
      text-decoration: none;
      font-size: 0.95rem;
      font-weight: 600;
      padding: 14px 28px;
      border-radius: 10px;
      transition: background 0.15s;
    }

    .btn-go:hover { background: #333; }
  </style>
</head>
<body>
<div class="card">

  <!-- Main / initial state -->
  <div id="main-content">
    <div class="wa-icon">
      <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 2C8.28 2 2 8.28 2 16c0 2.48.67 4.8 1.84 6.8L2 30l7.42-1.82A14 14 0 0 0 16 30c7.72 0 14-6.28 14-14S23.72 2 16 2zm7.16 19.62c-.3.83-1.74 1.59-2.4 1.64-.62.05-1.2.29-4.06-.85-3.38-1.37-5.56-4.82-5.73-5.05-.17-.22-1.37-1.83-1.37-3.49 0-1.66.87-2.47 1.18-2.81.3-.34.66-.42.88-.42.22 0 .44 0 .63.01.2.01.48-.08.75.57.3.68 1.01 2.47 1.1 2.65.09.18.15.4.03.63-.12.22-.18.36-.35.56-.17.2-.36.44-.51.59-.17.17-.35.35-.15.69.2.34.89 1.47 1.91 2.38 1.31 1.17 2.41 1.53 2.75 1.7.34.17.54.14.74-.08.2-.23.86-1 1.09-1.34.23-.34.46-.28.77-.17.31.11 1.98.93 2.32 1.1.34.17.57.26.65.4.08.14.08.8-.22 1.63z"/>
      </svg>
    </div>

    <h1>Verify your WhatsApp</h1>
    <p class="subtitle">Link your WhatsApp number to your Aggie Connect account.</p>

    <ol class="steps">
      <li>
        <span class="step-num">1</span>
        <span>Use the same phone number you're in the TAMU ride-share groups with — that's the number tied to your listings.</span>
      </li>
      <li>
        <span class="step-num">2</span>
        <span>Tap the button below. It'll open a WhatsApp chat with our bot with a message already typed for you.</span>
      </li>
      <li>
        <span class="step-num">3</span>
        <span>Just tap <strong>Send</strong>. Once we receive your message (within 5 minutes), your account unlocks automatically.</span>
      </li>
    </ol>

    <div class="warning">
      <strong>Important:</strong> This only works if you message us from the number you use in the TAMU groups. Different number = verification fails.
    </div>

    <a id="btn-open-wa" class="btn-wa" href="${waLink}">
      Open WhatsApp &amp; Send Verification
    </a>
  </div>

  <!-- Waiting state -->
  <div id="waiting-state">
    <div class="spinner-wrap">
      <div class="spinner"></div>
    </div>
    <div class="countdown" id="countdown">5:00</div>
    <p class="waiting-label">Waiting for your WhatsApp message&hellip;</p>
    <p class="try-again">
      Didn't open? <a id="try-again-link" href="${waLink}">Try again</a>
    </p>
  </div>

  <!-- Success state -->
  <div id="success-state">
    <div class="success-icon">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="12" fill="#22c55e"/>
        <path d="M7 12.5l3.5 3.5 6.5-7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <p class="success-title">WhatsApp verified!</p>
    <p class="success-sub">Your number is now linked. You can view contact info on all ride listings.</p>
    <a class="btn-go" href="/clusters">Go to Rides Board &rarr;</a>
  </div>

</div>

<script>
(function() {
  var TOKEN = ${JSON.stringify(token)};
  var POLL_INTERVAL = 2000; // 2s
  var TTL_SECONDS = 300;    // 5 minutes

  var mainEl     = document.getElementById('main-content');
  var waitingEl  = document.getElementById('waiting-state');
  var successEl  = document.getElementById('success-state');
  var countdownEl = document.getElementById('countdown');
  var btnWa      = document.getElementById('btn-open-wa');

  var pollTimer = null;
  var countTimer = null;
  var secondsLeft = TTL_SECONDS;

  function formatTime(s) {
    var m = Math.floor(s / 60);
    var sec = s % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function startCountdown() {
    countdownEl.textContent = formatTime(secondsLeft);
    countTimer = setInterval(function() {
      secondsLeft--;
      if (secondsLeft <= 0) {
        clearInterval(countTimer);
        countdownEl.textContent = '0:00';
        stopPolling();
        return;
      }
      countdownEl.textContent = formatTime(secondsLeft);
    }, 1000);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function showWaiting() {
    mainEl.classList.add('hidden');
    waitingEl.classList.add('visible');
    startCountdown();
    poll(); // immediate first check
    pollTimer = setInterval(poll, POLL_INTERVAL);
  }

  function showSuccess() {
    stopPolling();
    clearInterval(countTimer);
    waitingEl.classList.remove('visible');
    successEl.classList.add('visible');
  }

  function poll() {
    fetch('/api/wa-verify-status?token=' + encodeURIComponent(TOKEN))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.verified) {
          showSuccess();
        } else if (data.expired) {
          stopPolling();
        }
      })
      .catch(function() { /* network hiccup — keep polling */ });
  }

  // Switch to waiting state when user clicks the WA button
  btnWa.addEventListener('click', function() {
    setTimeout(showWaiting, 600);
  });
})();
</script>
</body>
</html>`;
}

module.exports = router;
