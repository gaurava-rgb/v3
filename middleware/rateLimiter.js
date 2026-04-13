/**
 * Rate limiting middleware.
 */

var rateLimit = require('express-rate-limit');

var submitLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many submissions. Please try again later.' }
});

// Used for POST /profile/name — 10 name changes per hour per IP
var nameLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many name changes. Please try again later.' }
});

module.exports = { submitLimiter, nameLimiter };
