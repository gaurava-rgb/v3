/**
 * Data-fetching functions for dashboard routes.
 */

var { readClient, writeClient } = require('./supabase');
var { buildClusters } = require('./helpers');
var { filterActiveRequests, buildTestGroupSet } = require('./dateFilter');

async function fetchOpenMatches(showAll) {
    var matchQuery = readClient
        .from('v3_matches')
        .select('id, need_id, offer_id, score, match_quality, notified, created_at')
        .order('created_at', { ascending: false });

    if (!showAll) {
        matchQuery = matchQuery.eq('notified', false);
    }

    var matchResult = await matchQuery;
    if (matchResult.error) throw new Error('Failed to fetch matches: ' + matchResult.error.message);
    var matches = matchResult.data || [];
    if (matches.length === 0) return [];

    var idSet = new Set();
    for (var i = 0; i < matches.length; i++) {
        idSet.add(matches[i].need_id);
        idSet.add(matches[i].offer_id);
    }
    var requestIds = Array.from(idSet);

    var reqResult = await readClient
        .from('v3_requests')
        .select('id, source_group, source_contact, sender_name, request_type, ride_plan_date, ride_plan_time, time_fuzzy, request_origin, request_destination, raw_message, created_at')
        .in('id', requestIds);
    if (reqResult.error) throw new Error('Failed to fetch requests: ' + reqResult.error.message);

    var groupResult = await readClient
        .from('monitored_groups')
        .select('group_id, group_name, is_test');

    var groupMap = new Map();
    var testGroups = new Set();
    var groups = (groupResult.data || []);
    for (var gi = 0; gi < groups.length; gi++) {
        groupMap.set(groups[gi].group_id, groups[gi].group_name);
        if (groups[gi].is_test) {
            testGroups.add(groups[gi].group_id);
            if (groups[gi].group_name) testGroups.add(groups[gi].group_name);
        }
    }

    var requestMap = new Map();
    var requests = reqResult.data || [];
    for (var ri = 0; ri < requests.length; ri++) {
        requestMap.set(requests[ri].id, requests[ri]);
    }

    var enriched = [];
    for (var mi = 0; mi < matches.length; mi++) {
        var m = matches[mi];
        var need = requestMap.get(m.need_id);
        var offer = requestMap.get(m.offer_id);
        if (!need || !offer) continue;

        if (need.source_group && testGroups.has(need.source_group)) continue;
        if (offer.source_group && testGroups.has(offer.source_group)) continue;

        if (need.ride_plan_date && offer.ride_plan_date && need.ride_plan_date !== offer.ride_plan_date) continue;

        var resolveGroup = function(sg) {
            if (!sg) return 'Unknown Group';
            return groupMap.get(sg) || sg;
        };

        enriched.push({
            matchId: m.id,
            matchQuality: m.match_quality,
            score: m.score,
            notified: m.notified,
            createdAt: m.created_at,
            need: Object.assign({}, need, { groupName: resolveGroup(need.source_group) }),
            offer: Object.assign({}, offer, { groupName: resolveGroup(offer.source_group) })
        });
    }

    enriched.sort(function(a, b) {
        var da = a.need.ride_plan_date || a.offer.ride_plan_date || '9999';
        var db = b.need.ride_plan_date || b.offer.ride_plan_date || '9999';
        return da.localeCompare(db);
    });

    return enriched;
}

async function markNotified(matchIds) {
    if (!matchIds || matchIds.length === 0) return;
    var result = await writeClient
        .from('v3_matches')
        .update({ notified: true })
        .in('id', matchIds);
    if (result.error) {
        throw new Error('Failed to mark notified: ' + result.error.message);
    }
}

async function fetchSameWayClusters() {
    var _now = new Date();
    var today = [_now.getFullYear(), String(_now.getMonth()+1).padStart(2,'0'), String(_now.getDate()).padStart(2,'0')].join('-');
    var cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    var results = await Promise.all([
        readClient.from('v3_requests').select('id, source_group, source_contact, sender_name, request_type, request_category, ride_plan_date, ride_plan_time, time_fuzzy, date_fuzzy, possible_dates, request_origin, request_destination, raw_message, created_at')
            .eq('request_category', 'ride')
            .or('ride_plan_date.gte.' + today + ',date_fuzzy.eq.true,ride_plan_date.is.null')
            .order('created_at', { ascending: false }),
        readClient.from('monitored_groups').select('group_id, group_name, is_test')
    ]);

    var groups = results[1].data || [];
    var groupMap = new Map();
    var testGroups = buildTestGroupSet(groups);
    for (var gi = 0; gi < groups.length; gi++) {
        groupMap.set(groups[gi].group_id, groups[gi].group_name);
    }

    var rawReqs = results[0].data || [];
    var allReqs = filterActiveRequests(rawReqs, { today: today, cutoff: cutoff, testGroups: testGroups });

    for (var ri = 0; ri < allReqs.length; ri++) {
        allReqs[ri].groupName = groupMap.get(allReqs[ri].source_group) || allReqs[ri].source_group || 'Unknown Group';
    }

    var clusters = buildClusters(allReqs, true);
    return clusters.filter(function(c) { return c.needs.length >= 2; });
}

/**
 * Fetch all rides + housing listings attributed to a user's phones.
 * Splits rides into upcoming/past by ride_plan_date vs today.
 * Splits housing into active/inactive by `active` column.
 *
 * @param {Object} opts - { phones: string[] } — digit-only phone numbers
 * @returns {Object} { rides:{upcoming,past}, housing:{active,inactive} }
 */
async function fetchUserListings(opts) {
    var phones = (opts && opts.phones) ? opts.phones.filter(Boolean) : [];
    var empty = { rides: { upcoming: [], past: [] }, housing: { active: [], inactive: [] } };
    if (phones.length === 0) return empty;

    var _now = new Date();
    var today = [_now.getFullYear(), String(_now.getMonth()+1).padStart(2,'0'), String(_now.getDate()).padStart(2,'0')].join('-');

    var results = await Promise.all([
        readClient.from('v3_requests')
            .select('id, source_contact, sender_name, request_type, request_category, ride_plan_date, ride_plan_time, time_fuzzy, date_fuzzy, request_origin, request_destination, raw_message, created_at, status')
            .in('source_contact', phones)
            .order('created_at', { ascending: false }),
        readClient.from('v3_housing')
            .select('id, slug, source_contact, poster_phone, sender_name, message_text, listing_type, location, price, bedrooms, bathrooms, available_date, active, created_at')
            .or('source_contact.in.(' + phones.join(',') + '),poster_phone.in.(' + phones.join(',') + ')')
            .order('created_at', { ascending: false })
    ]);

    var rides = results[0].data || [];
    var housing = results[1].data || [];

    var upcoming = [], past = [];
    for (var i = 0; i < rides.length; i++) {
        var r = rides[i];
        if (r.ride_plan_date && r.ride_plan_date < today) past.push(r);
        else upcoming.push(r);
    }

    var active = [], inactive = [];
    for (var j = 0; j < housing.length; j++) {
        var hrow = housing[j];
        if (hrow.active) active.push(hrow);
        else inactive.push(hrow);
    }

    return { rides: { upcoming: upcoming, past: past }, housing: { active: active, inactive: inactive } };
}

module.exports = { fetchOpenMatches, markNotified, fetchSameWayClusters, fetchUserListings };
