/** Housing board routes: GET /housing, GET /listing/:slug */

var express = require('express');
var router = express.Router();
var { getActiveListings, getListingBySlug } = require('../lib/housing');
var { renderHousingBoard, renderListingPage } = require('../lib/views');
var { optionalAuth } = require('../middleware/auth');
var isEmailWaVerified = require('../lib/profiles').isEmailWaVerified;

router.get('/housing', optionalAuth, async function(req, res) {
    try {
        var listings = await getActiveListings({ listing_type: null }); // always fetch all
        var tier = 0;
        if (req.user) {
            if (req.user.auth_type === 'phone') {
                tier = 2;
            } else if (req.user.email) {
                var waVerified = await isEmailWaVerified(req.user.email);
                tier = waVerified ? 2 : 1;
            }
        }
        var html = renderHousingBoard(listings, req.query.type || 'all', tier);
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
        var tier = 0;
        if (req.user) {
            if (req.user.auth_type === 'phone') {
                tier = 2;
            } else if (req.user.email) {
                var waVerified = await isEmailWaVerified(req.user.email);
                tier = waVerified ? 2 : 1;
            }
        }

        console.log('[Housing Detail] tier:', tier, 'auth_type:', req.user?.auth_type, 'email:', req.user?.email);

        var html = renderListingPage(listing, tier);
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (err) {
        res.status(500).send('Error loading listing');
    }
});

module.exports = router;
