/**
 * Profile route: GET /profile
 */

var express = require('express');
var router  = express.Router();
var { optionalAuth } = require('../middleware/auth');
var { getProfile }   = require('../lib/profiles');
var { renderProfilePage } = require('../lib/views');

router.get('/profile', optionalAuth, async function(req, res) {
    if (!req.user) {
        return res.redirect('/login/phone?next=' + encodeURIComponent('/profile'));
    }

    // Phone-auth users have req.user.phone; email-auth users won't yet
    var phone = req.user.phone || null;
    var profile = phone ? await getProfile(phone) : null;

    res.send(renderProfilePage(req.user, profile));
});

module.exports = router;
