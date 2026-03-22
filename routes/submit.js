/**
 * Ride submission route (web form POST)
 */

var express = require('express');
var router = express.Router();
var { optionalAuth } = require('../middleware/auth');
var { submitLimiter } = require('../middleware/rateLimiter');
var { saveRequest } = require('../db');
var { processRequest } = require('../matcher');
var { normalizeLocation } = require('../normalize');

router.post('/submit', submitLimiter, optionalAuth, async function(req, res) {
    if (!req.user) {
        return res.status(401).json({ error: 'You must be signed in to submit a ride.' });
    }

    var type = (req.body.type || '').trim();
    var origin = (req.body.origin || '').trim();
    var destination = (req.body.destination || '').trim();
    var date = (req.body.date || '').trim();
    var name = (req.body.name || '').trim();
    var phone = (req.body.phone || '').trim();
    var time = (req.body.time || '').trim();
    var comments = (req.body.comments || '').trim();
    var originOther = (req.body.originOther || '').trim();
    var destOther = (req.body.destOther || '').trim();

    if (origin === 'Other' && originOther) origin = originOther;
    if (destination === 'Other' && destOther) destination = destOther;

    var errors = [];
    var errorFields = [];
    if (type !== 'need' && type !== 'offer') { errors.push('Select Looking or Offering.'); errorFields.push('type'); }
    if (!origin) { errors.push('Origin is required.'); errorFields.push('origin'); }
    if (!destination) { errors.push('Destination is required.'); errorFields.push('destination'); }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push('Valid date is required.'); errorFields.push('date'); }
    if (!name) { errors.push('Name is required.'); errorFields.push('name'); }
    if (!phone || !/^\+?[\d\s\-()]{7,}$/.test(phone)) { errors.push('Valid phone number is required.'); errorFields.push('phone'); }
    if (origin && destination && normalizeLocation(origin) === normalizeLocation(destination)) {
        errors.push('Origin and destination cannot be the same.');
        errorFields.push('origin', 'destination');
    }
    if (date) {
        var today = new Date().toISOString().split('T')[0];
        if (date < today) { errors.push('Date must be today or in the future.'); errorFields.push('date'); }
    }
    if (errors.length > 0) {
        return res.status(400).json({ error: errors.join(' '), fields: errorFields });
    }

    var phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length === 10) phoneDigits = '1' + phoneDigits;

    var typeLabel = type === 'offer' ? 'Offering ride' : 'Looking for ride';
    var rawMessage = typeLabel + ' from ' + origin + ' to ' + destination;
    if (time) rawMessage += ' around ' + time;
    if (comments) rawMessage += '. ' + comments;

    var details = {};
    if (comments) details.description = comments;

    try {
        var request = await saveRequest({
            source: 'web-form',
            sourceGroup: null,
            sourceContact: phoneDigits,
            senderName: name,
            type: type,
            category: 'ride',
            date: date,
            ridePlanTime: time || null,
            dateFuzzy: false,
            possibleDates: [],
            timeFuzzy: !time,
            origin: origin,
            destination: destination,
            details: details,
            rawMessage: rawMessage
        });

        if (!request) {
            return res.status(409).json({ error: 'A matching ride request already exists.' });
        }

        var matches = await processRequest(request);
        var matchCount = matches ? matches.length : 0;
        console.log('[Dashboard] Web form submission saved:', request.id,
            matchCount > 0 ? '(' + matchCount + ' matches)' : '');

        return res.json({ success: true, requestId: request.id, matches: matchCount });
    } catch (err) {
        console.error('[Dashboard] Submit error:', err.message);
        return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

module.exports = router;
