/**
 * Profile routes: GET /profile, POST /profile/name
 */

var express = require('express');
var router  = express.Router();
var { optionalAuth } = require('../middleware/auth');
var { getProfile, updateProfileName, getPhonesForEmail } = require('../lib/profiles');
var { fetchUserListings } = require('../lib/data');
var { renderProfilePage } = require('../lib/views');
var { nameLimiter } = require('../middleware/rateLimiter');

router.get('/profile', optionalAuth, async function(req, res) {
    if (!req.user) {
        return res.redirect('/login/phone?next=' + encodeURIComponent('/profile'));
    }

    var phone = req.user.phone || null;
    var profile = phone ? await getProfile(phone) : null;

    // Collect all phones linked to this user (for multi-phone support)
    var email = (profile && profile.email) || req.user.email || null;
    var phones = [];
    if (email) phones = await getPhonesForEmail(email);
    if (phone && phones.indexOf(phone) === -1) phones.push(phone);

    var listings = await fetchUserListings({ phones: phones });

    res.send(renderProfilePage(req.user, profile, { phones: phones, email: email, listings: listings }));
});

router.post('/profile/name', nameLimiter, optionalAuth, async function(req, res) {
    if (!req.user) return res.status(401).json({ ok: false, error: 'Not authenticated' });
    if (!req.user.phone) {
        return res.status(400).json({ ok: false, error: 'Verify a phone via WhatsApp to edit your name' });
    }

    var name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ ok: false, error: 'Name cannot be empty' });
    if (name.length > 60) return res.status(400).json({ ok: false, error: 'Name must be 60 characters or fewer' });

    var ok = await updateProfileName(req.user.phone, name);
    if (!ok) return res.status(500).json({ ok: false, error: 'Failed to save. Please try again.' });
    res.json({ ok: true, name });
});

module.exports = router;
