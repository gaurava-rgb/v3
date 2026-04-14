/** Housing board routes: GET /housing, GET /listing/:slug */

var express = require('express');
var router = express.Router();
var { getActiveListings, getListingBySlug } = require('../lib/housing');
var { renderHousingBoard, renderListingPage } = require('../lib/views');
var { optionalAuth } = require('../middleware/auth');

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
        var html = renderListingPage(listing, isLoggedIn);
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (err) {
        res.status(500).send('Error loading listing');
    }
});

module.exports = router;
