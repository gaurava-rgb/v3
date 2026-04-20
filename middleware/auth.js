/**
 * Authentication middleware for dashboard routes.
 * Supports two session types:
 *   1. Supabase email OTP  → access_token + refresh_token cookies (existing)
 *   2. WhatsApp phone OTP  → wa_phone cookie (HMAC-signed, stateless)
 */

var crypto = require('crypto');
var { authClient } = require('../lib/supabase');
var { isEmailWaVerified, getPhoneForEmail } = require('../lib/profiles');

var DIGEST_KEY  = process.env.DIGEST_KEY || '';
var WA_OTP_SECRET = process.env.WA_OTP_SECRET || 'change-me-in-production';
var PHONE_SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

var COOKIE_OPTS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
};

// ── Phone session (stateless HMAC cookie) ────────────────────────────────────

function signPhoneSession(phone) {
    var payload = Buffer.from(JSON.stringify({
        phone,
        exp: Date.now() + PHONE_SESSION_TTL
    })).toString('base64url');
    var sig = crypto.createHmac('sha256', WA_OTP_SECRET).update(payload).digest('base64url');
    return payload + '.' + sig;
}

function parsePhoneSession(token) {
    if (!token || typeof token !== 'string') return null;
    var dot = token.lastIndexOf('.');
    if (dot < 1) return null;
    var payload = token.slice(0, dot);
    var sig     = token.slice(dot + 1);
    var expected = crypto.createHmac('sha256', WA_OTP_SECRET).update(payload).digest('base64url');
    // Constant-time compare
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    try {
        var data = JSON.parse(Buffer.from(payload, 'base64url').toString());
        if (!data.phone || !data.exp || Date.now() > data.exp) return null;
        return data;
    } catch { return null; }
}

function setPhoneSessionCookie(res, phone) {
    res.cookie('wa_phone', signPhoneSession(phone),
        Object.assign({}, COOKIE_OPTS, { maxAge: PHONE_SESSION_TTL }));
}

function clearPhoneSessionCookie(res) {
    res.clearCookie('wa_phone', { path: '/' });
}

function setAuthCookies(res, accessToken, refreshToken) {
    res.cookie('access_token', accessToken,
        Object.assign({}, COOKIE_OPTS, { maxAge: 60 * 60 * 1000 }));
    res.cookie('refresh_token', refreshToken,
        Object.assign({}, COOKIE_OPTS, { maxAge: 7 * 24 * 60 * 60 * 1000 }));
}

function clearAuthCookies(res) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
}

function getUserTier(user) {
    return user && user.tier != null ? user.tier : 0;
}

async function optionalAuth(req, res, next) {
    req.user = null;

    // Check WhatsApp phone session first (stateless, no network call)
    var phoneToken = req.cookies.wa_phone;
    if (phoneToken) {
        var phoneData = parsePhoneSession(phoneToken);
        if (phoneData) {
            req.user = { phone: phoneData.phone, id: phoneData.phone, auth_type: 'phone', tier: 2 };
            return next();
        }
        clearPhoneSessionCookie(res); // clear invalid/expired cookie
    }

    var accessToken = req.cookies.access_token;
    var refreshToken = req.cookies.refresh_token;

    if (!accessToken && !refreshToken) return next();

    if (accessToken) {
        try {
            var result = await authClient.auth.getUser(accessToken);
            if (result.data && result.data.user) {
                req.user = result.data.user;
                if (req.user.email) {
                    var waVerified = await isEmailWaVerified(req.user.email);
                    req.user.tier = waVerified ? 2 : 1;
                    if (waVerified) req.user.phone = await getPhoneForEmail(req.user.email);
                } else {
                    req.user.tier = 1;
                }
                return next();
            }
        } catch (e) { /* token invalid, try refresh */ }
    }

    if (refreshToken) {
        try {
            var refreshResult = await authClient.auth.refreshSession({ refresh_token: refreshToken });
            if (refreshResult.data && refreshResult.data.session) {
                var session = refreshResult.data.session;
                setAuthCookies(res, session.access_token, session.refresh_token);
                req.user = refreshResult.data.user;
                if (req.user && req.user.email) {
                    var waVerifiedRefresh = await isEmailWaVerified(req.user.email);
                    req.user.tier = waVerifiedRefresh ? 2 : 1;
                    if (waVerifiedRefresh) req.user.phone = await getPhoneForEmail(req.user.email);
                } else if (req.user) {
                    req.user.tier = 1;
                }
                return next();
            }
        } catch (e) {
            console.error('[Auth] Refresh error:', e.message);
        }
    }

    clearAuthCookies(res);
    next();
}

function digestAuth(req, res) {
    if (!DIGEST_KEY) {
        res.status(500).send('DIGEST_KEY not configured');
        return false;
    }
    if (req.cookies.digest_key !== DIGEST_KEY) {
        if (req.method === 'GET') {
            res.redirect('/digest/login');
        } else {
            res.status(401).json({ error: 'Not authenticated' });
        }
        return false;
    }
    return true;
}

module.exports = {
    authClient,
    DIGEST_KEY,
    parsePhoneSession,
    setAuthCookies,
    clearAuthCookies,
    setPhoneSessionCookie,
    clearPhoneSessionCookie,
    optionalAuth,
    digestAuth,
    getUserTier
};
