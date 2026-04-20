/**
 * WhatsApp tap-to-verify helpers.
 * Uses wa_verify_tokens table in Supabase.
 */

var crypto = require('crypto');
var { writeClient, readClient } = require('./supabase');

var TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * createVerifyToken(email)
 * Insert a new verify token row. Returns { token, expiresAt } or throws.
 */
async function createVerifyToken(email) {
    if (!email) throw new Error('email required');
    var token = crypto.randomBytes(16).toString('hex');
    var expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

    var { error } = await writeClient
        .from('wa_verify_tokens')
        .insert({ token: token, email: email.toLowerCase(), expires_at: expiresAt });

    if (error) throw new Error('[WA-Verify] Insert failed: ' + error.message);
    return { token: token, expiresAt: expiresAt };
}

/**
 * markTokenVerified(token, phone)
 * Called by the Kapso webhook when bot receives the user's message.
 * Returns { ok: true, email } or { ok: false, error: 'expired'|'not_found'|'already_verified' }.
 */
async function markTokenVerified(token, phone) {
    if (!token || !phone) return { ok: false, error: 'missing_params' };

    var { data: row, error: fetchError } = await readClient
        .from('wa_verify_tokens')
        .select('*')
        .eq('token', token)
        .maybeSingle();

    if (fetchError) {
        console.error('[WA-Verify] Fetch error:', fetchError.message);
        return { ok: false, error: 'db_error' };
    }
    if (!row) return { ok: false, error: 'not_found' };
    if (row.verified) return { ok: false, error: 'already_verified' };

    var now = new Date();
    var expires = new Date(row.expires_at);
    if (now > expires) return { ok: false, error: 'expired' };

    var { error: updateError } = await writeClient
        .from('wa_verify_tokens')
        .update({ phone: phone, verified: true })
        .eq('token', token);

    if (updateError) {
        console.error('[WA-Verify] Update error:', updateError.message);
        return { ok: false, error: 'db_error' };
    }

    return { ok: true, email: row.email };
}

/**
 * getTokenStatus(token)
 * Returns { verified, expired, email, phone } or null if token doesn't exist.
 */
async function getTokenStatus(token) {
    if (!token) return null;

    var { data: row, error } = await readClient
        .from('wa_verify_tokens')
        .select('verified, expires_at, email, phone')
        .eq('token', token)
        .maybeSingle();

    if (error) {
        console.error('[WA-Verify] Status fetch error:', error.message);
        return null;
    }
    if (!row) return null;

    var expired = new Date() > new Date(row.expires_at);
    return {
        verified: !!row.verified,
        expired:  expired,
        email:    row.email,
        phone:    row.phone || null
    };
}

module.exports = { createVerifyToken, markTokenVerified, getTokenStatus };
