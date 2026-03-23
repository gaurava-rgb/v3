/**
 * Cluster grouping logic for the public cluster board.
 * Groups open ride requests by date + origin corridor + destination corridor.
 */

var { readClient } = require('./supabase');
var { getClusterCorridor } = require('../normalize');
var { filterActiveRequests, buildTestGroupSet } = require('./dateFilter');

async function fetchClusters() {
    var today = new Date().toISOString().split('T')[0];
    var cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    var results = await Promise.all([
        readClient.from('v3_requests')
            .select('id, request_type, ride_plan_date, request_origin, request_destination, sender_name, source_contact, raw_message, ride_plan_time, time_fuzzy, date_fuzzy, possible_dates, created_at, source_group')
            .eq('request_category', 'ride')
            .or('ride_plan_date.gte.' + today + ',date_fuzzy.eq.true,ride_plan_date.is.null')
            .order('ride_plan_date', { ascending: true }),
        readClient.from('monitored_groups').select('group_id, group_name, is_test')
    ]);

    var groups = results[1].data || [];
    var testGroups = buildTestGroupSet(groups);
    var rawReqs = results[0].data || [];
    var requests = filterActiveRequests(rawReqs, { today: today, cutoff: cutoff, testGroups: testGroups });

    // Group by date + origin corridor + dest corridor
    var clusterMap = {};
    for (var i = 0; i < requests.length; i++) {
        var r = requests[i];
        var originCorridor = getClusterCorridor(r.request_origin);
        var destCorridor = getClusterCorridor(r.request_destination);
        var date = r.ride_plan_date || 'flexible';
        var key = date + '|' + originCorridor + '|' + destCorridor;

        if (!clusterMap[key]) {
            clusterMap[key] = {
                date: date,
                originCorridor: originCorridor,
                destCorridor: destCorridor,
                posts: [],
                needCount: 0,
                offerCount: 0
            };
        }

        clusterMap[key].posts.push(r);
        if (r.request_type === 'need') clusterMap[key].needCount++;
        else if (r.request_type === 'offer') clusterMap[key].offerCount++;
    }

    // Convert to array, sort by date (soonest first), then largest cluster first
    var clusters = Object.values(clusterMap);
    clusters.sort(function(a, b) {
        if (a.date !== b.date) return (a.date === 'flexible' ? '9999' : a.date).localeCompare(b.date === 'flexible' ? '9999' : b.date);
        return (b.needCount + b.offerCount) - (a.needCount + a.offerCount);
    });

    return clusters;
}

module.exports = { fetchClusters };
