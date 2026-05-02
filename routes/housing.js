/** Housing board routes: GET /housing, GET /listing/:slug */

var express = require('express');
var router = express.Router();
var { getActiveListings, getListingBySlug } = require('../lib/housing');
var { renderHousingBoard, renderListingPage } = require('../lib/views');
var { optionalAuth } = require('../middleware/auth');
var { readClient } = require('../lib/supabase');
var isEmailWaVerified = require('../lib/profiles').isEmailWaVerified;

async function fetchVerifiedSet() {
    try {
        var { data } = await readClient.from('user_profiles').select('phone');
        return new Set((data || []).map(function(r) { return (r.phone || '').replace(/\D/g, ''); }).filter(Boolean));
    } catch (e) { return new Set(); }
}

router.get('/housing', optionalAuth, async function(req, res) {
    try {
        // ?tz=CT|ET|PT writes the cookie then redirects, stripping the param
        if (req.query.tz === 'CT' || req.query.tz === 'ET' || req.query.tz === 'PT') {
            res.cookie('tz_pref', req.query.tz, {
                path: '/', sameSite: 'lax', maxAge: 365 * 24 * 60 * 60 * 1000
            });
            var qs = Object.assign({}, req.query);
            delete qs.tz;
            var keys = Object.keys(qs);
            var tail = keys.length ? '?' + keys.map(function(k) { return encodeURIComponent(k) + '=' + encodeURIComponent(qs[k]); }).join('&') : '';
            return res.redirect(req.path + tail);
        }
        var tzPref = req.tzPref || 'CT';
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
        var userEmail = req.user ? (req.user.email || '') : '';
        var userPhone = req.user ? (req.user.phone || '') : '';
        var verifiedSet = await fetchVerifiedSet();
        if (req.query.demo === '1') {
            (listings || []).forEach(function(l) {
                var p = (l.source_contact || l.poster_phone || l.contact_phone || '').replace(/\D/g, '');
                if (p) verifiedSet.add(p);
            });
        }
        var html = renderHousingBoard(listings, req.query.type || 'all', tier, userEmail, userPhone, verifiedSet, tzPref);
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
