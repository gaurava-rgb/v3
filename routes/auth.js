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

// ── WhatsApp phone OTP ────────────────────────────────────────────────────────

router.get('/login/phone', function(req, res) {
    var prefill = req.query.phone || '';
    res.send(renderPhoneLoginPage('', prefill));
});

router.post('/login/phone', async function(req, res) {
    var raw = (req.body.phone || '').trim();
    var digits = raw.replace(/\D/g, '');
    if (digits.length === 10) digits = '1' + digits;

    if (!digits || digits.length < 11) {
        return res.send(renderPhoneLoginPage('Please enter a valid US phone number.', raw));
    }

    var result = await sendOtp(digits);
    if (!result.ok) {
        return res.send(renderPhoneLoginPage(result.error, raw));
    }

    res.redirect('/verify/phone?phone=' + encodeURIComponent(digits));
});

router.get('/verify/phone', function(req, res) {
    var phone = (req.query.phone || '').trim();
    if (!phone) return res.redirect('/login/phone');
    res.send(renderPhoneVerifyPage(phone, ''));
});

router.post('/verify/phone', async function(req, res) {
    var phone = (req.body.phone || '').trim();
    var code  = (req.body.code  || '').trim();

    if (!phone) return res.redirect('/login/phone');

    var result = await verifyOtp(phone, code);
    if (!result.ok) {
        return res.send(renderPhoneVerifyPage(phone, result.error));
    }

    setPhoneSessionCookie(res, phone);
    // Create/update profile (non-blocking — don't fail auth if this errors)
    upsertProfile(phone).catch(err => console.error('[Auth] upsertProfile error:', err.message));

    // If user also has an active email session, link the email to this phone's profile
    var accessToken = req.cookies.access_token;
    if (accessToken) {
        authClient.auth.getUser(accessToken).then(function(result) {
            var email = result.data && result.data.user && result.data.user.email;
            if (email) {
                return linkEmailToProfile(phone, email);
            }
        }).catch(err => console.error('[Auth] linkEmailToProfile (phone verify) error:', err.message));
    }

    var dest = req.body.next || req.query.next || '/';
    res.redirect(dest);
});

router.post('/log-click', optionalAuth, async function(req, res) {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    try {
        var { route, type, date } = req.body;
        await writeClient.from('wa_click_log').insert({
            route: route || null,
            ride_type: type || null,
            ride_date: date || null,
            user_email: req.user.email
        });
        res.json({ ok: true });
    } catch (e) {
        console.error('log-click error:', e.message);
        res.json({ ok: false });
    }
});

module.exports = router;
