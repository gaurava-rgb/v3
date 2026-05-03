/**
 * Fan out existing dateless flexible-bucket rows.
 *
 * For each v3_requests row where:
 *   - request_category = 'ride'
 *   - ride_plan_date IS NULL
 *   - possible_dates has 2+ entries with at least one >= today (Central)
 *   - roundtrip_parent_id IS NULL  (skip return-leg children)
 *   - no other rows reference it as roundtrip_parent_id (skip RT parents)
 *
 * Insert N sibling rows (one per future possible_date) with tags+=['flexible'],
 * preserving origin/destination/sender/etc. Then mark the original row as
 * status='expanded' so it stops appearing in /clusters but stays for audit.
 *
 * Usage: node backfill_flexible.js [--dry-run]
 */

require('dotenv').config();
const { supabase } = require('./db');
const { computeRequestHash } = require('./db');

const DRY_RUN = process.argv.includes('--dry-run');

function todayCentral() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

async function backfill() {
    const today = todayCentral();
    console.log(`[Flex] Today (Central): ${today} ${DRY_RUN ? '[DRY RUN]' : ''}`);

    const { data: rows, error } = await supabase
        .from('v3_requests')
        .select('id, raw_message, sender_name, source, source_group, source_contact, request_type, request_category, ride_plan_time, time_fuzzy, request_origin, request_destination, request_details, possible_dates, ride_plan_date, roundtrip_parent_id, tags, request_status')
        .eq('request_category', 'ride')
        .eq('request_status', 'open')
        .is('ride_plan_date', null)
        .is('roundtrip_parent_id', null)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[Flex] Query failed:', error.message);
        process.exit(1);
    }
    if (!rows || !rows.length) {
        console.log('[Flex] No dateless open ride rows.');
        return;
    }

    console.log(`[Flex] Found ${rows.length} candidate rows.\n`);

    let expanded = 0, inserted = 0, skipped = 0, errors = 0;

    for (const r of rows) {
        const dates = Array.isArray(r.possible_dates) ? r.possible_dates : [];
        const futureDates = dates.filter(d => d && d >= today);
        if (futureDates.length < 1) {
            console.log(`[Flex] id=${r.id} skip — no future possible_dates (${JSON.stringify(dates)})`);
            skipped++;
            continue;
        }

        // Skip if this row is a round-trip parent (any row references it)
        const { data: children } = await supabase
            .from('v3_requests')
            .select('id')
            .eq('roundtrip_parent_id', r.id)
            .limit(1);
        if (children && children.length) {
            console.log(`[Flex] id=${r.id} skip — round-trip parent (has ${children.length} child row)`);
            skipped++;
            continue;
        }

        if (!r.request_destination) {
            console.log(`[Flex] id=${r.id} skip — null destination`);
            skipped++;
            continue;
        }

        const baseTags = Array.isArray(r.tags) ? r.tags.slice() : [];
        if (!baseTags.includes('flexible')) baseTags.push('flexible');

        console.log(`[Flex] id=${r.id} expanding ${r.request_origin} -> ${r.request_destination} on ${JSON.stringify(futureDates)} tags=${JSON.stringify(baseTags)}`);
        console.log(`        msg: "${(r.raw_message || '').slice(0, 120).replace(/\n/g, ' ')}"`);

        if (DRY_RUN) {
            inserted += futureDates.length;
            expanded++;
            continue;
        }

        let nInserted = 0;
        for (const d of futureDates) {
            const h = computeRequestHash({
                sourceContact: r.source_contact,
                type: r.request_type,
                category: r.request_category,
                destination: r.request_destination,
                date: d
            });
            const { data: dup } = await supabase
                .from('v3_requests')
                .select('id')
                .eq('request_hash', h)
                .eq('request_status', 'open')
                .maybeSingle();
            if (dup) {
                console.log(`        dup on ${d}, skip`);
                continue;
            }
            const { error: insErr } = await supabase
                .from('v3_requests')
                .insert({
                    source: r.source || 'whatsapp-baileys-v3',
                    source_group: r.source_group,
                    source_contact: r.source_contact,
                    sender_name: r.sender_name,
                    request_type: r.request_type,
                    request_category: r.request_category,
                    ride_plan_date: d,
                    ride_plan_time: r.ride_plan_time,
                    date_fuzzy: true,
                    possible_dates: dates,
                    time_fuzzy: r.time_fuzzy ?? true,
                    request_origin: r.request_origin,
                    request_destination: r.request_destination,
                    request_details: r.request_details || {},
                    raw_message: r.raw_message,
                    tags: baseTags,
                    request_status: 'open',
                    request_hash: h
                });
            if (insErr) {
                console.error(`        insert err on ${d}: ${insErr.message}`);
                errors++;
                continue;
            }
            nInserted++;
        }

        if (nInserted > 0) {
            // Retire the original dateless row so it disappears from /clusters
            const { error: upErr } = await supabase
                .from('v3_requests')
                .update({ request_status: 'expanded' })
                .eq('id', r.id);
            if (upErr) {
                console.error(`        original status update err: ${upErr.message}`);
                errors++;
            } else {
                expanded++;
                inserted += nInserted;
                console.log(`        inserted=${nInserted}, original retired`);
            }
        }
    }

    console.log(`\n[Flex] Done. expanded=${expanded} new_rows=${inserted} skipped=${skipped} errors=${errors} ${DRY_RUN ? '(dry run)' : ''}`);
}

backfill().catch(e => { console.error(e); process.exit(1); });
