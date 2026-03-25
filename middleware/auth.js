/**
 * Authentication middleware for dashboard routes.
 */

var { authClient, readClient, writeClient } = require('../lib/supabase');

var DIGEST_KEY = process.env.DIGEST_KEY || '';

var COOKIE_OPTS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
};

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

async function optionalAuth(req, res, next) {
    req.user = null;
    var accessToken = req.cookies.access_token;
    var refreshToken = req.cookies.refresh_token;

    if (!accessToken && !refreshToken) return next();

    if (accessToken) {
        try {
            var result = await authClient.auth.getUser(accessToken);
            if (result.data && result.data.user) {
                req.user = result.data.user;
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

/**
 * requireAuth — like optionalAuth but redirects to login if not authenticated
 */
function requireAuth(redirectTo) {
    return async function(req, res, next) {
        await optionalAuth(req, res, function() {
            if (!req.user) {
                return res.redirect('/login?redirect=' + encodeURIComponent(redirectTo || req.originalUrl));
            }
            next();
        });
    };
}

/**
 * Upsert app user row after successful auth. Returns the users table row.
 */
async function upsertAppUser(email, name) {
    if (!email) return null;
    try {
        var payload = { email: email.toLowerCase() };
        if (name) payload.name = name;
        var { data, error } = await writeClient
            .from('users')
            .upsert(payload, { onConflict: 'email', ignoreDuplicates: false })
            .select()
            .single();
        if (error) console.error('[Auth] upsertAppUser error:', error.message);
        return data;
    } catch (e) {
        console.error('[Auth] upsertAppUser exception:', e.message);
        return null;
    }
}

/**
 * Load app user (from our users table) by email. Returns null if not found.
 */
async function loadAppUser(email) {
    if (!email) return null;
    try {
        var { data } = await readClient
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase())
            .single();
        return data;
    } catch (e) {
        return null;
    }
}

module.exports = {
    authClient,
    DIGEST_KEY,
    setAuthCookies,
    clearAuthCookies,
    optionalAuth,
    requireAuth,
    upsertAppUser,
    loadAppUser,
    digestAuth
};
