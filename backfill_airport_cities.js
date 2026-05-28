/**
 * backfill_airport_cities.js
 * Fixes two airport-related data bugs in v3_requests:
 *   A) wrong city  — "<city> airport" mis-stored as a different city (e.g. Austin airport -> Houston)
 *   B) un-normalized variant — literal "Austin Airport" / "Dallas DFW" that bypassed normalizeLocation
 *
 * Pass A: msg-based city correction.
 *   - "to <city> airport"   -> destination = <city>
 *   - "from <city> airport" -> origin      = <city>
 * Pass B: run normalizeLocation() over origin + destination, rewrite if changed.
 *
 * Run dry first:  node backfill_airport_cities.js
 * Apply:          node backfill_airport_cities.js --apply
 */
var { createClient } = require('@supabase/supabase-js');
require('fs').readFileSync(__dirname + '/.env', 'utf8').split('\n').forEach(function (l) {
    var m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
});
var { normalizeLocation } = require('./normalize');
var sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
var APPLY = process.argv.includes('--apply');

var AIRPORT_CITIES = ['austin', 'dallas', 'houston', 'san antonio', 'fort worth'];
function cityOf(word) { return normalizeLocation(word); } // 'austin' -> 'Austin'

(async function () {
    var rows = [], from = 0;
    while (true) {
        var r = await sb.from('v3_requests')
            .select('id,request_origin,request_destination,raw_message,request_status')
            .neq('request_status', 'deleted').range(from, from + 999);
        if (r.error) throw new Error(r.error.message);
        rows = rows.concat(r.data);
        if (r.data.length < 1000) break;
        from += 1000;
    }

    // WRONG-METRO ONLY: a "<city> airport" message whose stored slot is a different metro.
    // Metro equality via normalizeLocation (so "Houston IAH" == "Houston"). We only rewrite
    // the slot that is in the wrong metro, and we set it to the plain city bucket.
    var changes = [];
    rows.forEach(function (row) {
        var msg = (row.raw_message || '').toLowerCase();
        var newOrigin = row.request_origin;
        var newDest = row.request_destination;

        AIRPORT_CITIES.forEach(function (w) {
            var city = cityOf(w); // plain metro, e.g. 'Austin'
            if (new RegExp('to (the )?' + w + ' airport').test(msg)
                && normalizeLocation(row.request_destination) !== city) newDest = city;
            if (new RegExp('from (the )?' + w + ' airport').test(msg)
                && normalizeLocation(row.request_origin) !== city) newOrigin = city;
        });

        if (newOrigin !== row.request_origin || newDest !== row.request_destination) {
            changes.push({ id: row.id, oO: row.request_origin, nO: newOrigin, oD: row.request_destination, nD: newDest, msg: (row.raw_message || '').replace(/\s+/g, ' ').slice(0, 60) });
        }
    });

    console.log((APPLY ? 'APPLYING' : 'DRY RUN') + ' — ' + changes.length + ' rows to change\n');
    changes.forEach(function (c) {
        var o = c.oO !== c.nO ? ('origin ' + c.oO + '->' + c.nO + '  ') : '';
        var d = c.oD !== c.nD ? ('dest ' + c.oD + '->' + c.nD) : '';
        console.log('  ' + o + d + '  | "' + c.msg + '"');
    });

    if (!APPLY) { console.log('\nRe-run with --apply to write.'); return; }

    var ok = 0, fail = 0;
    for (var i = 0; i < changes.length; i++) {
        var c = changes[i];
        var u = await sb.from('v3_requests')
            .update({ request_origin: c.nO, request_destination: c.nD }).eq('id', c.id);
        if (u.error) { fail++; console.error('FAIL', c.id, u.error.message); } else ok++;
    }
    console.log('\nUpdated ' + ok + ', failed ' + fail);
})().catch(function (e) { console.error('ERR', e.message); });
