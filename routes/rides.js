var express = require('express');
var router  = express.Router();
var { optionalAuth } = require('../middleware/auth');
var { writeClient } = require('../lib/supabase');
var { updateRequest, deleteRequest } = require('../db');
var h = require('../lib/helpers');

function escHtml(s) { return h.escHtml ? h.escHtml(s) : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

var AIRPORTS = {
    Houston:      [{ code: 'IAH', label: 'IAH — Bush Intercontinental' }, { code: 'HOU', label: 'HOU — Hobby' }],
    Dallas:       [{ code: 'DFW', label: 'DFW — Dallas/Fort Worth' },     { code: 'DAL', label: 'DAL — Love Field' }],
    'Fort Worth': [{ code: 'DFW', label: 'DFW — Dallas/Fort Worth' },     { code: 'DAL', label: 'DAL — Love Field' }],
    Austin:       [{ code: 'AUS', label: 'AUS — Austin-Bergstrom' }],
};

var KNOWN_CITIES = ['College Station','Bryan','Houston','Dallas','Fort Worth','Austin'];

var PREF_OPTS = [
    { val: 'will_drive', icon: '\u{1F697}', label: 'Will drive' },
    { val: 'rental',     icon: '\u{1F511}', label: 'Rental car' },
    { val: 'cab',        icon: '\u{1F695}', label: 'Cab / Uber' },
    { val: 'flexible',   icon: '\u{1F91D}', label: 'Flexible' },
];

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

    var details     = ride.request_details || {};
    var savedSeats  = parseInt(details.seats, 10) || 1;
    var savedPrefs  = Array.isArray(details.prefs) ? details.prefs : [];
    var savedPrefsOther = escHtml(details.prefs_other || '');
    var savedAirport    = escHtml(details.airport || '');
    var otherSel = savedPrefs.includes('other');

    // Build origin/destination <select> options
    function cityOptions(current) {
        var opts = KNOWN_CITIES.map(function(c) {
            return '<option' + (current === c ? ' selected' : '') + '>' + escHtml(c) + '</option>';
        });
        // If current value is non-standard, add it as a custom option
        if (current && !KNOWN_CITIES.includes(current)) {
            opts.push('<option selected value="' + escHtml(current) + '">' + escHtml(current) + '</option>');
        }
        return opts.join('');
    }

    // Build pref chips HTML
    var prefChipsHtml = PREF_OPTS.map(function(p) {
        var sel = savedPrefs.includes(p.val);
        return '<label class="pref-chip' + (sel ? ' sel' : '') + '">' +
            '<input type="checkbox" name="prefs" value="' + p.val + '"' + (sel ? ' checked' : '') +
            ' onchange="this.parentNode.classList.toggle(\'sel\',this.checked)">' +
            p.icon + ' ' + escHtml(p.label) +
            '</label>';
    }).join('') +
    '<label class="pref-chip pref-other' + (otherSel ? ' sel' : '') + '">' +
        '<input type="checkbox" name="prefs" value="other"' + (otherSel ? ' checked' : '') +
        ' onchange="this.parentNode.classList.toggle(\'sel\',this.checked);' +
        'document.getElementById(\'prefOther\').style.display=this.checked?\'block\':\'none\';' +
        'if(this.checked)document.getElementById(\'prefOther\').focus()">' +
        '✏️ Other…' +
    '</label>';

    var airportsJson = JSON.stringify(AIRPORTS);

    res.send([
        '<!DOCTYPE html><html><head><meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        '<title>Modify Ride</title>',
        '<style>',
        'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:520px;margin:40px auto;padding:0 16px 80px;color:#1c1c1e}',
        'h2{color:#500000;margin-bottom:4px;font-size:22px}',
        '.subtitle{font-size:13px;color:#8e8e93;margin:0 0 22px}',
        '.field-lbl{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#8e8e93;margin:14px 0 5px}',
        'input[type=text],input[type=date],input[type=time],select,textarea{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #e5e5ea;border-radius:10px;font-size:15px;color:#1c1c1e;background:#fafafa;appearance:none}',
        'input:focus,select:focus,textarea:focus{outline:none;border-color:#500000;background:#fff}',
        'textarea{height:90px;resize:vertical;line-height:1.45}',
        '.row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
        '.sec-hdr{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#500000;margin:22px 0 12px;display:flex;align-items:center;gap:8px}',
        '.sec-hdr::after{content:"";flex:1;height:1px;background:#f2f2f7}',
        '/* Stepper */',
        '.stepper{display:flex;align-items:center;border:1px solid #e5e5ea;border-radius:10px;overflow:hidden;width:fit-content}',
        '.stepper button{width:40px;height:40px;border:none;background:#fafafa;font-size:20px;cursor:pointer;color:#500000;flex-shrink:0}',
        '.stepper button:hover{background:#f2f2f7}',
        '.stepper span{min-width:44px;text-align:center;font-size:16px;font-weight:600;border-left:1px solid #e5e5ea;border-right:1px solid #e5e5ea;line-height:40px}',
        '/* Pref chips */',
        '.chips{display:flex;flex-wrap:wrap;gap:8px}',
        '.pref-chip{display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:20px;font-size:14px;font-weight:500;border:1.5px solid #e5e5ea;background:#fafafa;cursor:pointer;user-select:none}',
        '.pref-chip input{display:none}',
        '.pref-chip.sel{background:#500000;border-color:#500000;color:#fff}',
        '.pref-other{border-style:dashed;color:#8e8e93}',
        '.pref-other.sel{border-style:solid;color:#fff}',
        '/* Airport toggle */',
        '.toggle-row{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border:1px solid #e5e5ea;border-radius:12px;background:#fafafa;gap:12px}',
        '.tinfo{display:flex;flex-direction:column;gap:2px}',
        '.tlabel{font-size:15px;font-weight:500}',
        '.tdesc{font-size:12px;color:#8e8e93}',
        '.tog-btn{width:48px;height:28px;border-radius:14px;background:#e5e5ea;border:none;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0}',
        '.tog-btn.on{background:#34c759}',
        '.tog-btn::after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .2s}',
        '.tog-btn.on::after{transform:translateX(20px)}',
        '.airport-sub{display:none;padding:8px 2px 0}',
        '.airport-sub.show{display:block}',
        '.airport-chips{display:flex;flex-wrap:wrap;gap:8px}',
        '.airport-chip{display:inline-block;padding:6px 13px;border-radius:16px;font-size:13px;font-weight:500;border:1.5px solid #e5e5ea;background:#fafafa;cursor:pointer;color:#1c1c1e}',
        '.airport-chip.sel{background:#007aff;border-color:#007aff;color:#fff}',
        '/* Buttons */',
        '.btn-row{display:flex;gap:10px;margin-top:28px}',
        '.btn-save{flex:1;background:#500000;color:#fff;border:none;padding:13px;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer}',
        '.btn-cancel{background:#f2f2f7;color:#1c1c1e;border:none;padding:13px 20px;border-radius:12px;font-size:16px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;font-weight:500}',
        '.delete-row{margin-top:0;padding-top:20px;border-top:1px solid #f2f2f7;text-align:center}',
        '</style></head><body>',

        '<h2>Modify Ride</h2>',
        '<p class="subtitle">Changes apply to all dates in this post.</p>',

        '<form method="POST" action="/ride/' + escHtml(ride.id) + '/edit">',
        '<input type="hidden" name="returnTo" value="' + escHtml(returnTo) + '">',

        '<div class="sec-hdr">Basic info</div>',

        '<label class="field-lbl">Type</label>',
        '<select name="request_type">',
        '<option value="need"'  + (ride.request_type === 'need'  ? ' selected' : '') + '>Need a ride</option>',
        '<option value="offer"' + (ride.request_type === 'offer' ? ' selected' : '') + '>Offering a ride</option>',
        '</select>',

        '<div class="row2" style="margin-top:14px">',
        '<div>',
        '<label class="field-lbl">From</label>',
        '<select name="request_origin" id="selFrom" oninput="updateAirport()" onchange="updateAirport()">',
        '<option value="">—</option>',
        cityOptions(ride.request_origin || ''),
        '</select></div>',

        '<div>',
        '<label class="field-lbl">To</label>',
        '<select name="request_destination" id="selTo" oninput="updateAirport()" onchange="updateAirport()">',
        '<option value="">—</option>',
        cityOptions(ride.request_destination || ''),
        '</select></div>',
        '</div>',

        '<div class="row2" style="margin-top:14px">',
        '<div><label class="field-lbl">Date</label><input type="date" name="ride_plan_date" value="' + escHtml(ride.ride_plan_date || '') + '"></div>',
        '<div><label class="field-lbl">Time</label><input type="time" name="ride_plan_time" value="' + escHtml(ride.ride_plan_time || '') + '"></div>',
        '</div>',

        // Airport section — shown by JS when city has airport
        '<div id="airportSection" style="margin-top:14px;display:none">',
        '<div class="toggle-row">',
        '<div class="tinfo">',
        '<span class="tlabel">✈️  Airport trip?</span>',
        '<span class="tdesc" id="airportDesc"></span>',
        '</div>',
        '<button type="button" class="tog-btn" id="airportToggle" onclick="toggleAirport()"></button>',
        '</div>',
        '<div class="airport-sub' + (savedAirport ? ' show' : '') + '" id="airportSub">',
        '<div style="font-size:12px;color:#8e8e93;margin-bottom:6px">Which airport?</div>',
        '<div class="airport-chips" id="airportChips"></div>',
        '<input type="hidden" name="airport" id="airportVal" value="' + savedAirport + '">',
        '</div>',
        '</div>',

        '<div class="sec-hdr">Your message</div>',
        '<label class="field-lbl">Original WhatsApp message</label>',
        '<textarea name="raw_message">' + escHtml(ride.raw_message || '') + '</textarea>',

        '<div class="sec-hdr">Additional info</div>',

        '<label class="field-lbl">Seats available / needed</label>',
        '<div style="display:flex;align-items:center;gap:12px">',
        '<div class="stepper">',
        '<button type="button" onclick="adjSeats(-1)">−</button>',
        '<span id="seatDisplay">' + savedSeats + '</span>',
        '<button type="button" onclick="adjSeats(1)">+</button>',
        '</div>',
        '<span style="font-size:13px;color:#8e8e93">seats</span>',
        '</div>',
        '<input type="hidden" name="seats" id="seatsVal" value="' + savedSeats + '">',

        '<label class="field-lbl" style="margin-top:16px">Transport <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#c7c7cc">(pick all that apply)</span></label>',
        '<div class="chips">' + prefChipsHtml + '</div>',
        '<input type="text" name="prefs_other" id="prefOther" placeholder="e.g. Splitting Zipcar, no smoking, have dog…" value="' + savedPrefsOther + '" style="margin-top:8px;display:' + (otherSel ? 'block' : 'none') + '">',

        '<div class="sec-hdr">Edit note</div>',
        '<label class="field-lbl">Reason <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#c7c7cc">(optional)</span></label>',
        '<input type="text" name="reason" placeholder="e.g. date changed, added seats">',

        '<div class="btn-row">',
        '<button class="btn-save" type="submit">Save changes</button>',
        '<a class="btn-cancel" href="' + escHtml(returnTo) + '">Cancel</a>',
        '</div></form>',

        '<form method="POST" action="/ride/' + escHtml(ride.id) + '/delete" onsubmit="return confirm(\'Delete this ride? This cannot be undone.\');">',
        '<input type="hidden" name="returnTo" value="' + escHtml(returnTo) + '">',
        '<div class="delete-row"><button type="submit" style="background:none;border:none;color:#ff3b30;font-size:14px;cursor:pointer;padding:0;">Delete this ride</button></div>',
        '</form>',

        '<script>',
        'var AIRPORTS=' + airportsJson + ';',
        'var airportOn=' + (savedAirport ? 'true' : 'false') + ';',
        'var _savedAirport=' + JSON.stringify(savedAirport) + ';',

        'function updateAirport(){',
        '  var from=document.getElementById("selFrom").value;',
        '  var to=document.getElementById("selTo").value;',
        '  var city=AIRPORTS[from]?from:(AIRPORTS[to]?to:null);',
        '  var sec=document.getElementById("airportSection");',
        '  if(!city){sec.style.display="none";return;}',
        '  sec.style.display="block";',
        '  var isOrigin=!!AIRPORTS[from];',
        '  document.getElementById("airportDesc").textContent="Is the "+(isOrigin?"origin":"destination")+" an airport?";',
        '  var chips=document.getElementById("airportChips");',
        '  chips.innerHTML=AIRPORTS[city].map(function(a){',
        '    var sel=_savedAirport===a.code;',
        '    return "<div class=\\"airport-chip"+(sel?" sel":"")+"\\" onclick=\\"selAirport(this,\'"+a.code+"\')\\" style=\\"user-select:none\\">"+a.label+"</div>";',
        '  }).join("")+',
        '  "<div class=\\"airport-chip"+(_savedAirport==="not_sure"?" sel":"")+"\\" onclick=\\"selAirport(this,\'not_sure\')\\" style=\\"user-select:none\\">Not sure</div>";',
        '  document.getElementById("airportToggle").classList.toggle("on",airportOn);',
        '}',

        'function toggleAirport(){',
        '  airportOn=!airportOn;',
        '  document.getElementById("airportToggle").classList.toggle("on",airportOn);',
        '  document.getElementById("airportSub").classList.toggle("show",airportOn);',
        '  if(!airportOn){document.getElementById("airportVal").value="";}',
        '}',

        'function selAirport(el,code){',
        '  document.querySelectorAll(".airport-chip").forEach(function(c){c.classList.remove("sel");});',
        '  el.classList.add("sel");',
        '  document.getElementById("airportVal").value=code;',
        '  _savedAirport=code;',
        '  if(!airportOn){airportOn=true;document.getElementById("airportToggle").classList.add("on");document.getElementById("airportSub").classList.add("show");}',
        '}',

        'var _seats=' + savedSeats + ';',
        'function adjSeats(d){',
        '  _seats=Math.max(1,Math.min(8,_seats+d));',
        '  document.getElementById("seatDisplay").textContent=_seats;',
        '  document.getElementById("seatsVal").value=_seats;',
        '}',

        'updateAirport();',
        '</script>',
        '</body></html>'
    ].join('\n'));
});

// POST /ride/:id/edit
router.post('/ride/:id/edit', optionalAuth, async function(req, res) {
    var ride = await ownedRide(req, res);
    if (!ride) return;
    var rawReturn = req.body.returnTo || '/profile';
    var returnTo = (rawReturn.startsWith('/') && !rawReturn.startsWith('//')) ? rawReturn : '/profile';

    // Parse extras
    var seatsRaw  = parseInt(req.body.seats, 10);
    var seats     = (!isNaN(seatsRaw) && seatsRaw >= 1 && seatsRaw <= 8) ? seatsRaw : null;
    var prefsRaw  = req.body.prefs;
    var prefs     = Array.isArray(prefsRaw) ? prefsRaw : (prefsRaw ? [prefsRaw] : []);
    var prefsOther = (req.body.prefs_other || '').trim() || null;
    var airport   = (req.body.airport || '').trim() || null;

    // Merge into existing request_details
    var existingDetails = ride.request_details || {};
    var newDetails = Object.assign({}, existingDetails, {
        seats:       seats,
        prefs:       prefs.length ? prefs : null,
        prefs_other: prefsOther,
        airport:     airport,
    });

    var fields = {
        request_origin:      (req.body.request_origin || '').trim() || null,
        request_destination: (req.body.request_destination || '').trim() || null,
        ride_plan_date:      (req.body.ride_plan_date || '').trim() || null,
        ride_plan_time:      (req.body.ride_plan_time || '').trim() || null,
        request_type:        ['need','offer'].includes(req.body.request_type) ? req.body.request_type : ride.request_type,
        raw_message:         (req.body.raw_message || '').trim() || null,
        request_details:     newDetails,
        reason:              (req.body.reason || '').trim() || null,
    };

    // If airport tag selected, ensure tags array includes 'airport'
    if (airport && airport !== 'not_sure') {
        var existingTags = Array.isArray(ride.tags) ? ride.tags : [];
        if (!existingTags.includes('airport')) {
            fields.tags = existingTags.concat(['airport']);
        }
    }

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
