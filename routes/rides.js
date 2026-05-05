var express = require('express');
var router  = express.Router();
var { optionalAuth } = require('../middleware/auth');
var { writeClient } = require('../lib/supabase');
var { updateRequest, deleteRequest } = require('../db');
var h = require('../lib/helpers');

function escHtml(s) { return h.escHtml ? h.escHtml(s) : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Auth guard: fetch ride and verify ownership
async function ownedRide(req, res) {
    if (!req.user || !req.user.phone) {
        res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
        return null;
    }
    const { data: ride } = await writeClient
        .from('v3_requests')
        .select('*')
        .eq('id', req.params.id)
        .single();
    if (!ride) { res.status(404).send('Ride not found'); return null; }

    // Allow if any of user's phones matches source_contact
    var phones = req.user.phones || (req.user.phone ? [req.user.phone] : []);
    var ridePhone = (ride.source_contact || '').replace(/\D/g, '');
    var match = phones.some(function(p) { return p.replace(/\D/g,'') === ridePhone; });
    if (!match) { res.status(403).send('Not your ride'); return null; }
    return ride;
}

// GET /ride/:id/edit
router.get('/ride/:id/edit', optionalAuth, async function(req, res) {
    var ride = await ownedRide(req, res);
    if (!ride) return;
    var rawReturn = req.query.returnTo || '/profile';
    var returnTo = (rawReturn.startsWith('/') && !rawReturn.startsWith('//')) ? rawReturn : '/profile';

    res.send([
        '<!DOCTYPE html><html><head><meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        '<title>Edit Ride</title>',
        '<style>',
        'body{font-family:-apple-system,sans-serif;max-width:520px;margin:40px auto;padding:0 16px;color:#1c1c1e}',
        'h2{color:#500000;margin-bottom:20px}',
        'label{display:block;font-size:13px;font-weight:600;margin:14px 0 4px;color:#3c3c43}',
        'input,select,textarea{width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid #d1d1d6;border-radius:10px;font-size:15px}',
        'textarea{height:100px;resize:vertical}',
        '.btn-row{display:flex;gap:10px;margin-top:24px}',
        '.btn-save{background:#500000;color:#fff;border:none;padding:11px 24px;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer}',
        '.btn-cancel{background:#f2f2f7;color:#1c1c1e;border:none;padding:11px 20px;border-radius:10px;font-size:15px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}',
        '</style></head><body>',
        '<h2>Edit Ride</h2>',
        '<form method="POST" action="/ride/' + escHtml(ride.id) + '/edit">',
        '<input type="hidden" name="returnTo" value="' + escHtml(returnTo) + '">',
        '<label>Origin</label>',
        '<input name="request_origin" value="' + escHtml(ride.request_origin || '') + '">',
        '<label>Destination</label>',
        '<input name="request_destination" value="' + escHtml(ride.request_destination || '') + '" required>',
        '<label>Date</label>',
        '<input type="date" name="ride_plan_date" value="' + escHtml(ride.ride_plan_date || '') + '">',
        '<label>Time</label>',
        '<input type="time" name="ride_plan_time" value="' + escHtml(ride.ride_plan_time || '') + '">',
        '<label>Type</label>',
        '<select name="request_type">',
        '<option value="need"' + (ride.request_type === 'need' ? ' selected' : '') + '>Need ride</option>',
        '<option value="offer"' + (ride.request_type === 'offer' ? ' selected' : '') + '>Offering ride</option>',
        '</select>',
        '<label>Original message</label>',
        '<textarea name="raw_message">' + escHtml(ride.raw_message || '') + '</textarea>',
        '<label>Reason for edit (optional)</label>',
        '<input name="reason" placeholder="e.g. wrong date">',
        '<div class="btn-row">',
        '<button class="btn-save" type="submit">Save</button>',
        '<a class="btn-cancel" href="' + escHtml(returnTo) + '">Cancel</a>',
        '</div></form>',
        '<form method="POST" action="/ride/' + escHtml(ride.id) + '/delete" style="margin-top:32px;padding-top:20px;border-top:1px solid #f2f2f7;" onsubmit="return confirm(\'Delete this ride? This cannot be undone.\');">',
        '<input type="hidden" name="returnTo" value="' + escHtml(returnTo) + '">',
        '<button type="submit" style="background:none;border:none;color:#ff3b30;font-size:14px;cursor:pointer;padding:0;">Delete this ride</button>',
        '</form>',
        '</body></html>'
    ].join('\n'));
});

// POST /ride/:id/edit
router.post('/ride/:id/edit', optionalAuth, async function(req, res) {
    var ride = await ownedRide(req, res);
    if (!ride) return;
    var rawReturn = req.body.returnTo || '/profile';
    var returnTo = (rawReturn.startsWith('/') && !rawReturn.startsWith('//')) ? rawReturn : '/profile';

    var fields = {
        request_origin:      (req.body.request_origin || '').trim() || null,
        request_destination: (req.body.request_destination || '').trim() || null,
        ride_plan_date:      (req.body.ride_plan_date || '').trim() || null,
        ride_plan_time:      (req.body.ride_plan_time || '').trim() || null,
        request_type:        ['need','offer'].includes(req.body.request_type) ? req.body.request_type : ride.request_type,
        raw_message:         (req.body.raw_message || '').trim() || null,
        reason:              (req.body.reason || '').trim() || null
    };

    try {
        await updateRequest(ride.id, fields, req.user.phone);
        res.redirect(returnTo);
    } catch (e) {
        console.error('[rides] updateRequest failed:', e.message);
        res.status(500).send('Failed to save. Please try again.');
    }
});

// POST /ride/:id/delete
router.post('/ride/:id/delete', optionalAuth, async function(req, res) {
    var ride = await ownedRide(req, res);
    if (!ride) return;
    var rawReturn = req.body.returnTo || '/profile';
    var returnTo = (rawReturn.startsWith('/') && !rawReturn.startsWith('//')) ? rawReturn : '/profile';

    try {
        await deleteRequest(ride.id, req.user.phone);
        res.redirect(returnTo);
    } catch (e) {
        console.error('[rides] deleteRequest failed:', e.message);
        res.status(500).send('Failed to delete. Please try again.');
    }
});

module.exports = router;
