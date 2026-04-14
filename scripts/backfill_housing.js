/**
 * One-time backfill script: reads last 30 days of v3_message_log,
 * runs each message through the parser, and inserts housing records
 * into v3_housing via upsertHousing.
 *
 * Usage: node scripts/backfill_housing.js
 */

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const { parseMessage } = require('../parser');
const { upsertHousing } = require('../lib/housing');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function main() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    console.log(`[Backfill] Fetching messages since ${since}`);

    const { data: rows, error } = await supabase
        .from('v3_message_log')
        .select('id, message_text, source_contact, sender_name, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(1000);

    if (error) {
        console.error('[Backfill] Failed to fetch messages:', error.message);
        process.exit(1);
    }

    console.log(`[Backfill] Fetched ${rows.length} messages. Starting...`);

    let processed = 0;
    let housingFound = 0;
    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of rows) {
        try {
            const parsed = await parseMessage(row.message_text, row.sender_name || '');

            if (parsed.isRequest === true && parsed.category === 'housing') {
                housingFound++;
                const result = await upsertHousing(
                    parsed.housing,
                    row.message_text,
                    row.source_contact,
                    row.sender_name
                );
                if (result && result.inserted === false) {
                    skipped++;
                } else {
                    inserted++;
                }
            }
        } catch (err) {
            errors++;
            console.error(`[Backfill] Error on message id=${row.id}:`, err.message);
        }

        processed++;

        if (processed % 25 === 0) {
            console.log(`[Backfill] ${processed}/${rows.length} processed...`);
        }

        await new Promise(r => setTimeout(r, 200));
    }

    console.log(
        `[Backfill] Done. Processed: ${processed}, Housing found: ${housingFound}, ` +
        `Inserted: ${inserted}, Skipped (dup): ${skipped}, Errors: ${errors}`
    );
}

main().catch(err => {
    console.error('[Backfill] Fatal error:', err);
    process.exit(1);
});
