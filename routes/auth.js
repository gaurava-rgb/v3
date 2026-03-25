/**
 * Auth routes: login (email OTP), verify, logout, log-click, log-view
 */

var express = require('express');
var router = express.Router();
var { authClient, setAuthCookies, clearAuthCookies, optionalAuth, upsertAppUser } = require('../middleware/auth');
var { writeClient } = require('../lib/supabase');
var { renderLoginPage, renderVerifyPage } = require('../lib/views');

// ── Login page ──────────────────────────────────────────────────────────

router.get('/login', function(req, res) {
    var prefill = req.query.email || '';
    var redirect = req.query.redirect || '';
    res.send(renderLoginPage('', prefill, redirect));
});

// ── Email OTP flow ──────────────────────────────────────────────────────

router.post('/login', async function(req, res) {
    var email = (req.body.email || '').trim().toLowerCase();
    var redirect = (req.body.redirect || '').trim();

    if (!email || !email.endsWith('@tamu.edu')) {
        return res.send(renderLoginPage('Please use your @tamu.edu email address.', email, redirect));
    }
    if (!/^[^\s@]+@tamu\.edu$/.test(email)) {
        return res.send(renderLoginPage('Please enter a valid @tamu.edu email.', email, redirect));
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
                return res.send(renderLoginPage('Too many attempts. Please wait a minute and try again.', email, redirect));
            }
            return res.send(renderLoginPage('Failed to send verification code. Please try again.', email, redirect));
        }

        var verifyUrl = '/verify?email=' + encodeURIComponent(email);
        if (redirect) verifyUrl += '&redirect=' + encodeURIComponent(redirect);
        res.redirect(verifyUrl);
    } catch (err) {
        console.error('[Auth] OTP send exception:', err.message);
        res.send(renderLoginPage('Something went wrong. Please try again.', email, redirect));
    }
});

router.get('/verify', function(req, res) {
    var email = (req.query.email || '').trim();
    if (!email) return res.redirect('/login');
    var redirect = req.query.redirect || '';
    res.send(renderVerifyPage(email, '', redirect));
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

        // Upsert into our app users table
        upsertAppUser(email, null);

        var redirectTo = (req.body.redirect || '').trim();
        if (!redirectTo || redirectTo[0] !== '/') redirectTo = '/';
        res.redirect(redirectTo);
    } catch (err) {
        console.error('[Auth] OTP verify exception:', err.message);
        res.send(renderVerifyPage(email, 'Something went wrong. Please try again.'));
    }
});

// ── Logout ──────────────────────────────────────────────────────────────

router.get('/logout', function(req, res) {
    clearAuthCookies(res);
    res.redirect('/');
});

// ── Click logging ───────────────────────────────────────────────────────

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

// ── Contact view logging ────────────────────────────────────────────────

router.post('/log-view', optionalAuth, async function(req, res) {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    try {
        var { contacts, cluster_key } = req.body;
        if (!Array.isArray(contacts) || contacts.length === 0) {
            return res.json({ ok: true });
        }

        var { data: appUser } = await writeClient
            .from('users')
            .select('id')
            .eq('email', req.user.email)
            .single();

        if (!appUser) return res.json({ ok: false });

        var rows = contacts.map(function(contact) {
            return {
                viewer_user_id: appUser.id,
                viewed_contact: contact,
                cluster_key: cluster_key || null
            };
        });

        await writeClient.from('contact_views').insert(rows);
        res.json({ ok: true });
    } catch (e) {
        console.error('log-view error:', e.message);
        res.json({ ok: false });
    }
});

module.exports = router;
