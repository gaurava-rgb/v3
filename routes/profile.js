/**
 * Profile routes: GET /profile, POST /profile/name
 */

var express = require('express');
var router  = express.Router();
var { optionalAuth } = require('../middleware/auth');
var { getProfile, updateProfileName } = require('../lib/profiles');
var { renderProfilePage } = require('../lib/views');
var { nameLimiter } = require('../middleware/rateLimiter');

router.get('/profile', optionalAuth, async function(req, res) {
    if (!req.user) {
        return res.redirect('/login/phone?next=' + encodeURIComponent('/profile'));
    }

    // Phone-auth users have req.user.phone; email-auth users won't yet
    var phone = req.user.phone || null;
    var profile = phone ? await getProfile(phone) : null;

    res.send(renderProfilePage(req.user, profile));
});

router.post('/profile/name', nameLimiter, optionalAuth, async function(req, res) {
    if (!req.user) return res.status(401).json({ ok: false, error: 'Not authenticated' });
    if (req.user.auth_type !== 'phone') {
        return res.status(400).json({ ok: false, error: 'Name editing requires phone login' });
    }

    var name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ ok: false, error: 'Name cannot be empty' });
    if (name.length > 60) return res.status(400).json({ ok: false, error: 'Name must be 60 characters or fewer' });

    var ok = await updateProfileName(req.user.phone, name);
    if (!ok) return res.status(500).json({ ok: false, error: 'Failed to save. Please try again.' });
    res.json({ ok: true, name });
});

module.exports = router;
