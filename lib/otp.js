/**
 * OTP code generation, storage, and verification.
 * Codes are stored in-memory with automatic expiry.
 */

var crypto = require('crypto');

var OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
var MAX_ATTEMPTS = 5;

// In-memory store: phone -> { code, expiresAt, attempts }
var store = {};

function generate(phone) {
    var code = String(crypto.randomInt(100000, 999999));
    store[phone] = { code: code, expiresAt: Date.now() + OTP_EXPIRY_MS, attempts: 0 };
    return code;
}

function verify(phone, code) {
    var entry = store[phone];
    if (!entry) return { ok: false, reason: 'no_code' };
    if (Date.now() > entry.expiresAt) {
        delete store[phone];
        return { ok: false, reason: 'expired' };
    }
    entry.attempts++;
    if (entry.attempts > MAX_ATTEMPTS) {
        delete store[phone];
        return { ok: false, reason: 'too_many_attempts' };
    }
    if (entry.code !== code) {
        return { ok: false, reason: 'wrong_code' };
    }
    delete store[phone];
    return { ok: true };
}

// Clean up expired entries every 5 minutes
setInterval(function() {
    var now = Date.now();
    var phones = Object.keys(store);
    for (var i = 0; i < phones.length; i++) {
        if (now > store[phones[i]].expiresAt) delete store[phones[i]];
    }
}, 5 * 60 * 1000);

module.exports = { generate, verify };
