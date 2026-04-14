/**
 * WhatsApp OTP — generate, queue, and verify one-time codes.
 *
 * Flow:
 *   1. sendOtp(phone)     → writes hash to wa_otp_codes, queues plaintext in outbound_queue
 *   2. bot picks up outbound_queue row → sends WA message → marks 'sent'
 *   3. verifyOtp(phone, code) → hashes submitted code, compares, marks used
 */

var crypto = require('crypto');
var { writeClient } = require('./supabase');

var CODE_TTL_MS    = 10 * 60 * 1000;  // 10 minutes
var MAX_ATTEMPTS   = 5;
var MAX_PER_HOUR   = 7;               // max OTPs sent to same phone per hour

function hashCode(code) {
    return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function randomCode() {
    // 6-digit, zero-padded, crypto-random
    var n = crypto.randomInt(0, 1000000);
    return String(n).padStart(6, '0');
}

/**
 * Generate and queue an OTP for the given phone number.
 * Returns { ok: true } or { ok: false, error: string }.
 */
async function sendOtp(phone) {
    if (!phone) return { ok: false, error: 'Phone required' };

    var digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return { ok: false, error: 'Invalid phone number' };

    // Rate limit: max MAX_PER_HOUR sends per phone in the last hour
    var hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    var { count, error: countErr } = await writeClient
        .from('wa_otp_codes')
        .select('id', { count: 'exact', head: true })
        .eq('phone', digits)
        .gte('created_at', hourAgo);

    if (countErr) {
        console.error('[WA-OTP] Rate limit check failed:', countErr.message);
        return { ok: false, error: 'Try again in a moment' };
    }
    if (count >= MAX_PER_HOUR) {
        return { ok: false, error: 'Too many codes sent. Wait an hour and try again.' };
    }

    var code    = randomCode();
    var hash    = hashCode(code);
    var expires = new Date(Date.now() + CODE_TTL_MS).toISOString();

    // Store hash (never the plaintext code)
    var { error: insertErr } = await writeClient.from('wa_otp_codes').insert({
        phone:      digits,
        code_hash:  hash,
        expires_at: expires
    });

    if (insertErr) {
        console.error('[WA-OTP] Insert failed:', insertErr.message);
        return { ok: false, error: 'Could not create code. Try again.' };
    }

    // Queue plaintext code for the bot to send
    var message = `Your Aggie Connect code: *${code}*\n\nValid for 10 minutes. Don't share this with anyone.`;
    var { error: queueErr } = await writeClient.from('outbound_queue').insert({
        contact:      digits,
        channel:      'whatsapp',
        message_type: 'wa_otp',
        payload:      { code, message },
        status:       'pending'
    });

    if (queueErr) {
        console.error('[WA-OTP] Queue failed:', queueErr.message);
        return { ok: false, error: 'Could not queue message. Try again.' };
    }

    console.log(`[WA-OTP] Queued OTP for ${digits}`);
    return { ok: true };
}

/**
 * Verify a submitted code against the most recent valid record for this phone.
 * Returns { ok: true } or { ok: false, error: string }.
 */
async function verifyOtp(phone, code) {
    if (!phone || !code) return { ok: false, error: 'Phone and code required' };

    var digits = phone.replace(/\D/g, '');
    var now    = new Date().toISOString();

    // Find the newest unused, unexpired record for this phone
    var { data: row, error: fetchErr } = await writeClient
        .from('wa_otp_codes')
        .select('id, code_hash, attempts')
        .eq('phone', digits)
        .eq('used', false)
        .gte('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (fetchErr) {
        console.error('[WA-OTP] Fetch failed:', fetchErr.message);
        return { ok: false, error: 'Verification error. Try again.' };
    }
    if (!row) {
        return { ok: false, error: 'Code expired or not found. Request a new one.' };
    }

    // Increment attempt counter first (prevent timing-based enumeration)
    var newAttempts = (row.attempts || 0) + 1;
    await writeClient
        .from('wa_otp_codes')
        .update({ attempts: newAttempts })
        .eq('id', row.id);

    if (newAttempts > MAX_ATTEMPTS) {
        return { ok: false, error: 'Too many wrong attempts. Request a new code.' };
    }

    var submitted = hashCode(code.replace(/\s/g, ''));
    if (submitted !== row.code_hash) {
        return { ok: false, error: 'Incorrect code. Try again.' };
    }

    // Mark used
    await writeClient
        .from('wa_otp_codes')
        .update({ used: true })
        .eq('id', row.id);

    console.log(`[WA-OTP] Verified phone ${digits}`);
    return { ok: true };
}

module.exports = { sendOtp, verifyOtp };
