/**
 * Retry failed parser calls from v3_message_log.
 * Fetches rows WHERE error IS NOT NULL, re-parses, inserts to v3_requests/v3_housing if successful.
 */

require('dotenv').config();
const { supabase } = require('./db');
const { parseMessage } = require('./parser');
const { saveRequest } = require('./db');
const { upsertHousing } = require('./lib/housing');

async function reparseErrors() {
    console.log('[Reparse] Fetching failed messages...\n');

    const { data: failed, error } = await supabase
        .from('v3_message_log')
        .select('id, message_text, sender_name, source_group, source_contact, created_at')
        .not('error', 'is', null)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[Reparse] Query failed:', error.message);
        process.exit(1);
    }

    if (!failed || failed.length === 0) {
        console.log('[Reparse] No failed messages found.');
        return;
    }

    console.log(`[Reparse] Found ${failed.length} failed message(s)\n`);

    let recovered = 0;
    let stillFailed = 0;

    for (const row of failed) {
        console.log(`\n--- Message ${row.id} ---`);
        console.log(`Date: ${row.created_at}`);
        console.log(`From: ${row.sender_name} (${row.source_contact})`);
        console.log(`Group: ${row.source_group}`);
        console.log(`Text: ${row.message_text.substring(0, 100)}${row.message_text.length > 100 ? '...' : ''}`);

        try {
            const parsed = await parseMessage(row.message_text, row.sender_name);

            if (!parsed.isRequest) {
                console.log('Result: Not a request (casual chat)');
                stillFailed++;
                continue;
            }

            if (parsed._error) {
                console.log(`Result: Still failed — ${parsed._error}`);
                stillFailed++;
                continue;
            }

            console.log(`Result: Parsed as ${parsed.type} ${parsed.category}`);

            if (parsed.category === 'housing') {
                const sentAt = new Date(row.created_at);
                await upsertHousing(
                    parsed.housing,
                    row.message_text,
                    row.source_contact,
                    row.sender_name,
                    sentAt
                );
                console.log('✓ Inserted to v3_housing');
            } else if (parsed.category === 'ride') {
                const request = await saveRequest({
                    source: 'whatsapp-baileys-v3',
                    sourceGroup: row.source_group,
                    sourceContact: row.source_contact,
                    senderName: row.sender_name,
                    type: parsed.type,
                    category: parsed.category,
                    date: parsed.date,
                    ridePlanTime: parsed.ride_plan_time,
                    dateFuzzy: parsed.date_fuzzy,
                    possibleDates: parsed.possible_dates,
                    timeFuzzy: parsed.time_fuzzy,
                    origin: parsed.origin,
                    destination: parsed.destination,
                    details: parsed.details || {},
                    rawMessage: row.message_text
                });
                if (request) {
                    console.log(`✓ Inserted to v3_requests (id: ${request.id})`);
                } else {
                    console.log('✓ Parsed but duplicate (hash match)');
                }
            }

            recovered++;

        } catch (err) {
            console.log(`Result: Exception — ${err.message}`);
            stillFailed++;
        }
    }

    console.log(`\n[Reparse] Complete: ${recovered} recovered, ${stillFailed} still failed`);
}

reparseErrors();
