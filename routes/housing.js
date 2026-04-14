/** Housing board routes: GET /housing, GET /listing/:slug */

var express = require('express');
var router = express.Router();
var { getActiveListings, getListingBySlug } = require('../lib/housing');
var { renderHousingBoard, renderListingPage } = require('../lib/views');
var { optionalAuth } = require('../middleware/auth');
var { isEmailWaVerified } = require('../lib/profiles');

router.get('/housing', optionalAuth, async function(req, res) {
    try {
        var listings = await getActiveListings({ listing_type: req.query.type || null });
        var isLoggedIn = !!req.user;
        var html = renderHousingBoard(listings, req.query.type || 'all', isLoggedIn);
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (err) {
        res.status(500).send('Error loading housing listings');
    }
});

router.get('/listing/:slug', optionalAuth, async function(req, res) {
    try {
        var listing = await getListingBySlug(req.params.slug);
        if (!listing) {
            return res.status(404).send('Listing not found');
        }
        var isLoggedIn = !!req.user;

        // isWaVerified: true if user has a live phone cookie (completed WA OTP),
        // or if their email is already linked to a verified phone in user_profiles.
        var isWaVerified = false;
        if (req.user) {
            if (req.user.auth_type === 'phone') {
                isWaVerified = true;
            } else if (req.user.email) {
                isWaVerified = await isEmailWaVerified(req.user.email);
            }
        }

        var html = renderListingPage(listing, isLoggedIn, isWaVerified);
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (err) {
        res.status(500).send('Error loading listing');
    }
});

module.exports = router;
