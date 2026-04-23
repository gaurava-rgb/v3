/**
 * Auth routes: login, verify, logout, log-click
 */

var express = require('express');
var router = express.Router();
var { authClient, setAuthCookies, clearAuthCookies, setPhoneSessionCookie, clearPhoneSessionCookie, parsePhoneSession, optionalAuth } = require('../middleware/auth');
var { writeClient } = require('../lib/supabase');
var { renderLoginPage, renderVerifyPage, renderPhoneLoginPage, renderPhoneVerifyPage } = require('../lib/views');
var { sendOtp, verifyOtp } = require('../lib/wa-otp');
var { upsertProfile, linkEmailToProfile } = require('../lib/profiles');

router.get('/login', function(req, res) {
    var prefill = req.query.email || '';
    res.send(renderLoginPage('', prefill));
});

router.post('/login', async function(req, res) {
    var email = (req.body.email || '').trim().toLowerCase();

    if (!email || !email.endsWith('@tamu.edu')) {
        return res.send(renderLoginPage('Please use your @tamu.edu email address.', email));
    }
    if (!/^[^\s@]+@tamu\.edu$/.test(email)) {
        return res.send(renderLoginPage('Please enter a valid @tamu.edu email.', email));
    }

    try {
        var result = await authClient.auth.signInWithOtp({
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

router.get('/verify', function(req, res) {
    var email = (req.query.email || '').trim();
    if (!email) return res.redirect('/login');
    res.send(renderVerifyPage(email, ''));
});

router.post('/verify', async function(req, res) {
    var email = (req.body.email || '').trim().toLowerCase();
    var token = (req.body.token || '').replace(/\s/g, '');

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
