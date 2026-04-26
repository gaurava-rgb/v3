// One-off cleanup: re-parse all active rides currently on /clusters with fixed parser.
// Run from project root:  node scripts/reparse_active.js [--apply]
//
// Without --apply: dry-run, prints diffs only.
// With    --apply: writes updates to v3_requests.

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { parseMessage } = require('../parser');
const { normalizeLocation } = require('../normalize');

const APPLY = process.argv.includes('--apply');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function chiToday() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

(async () => {
    const today = chiToday();
    const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    // Match clusters.js fetch: ride-only, future/fuzzy/null, created within 5d
    const { data: rows, error } = await sb.from('v3_requests')
        .select('id, raw_message, request_origin, request_destination, ride_plan_date, ride_plan_time, request_type, request_category, date_fuzzy, possible_dates, created_at')
        .eq('request_category', 'ride')
        .gte('created_at', cutoff)
        .or('ride_plan_date.gte.' + today + ',date_fuzzy.eq.true,ride_plan_date.is.null');

    if (error) { console.error('Query error:', error); process.exit(1); }
    console.log('Active ride rows:', rows.length, '\n');

    const diffs = [];

    for (const r of rows) {
        if (!r.raw_message) continue;
        let parsed;
        try { parsed = await parseMessage(r.raw_message); } catch (e) { console.error('Parse fail', r.id, e.message); continue; }
        if (!parsed || !parsed.isRequest || parsed.category !== 'ride') continue;

        const newOrigin = normalizeLocation(parsed.origin) || parsed.origin;
        const newDest   = normalizeLocation(parsed.destination) || parsed.destination;
        const newDate   = parsed.date || null;
        const newTime   = parsed.ride_plan_time || null;

        const changes = {};
        if (newOrigin && newOrigin !== r.request_origin)      changes.request_origin = [r.request_origin, newOrigin];
        if (newDest   && newDest   !== r.request_destination) changes.request_destination = [r.request_destination, newDest];
        if (newDate   !== r.ride_plan_date && newDate)        changes.ride_plan_date = [r.ride_plan_date, newDate];
        if (newTime   !== r.ride_plan_time && newTime)        changes.ride_plan_time = [r.ride_plan_time, newTime];

        if (Object.keys(changes).length === 0) continue;
        diffs.push({ id: r.id, raw: r.raw_message.slice(0, 80), changes });
    }

    console.log('Rows with diffs:', diffs.length, '\n');
    for (const d of diffs) {
        console.log(`#${d.id}  "${d.raw}"`);
        for (const k of Object.keys(d.changes)) {
            console.log(`  ${k}: ${JSON.stringify(d.changes[k][0])} -> ${JSON.stringify(d.changes[k][1])}`);
        }
    }

    if (!APPLY) { console.log('\n[dry-run] Re-run with --apply to write.'); return; }

    console.log('\nApplying updates...');
    for (const d of diffs) {
        const upd = {};
        for (const k of Object.keys(d.changes)) upd[k] = d.changes[k][1];
        const { error: ue } = await sb.from('v3_requests').update(upd).eq('id', d.id);
        if (ue) console.error('Update fail', d.id, ue.message);
        else    console.log('Updated', d.id);
    }
    console.log('Done.');
})();
