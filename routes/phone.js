/**
 * Phone verification routes — AWS SNS (SMS) with self-managed OTP codes.
 * Future: WhatsApp OTP via second Baileys number, with SMS fallback.
 */

var express = require('express');
var router = express.Router();
var { requireAuth, loadAppUser } = require('../middleware/auth');
var { writeClient } = require('../lib/supabase');
var { renderPhonePage, renderPhoneVerifyPage } = require('../lib/views');
var otp = require('../lib/otp');
var { sendSms } = require('../lib/sms');

// ── Rate limiting (in-memory, per IP) ───────────────────────────────────

var otpAttempts = {};

function checkOtpRate(ip) {
    var now = Date.now();
    var record = otpAttempts[ip];
    if (!record || now - record.start > 15 * 60 * 1000) {
        otpAttempts[ip] = { start: now, count: 1 };
        return true;
    }
    record.count++;
    return record.count <= 5; // Max 5 OTP sends per 15 minutes per IP
}

// ── Phone entry page ────────────────────────────────────────────────────

router.get('/phone', requireAuth('/phone'), async function(req, res) {
    var appUser = await loadAppUser(req.user.email);
    if (appUser && appUser.phone_verified_at) {
        return res.redirect('/clusters');
    }
    res.send(renderPhonePage('', req.user.email));
});

// ── Send OTP ────────────────────────────────────────────────────────────

router.post('/phone', requireAuth('/phone'), async function(req, res) {
    var phone = (req.body.phone || '').replace(/\D/g, '');

    if (!/^\d{10}$/.test(phone)) {
        return res.send(renderPhonePage('Please enter a valid 10-digit US phone number.', req.user.email));
    }

    if (!checkOtpRate(req.ip)) {
        return res.send(renderPhonePage('Too many attempts. Please wait 15 minutes and try again.', req.user.email));
    }

    try {
        var e164 = '+1' + phone;
        var code = otp.generate(e164);

        var result = await sendSms(e164, 'Your RideSplit verification code is: ' + code);

        if (!result.ok) {
            console.error('[Phone] SMS send failed:', result.error);
            return res.send(renderPhonePage('Failed to send code. Please try again.', req.user.email));
        }

        res.redirect('/phone/verify?p=' + encodeURIComponent(phone));
    } catch (err) {
        console.error('[Phone] Send exception:', err.message);
        res.send(renderPhonePage('Something went wrong. Please try again.', req.user.email));
    }
});

// ── Verify code page ────────────────────────────────────────────────────

router.get('/phone/verify', requireAuth('/phone'), function(req, res) {
    var phone = (req.query.p || '').replace(/\D/g, '');
    if (!phone) return res.redirect('/phone');
    res.send(renderPhoneVerifyPage(phone, ''));
});

// ── Check OTP ───────────────────────────────────────────────────────────

router.post('/phone/verify', requireAuth('/phone'), async function(req, res) {
    var phone = (req.body.phone || '').replace(/\D/g, '');
    var code = (req.body.code || '').replace(/\D/g, '');

    if (!phone || !/^\d{10}$/.test(phone)) return res.redirect('/phone');
    if (!code || !/^\d{6}$/.test(code)) {
        return res.send(renderPhoneVerifyPage(phone, 'Please enter the 6-digit code from your SMS.'));
    }

    var e164 = '+1' + phone;
    var result = otp.verify(e164, code);

    if (!result.ok) {
        var msg = 'Invalid code. Please check and try again.';
        if (result.reason === 'expired') msg = 'Code expired. Please request a new one.';
        if (result.reason === 'too_many_attempts') msg = 'Too many attempts. Please request a new code.';
        if (result.reason === 'no_code') msg = 'No code found. Please request a new one.';
        return res.send(renderPhoneVerifyPage(phone, msg));
    }

    try {
        // Update user record with verified phone
        var email = req.user.email.toLowerCase();
        await writeClient
            .from('users')
            .upsert(
                { email: email, phone: e164, phone_verified_at: new Date().toISOString() },
                { onConflict: 'email', ignoreDuplicates: false }
            );

        console.log('[Phone] Verified:', email, '->', e164);
        res.redirect('/clusters');
    } catch (err) {
        console.error('[Phone] DB update exception:', err.message);
        res.send(renderPhoneVerifyPage(phone, 'Something went wrong. Please try again.'));
    }
});

module.exports = router;
