/**
 * Auth routes: login, verify, logout, log-click
 */

var express = require('express');
var router = express.Router();
var { authClient, setAuthCookies, clearAuthCookies, setPhoneSessionCookie, clearPhoneSessionCookie, parsePhoneSession, optionalAuth } = require('../middleware/auth');
var { writeClient } = require('../lib/supabase');
var { renderLoginPage, renderVerifyPage, renderCheckEmailPage } = require('../lib/views');

var CALLBACK_URL = 'https://ridesplit.app/auth/callback';
var { upsertProfile, linkEmailToProfile } = require('../lib/profiles');

router.get('/login', function(req, res) {
    var prefill = req.query.email || '';
    var err = req.query.err;
    var errMsg = '';
    if (err === 'expired')       errMsg = 'That sign-in link expired or was already used. Request a new one below.';
    else if (err === 'missing_token') errMsg = 'That link is invalid. Request a new one below.';
    else if (err === 'callback') errMsg = 'Sign-in failed. Please try again.';
    res.send(renderLoginPage(errMsg, prefill));
});

router.post('/login', async function(req, res) {
    var email = (req.body.email || '').trim().toLowerCase();

    var isDev = process.env.NODE_ENV !== 'production';
    if (!isDev) {
        if (!email || !email.endsWith('@tamu.edu')) {
            return res.send(renderLoginPage('Please use your @tamu.edu email address.', email));
        }
        if (!/^[^\s@]+@tamu\.edu$/.test(email)) {
            return res.send(renderLoginPage('Please enter a valid @tamu.edu email.', email));
        }
    } else if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.send(renderLoginPage('Please enter a valid email address.', email));
    }

    try {
        var result = await authClient.auth.signInWithOtp({
            email: email,
            options: {
                shouldCreateUser: true,
                emailRedirectTo: CALLBACK_URL
            }
        });

        if (result.error) {
            console.error('[Auth] magic link send error:', JSON.stringify(result.error));
            var errMsg = result.error.message || result.error.msg || JSON.stringify(result.error);
            if (errMsg.includes('rate')) {
                return res.send(renderLoginPage('Too many attempts. Please wait a minute and try again.', email));
            }
            return res.send(renderLoginPage('Failed to send sign-in link. Please try again.', email));
        }

        res.redirect('/check-email?email=' + encodeURIComponent(email));
    } catch (err) {
        console.error('[Auth] OTP send exception:', err.message);
        res.send(renderLoginPage('Something went wrong. Please try again.', email));
    }
});

router.get('/check-email', function(req, res) {
    var email = (req.query.email || '').trim();
    if (!email) return res.redirect('/login');
    res.send(renderCheckEmailPage(email, ''));
});

// GET /auth/callback — magic link lands here with ?token_hash=...&type=...&next=...
router.get('/auth/callback', async function(req, res) {
    var token_hash = (req.query.token_hash || '').trim();
    var type       = (req.query.type || 'magiclink').trim();
    var next       = req.query.next || '/';
    if (!/^\//.test(next)) next = '/'; // only allow relative redirects

    if (!token_hash) {
        console.error('[Auth] callback missing token_hash');
        return res.redirect('/login?err=missing_token');
    }

    try {
        var result = await authClient.auth.verifyOtp({ token_hash: token_hash, type: type });

        if (result.error || !result.data || !result.data.session) {
            console.error('[Auth] callback verify error:', JSON.stringify(result.error), 'type=', type);
            return res.redirect('/login?err=expired');
        }

        setAuthCookies(res, result.data.session.access_token, result.data.session.refresh_token);

        var email = result.data.user && result.data.user.email;
        var phoneToken = req.cookies.wa_phone;
        if (phoneToken && email) {
            var phoneData = parsePhoneSession(phoneToken);
            if (phoneData && phoneData.phone) {
                linkEmailToProfile(phoneData.phone, email)
                    .catch(err => console.error('[Auth] linkEmailToProfile (callback) error:', err.message));
            }
        }

        res.redirect(next);
    } catch (err) {
        console.error('[Auth] callback exception:', err.message);
        res.redirect('/login?err=callback');
    }
});

// Legacy typed-OTP entry — redirect to new check-email page
router.get('/verify', function(req, res) {
    var email = (req.query.email || '').trim();
    if (!email) return res.redirect('/login');
    res.redirect('/check-email?email=' + encodeURIComponent(email));
});

router.post('/verify', async function(req, res) {
    var email = (req.body.email || '').trim().toLowerCase();
    var token = (req.body.token || '').replace(/\D/g, '');

    if (!email || !token) return res.redirect('/login');

    if (!/^\d{6,8}$/.test(token)) {
        return res.send(renderVerifyPage(email, 'Please enter the code from your email.'));
    }

    try {
        var result = await authClient.auth.verifyOtp({
            email: email,
            token: token,
            type: 'email'
        });

        if (result.error) {
            var signupResult = await authClient.auth.verifyOtp({
                email: email,
                token: token,
                type: 'signup'
            });
            if (!signupResult.error) {
                result = signupResult;
            }
        }

        if (result.error) {
            console.error('[Auth] OTP verify error:', JSON.stringify(result.error), 'email=', email, 'tokenLen=', token.length);
            var raw = (result.error.message || '').toLowerCase();
            var errMsg = 'Invalid or expired code. Please request a new one and type exactly what\'s in the email.';
            if (raw.includes('expired') && !raw.includes('invalid')) {
                errMsg = 'Code expired. Please request a new one.';
            } else if (raw.includes('invalid') && !raw.includes('expired')) {
                errMsg = 'Invalid code. Double-check digits and try again.';
            }
            return res.send(renderVerifyPage(email, errMsg));
        }

        if (!result.data.session) {
            return res.send(renderVerifyPage(email, 'Verification failed. Please try again.'));
        }

        setAuthCookies(res, result.data.session.access_token, result.data.session.refresh_token);

        // If user also has an active phone session, link the email to their phone profile
        var phoneToken = req.cookies.wa_phone;
        if (phoneToken) {
            var phoneData = parsePhoneSession(phoneToken);
            if (phoneData && phoneData.phone) {
                linkEmailToProfile(phoneData.phone, email)
                    .catch(err => console.error('[Auth] linkEmailToProfile error:', err.message));
            }
        }

        res.redirect('/');
    } catch (err) {
        console.error('[Auth] OTP verify exception:', err.message);
        res.send(renderVerifyPage(email, 'Something went wrong. Please try again.'));
    }
});

router.get('/logout', function(req, res) {
    clearAuthCookies(res);
    clearPhoneSessionCookie(res);
    res.redirect('/');
});

// ── WhatsApp phone OTP login — DISABLED ──────────────────────────────────────
// Only valid login path: email (/login) + /verify/wa for phone verification.
function redirectToEmailLogin(req, res) {
    var next = req.query.next || req.body && req.body.next || '';
    var suffix = next ? '?next=' + encodeURIComponent(next) : '';
    res.redirect('/login' + suffix);
}
router.get('/login/phone',   redirectToEmailLogin);
router.post('/login/phone',  redirectToEmailLogin);
router.get('/verify/phone',  redirectToEmailLogin);
router.post('/verify/phone', redirectToEmailLogin);

router.post('/log-click', optionalAuth, async function(req, res) {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    try {
        var { route, type, date, phone, page } = req.body;
        await writeClient.from('wa_click_log').insert({
            route: route || null,
            ride_type: type || null,
            ride_date: date || null,
            user_email: req.user.email || null,
            phone: phone || null,
            page: page || null
        });
        res.json({ ok: true });
    } catch (e) {
        console.error('log-click error:', e.message);
        res.json({ ok: false });
    }
});

router.post('/log-expand', optionalAuth, async function(req, res) {
    try {
        var { page, listing_slug, origin, destination, ride_date } = req.body;
        await writeClient.from('card_expand_log').insert({
            page: page || null,
            listing_slug: listing_slug || null,
            origin: origin || null,
            destination: destination || null,
            ride_date: ride_date || null,
            user_email: req.user ? (req.user.email || null) : null,
            phone: req.user ? (req.user.phone || null) : null
        });
        res.json({ ok: true });
    } catch (e) {
        console.error('log-expand error:', e.message);
        res.json({ ok: false });
    }
});

module.exports = router;
