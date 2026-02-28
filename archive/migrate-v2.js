/**
 * One-time migration: baileys_* (v2) → v3_* tables
 * Only migrates future-dated requests + their matches + recent message_log.
 * Safe to run multiple times (uses upsert with ON CONFLICT).
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function migrate() {
    const today = new Date().toISOString().split('T')[0];
    console.log('Migration date:', today);

    // Step 1: Migrate requests (future-dated only)
    const { data: v2reqs, error: e1 } = await sb.from('baileys_requests').select('*')
        .or('ride_plan_date.gte.' + today + ',ride_plan_date.is.null');

    if (e1) { console.error('Error fetching v2 requests:', e1.message); return; }
    console.log('Fetched ' + v2reqs.length + ' v2 requests to migrate');

    let rInserted = 0, rSkipped = 0;
    for (const r of v2reqs) {
        const { error } = await sb.from('v3_requests').upsert({
            id: r.id,
            source: r.source,
            source_group: r.source_group,
            source_contact: r.source_contact,
            sender_name: null,
            request_type: r.request_type,
            request_category: r.request_category,
            ride_plan_date: r.ride_plan_date,
            ride_plan_time: null,
            date_fuzzy: false,
            possible_dates: [],
            time_fuzzy: true,
            request_origin: r.request_origin,
            request_destination: r.request_destination,
            request_details: r.request_details,
            raw_message: r.raw_message,
            request_status: r.request_status,
            request_hash: r.request_hash,
            created_at: r.created_at
        }, { onConflict: 'request_hash', ignoreDuplicates: true });

        if (error) { rSkipped++; } else { rInserted++; }
    }
    console.log('Requests: inserted=' + rInserted + ', skipped=' + rSkipped);

    // Step 2: Migrate matches (only where both FKs exist in v3)
    const { data: v2matches, error: e2 } = await sb.from('baileys_matches').select('*');
    if (e2) { console.error('Error fetching v2 matches:', e2.message); return; }
    console.log('Fetched ' + v2matches.length + ' v2 matches');

    let mInserted = 0, mSkipped = 0;
    for (const m of v2matches) {
        const { data: needOk } = await sb.from('v3_requests').select('id').eq('id', m.need_id).maybeSingle();
        const { data: offerOk } = await sb.from('v3_requests').select('id').eq('id', m.offer_id).maybeSingle();

        if (!needOk || !offerOk) { mSkipped++; continue; }

        const { error } = await sb.from('v3_matches').upsert({
            id: m.id,
            need_id: m.need_id,
            offer_id: m.offer_id,
            score: m.score,
            match_quality: 'medium',
            notified: m.notified,
            created_at: m.created_at
        }, { onConflict: 'id', ignoreDuplicates: true });

        if (error) { mSkipped++; } else { mInserted++; }
    }
    console.log('Matches: inserted=' + mInserted + ', skipped=' + mSkipped);

    // Step 3: Migrate message_log (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: v2logs, error: e3 } = await sb.from('baileys_message_log').select('*')
        .gte('created_at', weekAgo);
    if (e3) { console.error('Error fetching v2 logs:', e3.message); return; }
    console.log('Fetched ' + v2logs.length + ' v2 message_log rows');

    let lInserted = 0, lSkipped = 0;
    for (const l of v2logs) {
        const { error } = await sb.from('v3_message_log').upsert({
            id: l.id,
            wa_message_id: l.wa_message_id,
            source_group: l.source_group,
            source_contact: l.source_contact,
            sender_name: l.sender_name,
            message_text: l.message_text,
            is_request: l.is_request,
            parsed_data: l.parsed_data,
            error: l.error,
            created_at: l.created_at
        }, { onConflict: 'id', ignoreDuplicates: true });

        if (error) { lSkipped++; } else { lInserted++; }
    }
    console.log('Message log: inserted=' + lInserted + ', skipped=' + lSkipped);

    // Final count
    const { data: v3final } = await sb.from('v3_requests').select('id');
    console.log('\nv3_requests total after migration: ' + (v3final || []).length);
}

migrate().catch(err => console.error('Migration failed:', err.message));
