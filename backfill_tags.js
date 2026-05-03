/**
 * Re-parse current+future v3_requests rows to populate tags column and
 * collapse old multi-bucket destinations (Houston IAH, Dallas DFW, Austin Airport, etc.)
 * into the new single-city + tags scheme.
 *
 * Scope: ride_plan_date >= today (Central US date)
 *
 * Usage: node backfill_tags.js [--dry-run]
 */

require('dotenv').config();
const { supabase } = require('./db');
const { parseMessage } = require('./parser');
const { normalizeLocation } = require('./normalize');

const DRY_RUN = process.argv.includes('--dry-run');

function todayCentral() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

async function backfill() {
    const today = todayCentral();
    console.log(`[Backfill] Today (Central): ${today} ${DRY_RUN ? '[DRY RUN]' : ''}`);

    const { data: rows, error } = await supabase
        .from('v3_requests')
        .select('id, raw_message, sender_name, request_origin, request_destination, ride_plan_date, request_category, created_at, tags, roundtrip_parent_id')
        .eq('request_category', 'ride')
        .is('roundtrip_parent_id', null) // skip return-leg children; raw_message describes outbound
        .gte('ride_plan_date', today)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[Backfill] Query failed:', error.message);
        process.exit(1);
    }
    if (!rows || !rows.length) {
        console.log('[Backfill] No future rides found.');
        return;
    }

    console.log(`[Backfill] Found ${rows.length} future rides.\n`);

    let updated = 0, skipped = 0, errors = 0, notRide = 0;

    for (const r of rows) {
        if (!r.raw_message) { skipped++; continue; }

        // Re-parse with current prompt (single bucket cities + tags)
        // Retry up to 3x on _error (LLM/network failures); never overwrite
        // an existing row based on a failed parse.
        let parsed = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                parsed = await parseMessage(r.raw_message, r.sender_name || '', r.created_at ? new Date(r.created_at) : new Date());
            } catch (e) {
                parsed = { isRequest: false, _error: e.message };
            }
            if (parsed && !parsed._error) break;
            console.warn(`[Backfill] id=${r.id} parse error attempt ${attempt}/3: ${parsed._error?.slice(0, 80)}`);
            await new Promise(res => setTimeout(res, 2000 * attempt));
        }

        if (!parsed || parsed._error) {
            console.error(`[Backfill] id=${r.id} parse failed after retries, skipping (no update)`);
            errors++;
            continue;
        }

        if (!parsed.isRequest || parsed.category !== 'ride') {
            // Re-parse says not-a-ride. Existing row was a ride at insert time;
            // do NOT delete or modify. LLM is being unreliable — leave alone.
            console.log(`[Backfill] id=${r.id} re-parse returned not-a-ride; leaving row unchanged`);
            notRide++;
            continue;
        }

        const newTags = Array.isArray(parsed.tags) ? parsed.tags : [];
        const newOrigin = normalizeLocation(parsed.origin) || r.request_origin;
        const newDest = normalizeLocation(parsed.destination) || r.request_destination;

        const tagsChanged = JSON.stringify((r.tags || []).slice().sort()) !== JSON.stringify(newTags.slice().sort());
        const originChanged = r.request_origin !== newOrigin;
        const destChanged = r.request_destination !== newDest;

        if (!tagsChanged && !originChanged && !destChanged) {
            console.log(`[Backfill] id=${r.id} no change (${newOrigin} -> ${newDest} ${JSON.stringify(newTags)})`);
            skipped++;
            continue;
        }

        const diff = [
            originChanged ? `origin ${r.request_origin}->${newOrigin}` : null,
            destChanged ? `dest ${r.request_destination}->${newDest}` : null,
            tagsChanged ? `tags ${JSON.stringify(r.tags || [])}->${JSON.stringify(newTags)}` : null
        ].filter(Boolean).join(' | ');

        console.log(`[Backfill] id=${r.id} ${diff}`);
        console.log(`           "${(r.raw_message || '').slice(0, 100).replace(/\n/g, ' ')}"`);

        if (!DRY_RUN) {
            const { error: upErr } = await supabase
                .from('v3_requests')
                .update({
                    request_origin: newOrigin,
                    request_destination: newDest,
                    tags: newTags
                })
                .eq('id', r.id);
            if (upErr) {
                console.error(`[Backfill] Update failed id=${r.id}: ${upErr.message}`);
                errors++;
                continue;
            }
        }
        updated++;

        // Throttle to avoid hammering OpenRouter
        await new Promise(r => setTimeout(r, 600));
    }

    console.log(`\n[Backfill] Done. updated=${updated} skipped=${skipped} notRide=${notRide} errors=${errors} ${DRY_RUN ? '(dry run, no writes)' : ''}`);
}

backfill().catch(e => { console.error(e); process.exit(1); });
