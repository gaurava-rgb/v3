/**
 * Aggie Connect — Dashboard v3.6
 * Public ride board at ridesplit.app
 * Port: 3004
 *
 * This file wires together middleware and routes.
 * Business logic lives in lib/, middleware/, and routes/.
 */

require('dotenv').config();

var express = require('express');
var cookieParser = require('cookie-parser');

// ── App setup ────────────────────────────────────────────────────────────

var app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Attach req.tzPref ('CT' | 'ET' | 'PT') from cookie for all downstream routes.
var { parseTzPref } = require('./lib/helpers');
app.use(function(req, res, next) {
    req.tzPref = parseTzPref(req);
    next();
});

app.use('/public', express.static(__dirname + '/public'));

// ── Routes ───────────────────────────────────────────────────────────────

app.use(require('./routes/clusters'));
app.use(require('./routes/auth'));
app.use(require('./routes/verify'));
app.use(require('./routes/profile'));
app.use(require('./routes/submit'));
app.use(require('./routes/housing'));
app.use(require('./routes/digest'));
app.use(require('./routes/static'));

// ── Dev-only helpers (never active in production) ────────────────────
if (process.env.NODE_ENV !== 'production') {
    var { markTokenVerified } = require('./lib/wa-verify');
    var { linkEmailToProfile } = require('./lib/profiles');

    // GET /dev/fake-wa
    // Simulates the Kapso bot webhook. Reads wa_verify_token cookie,
    // marks it verified with a test phone number, links to profile.
    // Use while /verify/wa is open — page poll detects it within 2s.
    app.get('/dev/fake-wa', async function(req, res) {
        var token = (req.cookies.wa_verify_token || '').trim();
        if (!token) return res.status(400).send('No wa_verify_token cookie found. Open /verify/wa first and click the button.');
        var testPhone = req.query.phone || '19791234567';
        try {
            var result = await markTokenVerified(token, testPhone);
            if (!result.ok) return res.status(400).send('markTokenVerified failed: ' + result.error);
            await linkEmailToProfile(testPhone, result.email).catch(function(e) {
                console.warn('[dev/fake-wa] linkEmailToProfile error:', e.message);
            });
            res.send('OK — phone ' + testPhone + ' linked to ' + result.email + '. /verify/wa will auto-redirect within 2s.');
        } catch (err) {
            res.status(500).send('Error: ' + err.message);
        }
    });

    console.log('[Dev] /dev/fake-wa enabled (simulate WA verification)');
}

// ── Start ────────────────────────────────────────────────────────────────

var PORT = process.env.DASHBOARD_PORT || 3004;
app.listen(PORT, '0.0.0.0', function() {
    console.log('[Dashboard] v3.6 running at http://localhost:' + PORT);
});
