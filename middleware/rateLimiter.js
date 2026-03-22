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

module.exports = { submitLimiter };
