/**
 * cluster_potential_report.js
 * Per-day cluster potential analysis.
 * Reuses production buildClusters() (same route + same date, deduped by contact).
 *
 * For each ride DAY (repDate) reports:
 *   - needs        : people willing to take a ride
 *   - offers       : people offering a ride
 *   - clusters     : total same-route/same-day clusters
 *   - potential    : clusters with >=1 offer AND >=1 need (a ride could actually have happened)
 *   - matchable    : needs sitting in a potential cluster (had someone offering)
 *   - unmet        : needs in clusters with 0 offers (wanted a ride, nobody offering)
 *   - strong       : v3_matches with quality 'strong' landing on that day
 *
 * Usage: node cluster_potential_report.js
 */
var { createClient } = require('@supabase/supabase-js');
require('fs').readFileSync(__dirname + '/.env', 'utf8').split('\n').forEach(function (l) {
    var m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
});
var { buildClusters } = require('./lib/helpers');

var sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Paginate past Supabase 1000-row cap.
async function fetchAll(table, cols) {
    var rows = [], from = 0, page = 1000;
    while (true) {
        var r = await sb.from(table).select(cols).range(from, from + page - 1);
        if (r.error) throw new Error(table + ': ' + r.error.message);
        rows = rows.concat(r.data);
        if (r.data.length < page) break;
        from += page;
    }
    return rows;
}

(async function () {
    var reqs = await fetchAll('v3_requests',
        'id,request_type,request_origin,request_destination,ride_plan_date,created_at,source_contact,request_status');
    var matches = await fetchAll('v3_matches', 'need_id,offer_id,match_quality,created_at');

    // Drop deleted rows (mirror live homepage which never shows them).
    reqs = reqs.filter(function (r) { return r.request_status !== 'deleted'; });

    // Map need_id -> ride day, so strong matches can be bucketed per day.
    var reqDate = {};
    reqs.forEach(function (r) { reqDate[r.id] = r.ride_plan_date; });

    var clusters = buildClusters(reqs, true); // strict = same exact date, like the homepage

    var byDay = {};
    function day(d) {
        if (!byDay[d]) byDay[d] = {
            needs: 0, offers: 0, clusters: 0, potential: 0,
            matchable: 0, unmet: 0, strong: 0, soloOffers: 0
        };
        return byDay[d];
    }

    clusters.forEach(function (c) {
        if (!c.repDate) return; // dateless clusters excluded (homepage does the same)
        var d = day(c.repDate);
        d.clusters++;
        d.needs += c.needs.length;
        d.offers += c.offers.length;
        var hasOffer = c.offers.length > 0;
        var hasNeed = c.needs.length > 0;
        if (hasOffer && hasNeed) {
            d.potential++;
            d.matchable += c.needs.length;
        } else if (hasNeed && !hasOffer) {
            d.unmet += c.needs.length;
        } else if (hasOffer && !hasNeed) {
            d.soloOffers += c.offers.length;
        }
    });

    // Strong matches bucketed by the need's ride day.
    matches.forEach(function (m) {
        if (m.match_quality !== 'strong') return;
        var d = reqDate[m.need_id];
        if (d && byDay[d]) byDay[d].strong++;
    });

    var days = Object.keys(byDay).sort();
    var T = { needs: 0, offers: 0, clusters: 0, potential: 0, matchable: 0, unmet: 0, strong: 0, soloOffers: 0 };

    var pad = function (s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); };
    console.log(pad('DAY', 12) + pad('needs', 7) + pad('offers', 7) + pad('clstrs', 8) +
        pad('potntl', 8) + pad('matchbl', 9) + pad('unmet', 7) + pad('strong', 7));
    console.log('-'.repeat(65));
    days.forEach(function (k) {
        var d = byDay[k];
        Object.keys(T).forEach(function (f) { T[f] += d[f]; });
        console.log(pad(k, 12) + pad(d.needs, 7) + pad(d.offers, 7) + pad(d.clusters, 8) +
            pad(d.potential, 8) + pad(d.matchable, 9) + pad(d.unmet, 7) + pad(d.strong, 7));
    });
    console.log('-'.repeat(65));
    console.log(pad('TOTAL', 12) + pad(T.needs, 7) + pad(T.offers, 7) + pad(T.clusters, 8) +
        pad(T.potential, 8) + pad(T.matchable, 9) + pad(T.unmet, 7) + pad(T.strong, 7));
    console.log('');
    console.log('Days with rides:', days.length);
    console.log('Total needs (willing to ride):', T.needs);
    console.log('Total offers:', T.offers);
    console.log('Clusters total:', T.clusters, '| with potential (offer+need):', T.potential);
    console.log('Needs matchable (had an offer in cluster):', T.matchable,
        '(' + (T.matchable / T.needs * 100).toFixed(1) + '% of needs)');
    console.log('Needs unmet (nobody offering same route+day):', T.unmet,
        '(' + (T.unmet / T.needs * 100).toFixed(1) + '% of needs)');
    console.log('Offers with zero takers (solo offers):', T.soloOffers);
    console.log('Strong-quality matches:', T.strong);
})().catch(function (e) { console.error('ERR', e.message); });
