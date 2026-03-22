/**
 * Shared date-filter logic for ride requests.
 * Used by the public board (GET /) and fetchSameWayClusters.
 */

/**
 * Filter ride requests to only active/relevant ones.
 * @param {Array} requests - raw request rows from Supabase
 * @param {Object} opts
 * @param {string} opts.today - YYYY-MM-DD string for today
 * @param {string} opts.cutoff - ISO timestamp; no-date requests older than this are dropped
 * @param {Set}    opts.testGroups - set of group IDs/names to exclude
 * @returns {Array} filtered requests
 */
function filterActiveRequests(requests, opts) {
    var today = opts.today;
    var cutoff = opts.cutoff;
    var testGroups = opts.testGroups;

    return requests.filter(function(r) {
        if (testGroups && r.source_group && testGroups.has(r.source_group)) return false;
        if (r.ride_plan_date && r.ride_plan_date >= today) return true;
        if (r.ride_plan_date && r.ride_plan_date < today) return false;
        if (r.date_fuzzy && Array.isArray(r.possible_dates) && r.possible_dates.length > 0) {
            return r.possible_dates.some(function(d) { return d >= today; });
        }
        if (r.created_at && r.created_at < cutoff) return false;
        return true;
    });
}

/**
 * Build a Set of test group IDs and names from monitored_groups rows.
 */
function buildTestGroupSet(groups) {
    var testGroups = new Set();
    for (var i = 0; i < groups.length; i++) {
        if (groups[i].is_test) {
            testGroups.add(groups[i].group_id);
            if (groups[i].group_name) testGroups.add(groups[i].group_name);
        }
    }
    return testGroups;
}

module.exports = { filterActiveRequests, buildTestGroupSet };
