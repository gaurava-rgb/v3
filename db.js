/**
 * Supabase Database Client — v3
 * Uses v3_ prefixed tables. Includes fuzzy date/time fields and match_quality.
 */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { normalizeLocation } = require('./normalize');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

/**
 * Sanitize error messages before logging.
 * Cloudflare HTML error pages can be 100+ lines — extract the useful bits.
 */
function sanitizeError(msg) {
    if (!msg || typeof msg !== 'string') return msg || 'unknown error';
    if (!msg.includes('<') || !msg.includes('</')) return msg;

    // Extract Cloudflare error code (e.g. 522, 524)
    const codeMatch = msg.match(/errorcode_(\d{3})/);
    const code = codeMatch ? codeMatch[1] : 'unknown';

    // Extract Ray ID
    const rayMatch = msg.match(/Ray ID:\s*<[^>]*>([a-f0-9]+)/);
    const ray = rayMatch ? rayMatch[1] : 'n/a';

    // Extract host
    const hostMatch = msg.match(/([a-z0-9]+\.supabase\.co)/);
    const host = hostMatch ? hostMatch[1] : 'supabase';

    return `Cloudflare ${code} — host: ${host}, ray: ${ray} (HTML error page truncated)`;
}

// ============================================================
// Monitored Groups (shared table with v2)
// ============================================================

async function loadMonitoredGroups() {
    const { data, error } = await supabase
        .from('monitored_groups')
        .select('group_id, group_name')
        .eq('active', true);

    if (error) {
        console.error('[DB] Error loading monitored groups:', sanitizeError(error.message));
        return [];
    }
    return data || [];
}

async function getGroupUpdates(since) {
    const { data, error } = await supabase
        .from('monitored_groups')
        .select('updated_at')
        .gt('updated_at', since.toISOString())
        .limit(1);

    if (error) {
        console.error('[DB] Error checking group updates:', sanitizeError(error.message));
        return false;
    }
    return data && data.length > 0;
}

async function seedGroups(groups) {
    for (const g of groups) {
        const { error } = await supabase
            .from('monitored_groups')
            .upsert(
                { group_id: g.id, group_name: g.name },
                { onConflict: 'group_id', ignoreDuplicates: true }
            );
        if (error) console.error(`[DB] seedGroups failed for group ${g.id}: ${sanitizeError(error.message)}`);
    }
}

// ============================================================
// Contact Resolution  (LID → phone)
// ============================================================

/**
 * Persist a LID→phone mapping. Also retroactively updates any existing
 * v3_requests and v3_message_log rows that still hold the raw LID.
 */
async function upsertContact(lid, phone, name, { backfill = true } = {}) {
    if (!lid || !phone) return;

    const { error: upsertErr } = await supabase.from('wa_contacts').upsert(
        { lid, phone, name: name || null, updated_at: new Date().toISOString() },
        { onConflict: 'lid' }
    );
    if (upsertErr) console.error(`[DB] upsertContact failed for lid=${lid} phone=${phone}: ${sanitizeError(upsertErr.message)}`);

    // Only backfill when needed (new contact or phone changed)
    if (!backfill) return;

    const [reqResult, logResult] = await Promise.all([
        supabase.from('v3_requests')
            .update({ source_contact: phone })
            .eq('source_contact', lid),
        supabase.from('v3_message_log')
            .update({ source_contact: phone })
            .eq('source_contact', lid)
    ]);
    if (reqResult.error) console.error(`[DB] upsertContact backfill v3_requests failed for lid=${lid}: ${sanitizeError(reqResult.error.message)}`);
    if (logResult.error) console.error(`[DB] upsertContact backfill v3_message_log failed for lid=${lid}: ${sanitizeError(logResult.error.message)}`);
}

/**
 * Look up a phone number for a LID from the persistent store.
 * Returns the phone string, or null if not found.
 */
async function resolveContactPhone(lid) {
    if (!lid) return null;
    const { data, error } = await supabase
        .from('wa_contacts')
        .select('phone')
        .eq('lid', lid)
        .maybeSingle();
    if (error) console.error(`[DB] resolveContactPhone failed for lid=${lid}: ${sanitizeError(error.message)}`);
    return data?.phone || null;
}

/**
 * Load all contacts from wa_contacts into a Map keyed by lid.
 * Each value is { phone, name }. Used on startup to avoid redundant upserts.
 */
async function loadAllContacts() {
    const contacts = new Map();
    let offset = 0;
    const PAGE = 1000;
    while (true) {
        const { data, error } = await supabase
            .from('wa_contacts')
            .select('lid, phone, name')
            .range(offset, offset + PAGE - 1);
        if (error) {
            console.error(`[DB] loadAllContacts failed: ${sanitizeError(error.message)}`);
            break;
        }
        if (!data || data.length === 0) break;
        for (const row of data) {
            contacts.set(row.lid, { phone: row.phone, name: row.name });
        }
        offset += data.length;
        if (data.length < PAGE) break;
    }
    return contacts;
}

// ============================================================
// Message Log
// ============================================================

async function logMessage({ waMessageId, sourceGroup, sourceContact, senderName, messageText, isRequest, parsedData, error }) {
    try {
        await supabase.from('v3_message_log').insert({
            wa_message_id: waMessageId || null,
            source_group: sourceGroup,
            source_contact: sourceContact,
            sender_name: senderName,
            message_text: messageText,
            is_request: isRequest,
            parsed_data: parsedData || null,
            error: error || null
        });
    } catch (err) {
        console.error('[DB] Failed to log message:', sanitizeError(err.message));
    }
}

async function messageAlreadyProcessed(waMessageId) {
    if (!waMessageId) return false;
    const { data, error } = await supabase
        .from('v3_message_log')
        .select('id')
        .eq('wa_message_id', waMessageId)
        .limit(1)
        .maybeSingle();
    if (error) {
        console.error(`[DB] messageAlreadyProcessed failed for waMessageId=${waMessageId}: ${sanitizeError(error.message)}`);
        return false;
    }
    return !!data;
}

// ============================================================
// Request Dedup
// ============================================================

function computeRequestHash({ sourceContact, type, category, destination, date }, legSuffix = '') {
    const normDest = normalizeLocation(destination) || '';
    const parts = [
        sourceContact || '',
        type || '',
        category || '',
        normDest.toLowerCase(),
        date || '',
        legSuffix || ''
    ].join('|');
    return crypto.createHash('sha256').update(parts).digest('hex').substring(0, 16);
}

async function findExistingRequest(hash) {
    const { data, error } = await supabase
        .from('v3_requests')
        .select('id, source_group')
        .eq('request_hash', hash)
        .eq('request_status', 'open')
        .limit(1)
        .single();
    if (error && error.code !== 'PGRST116') console.error(`[DB] findExistingRequest failed for hash=${hash}: ${sanitizeError(error.message)}`);
    return data;
}

// ============================================================
// Save Request (with dedup)
// ============================================================

async function saveRequest(data) {
    // ── Fan-out: when date is null AND possible_dates has 2+ candidates,
    //    insert one row per candidate date with `flexible` tag. Skip return-leg
    //    in this branch (round-trips don't fan out).
    const possible = Array.isArray(data.possibleDates) ? data.possibleDates : [];
    const isFanOut = !data.date && possible.length >= 2 && data.category === 'ride';
    if (isFanOut) {
        const baseTags = Array.isArray(data.tags) ? data.tags.slice() : [];
        if (!baseTags.includes('flexible')) baseTags.push('flexible');
        const normOrigin = normalizeLocation(data.origin);
        const normDest = normalizeLocation(data.destination);
        const inserted = [];
        for (const d of possible) {
            const h = computeRequestHash({
                sourceContact: data.sourceContact,
                type: data.type,
                category: data.category,
                destination: data.destination,
                date: d
            });
            const existing = await findExistingRequest(h);
            if (existing) {
                console.log(`[DB] Fan-out dup suppressed: ${data.sourceContact} → ${data.destination || 'N/A'} on ${d}`);
                continue;
            }
            const { data: row, error: rowErr } = await supabase
                .from('v3_requests')
                .insert({
                    source: data.source || 'whatsapp-baileys-v3',
                    source_group: data.sourceGroup,
                    source_contact: data.sourceContact,
                    sender_name: data.senderName || null,
                    request_type: data.type,
                    request_category: data.category,
                    ride_plan_date: d,
                    ride_plan_time: data.ridePlanTime || null,
                    date_fuzzy: true,
                    possible_dates: possible,
                    time_fuzzy: data.timeFuzzy ?? true,
                    request_origin: normOrigin,
                    request_destination: normDest,
                    request_details: data.details || {},
                    raw_message: data.rawMessage,
                    tags: baseTags,
                    request_status: 'open',
                    request_hash: h
                })
                .select()
                .single();
            if (rowErr) {
                console.error('[DB] Fan-out insert error for date ' + d + ':', sanitizeError(rowErr.message));
                continue;
            }
            inserted.push(row);
        }
        if (inserted.length) {
            console.log(`[DB] Fan-out inserted ${inserted.length} flexible rows (${data.type} ${data.category} → ${data.destination})`);
            return inserted[0];
        }
        return null;
    }

    const hash = computeRequestHash({
        sourceContact: data.sourceContact,
        type: data.type,
        category: data.category,
        destination: data.destination,
        date: data.date
    });

    const existing = await findExistingRequest(hash);
    if (existing) {
        console.log(`[DB] Duplicate suppressed: ${data.sourceContact} → ${data.destination || 'N/A'} on ${data.date || 'N/A'} (existing request ${existing.id})`);
        return null;
    }

    const normOrigin = normalizeLocation(data.origin);
    const normDest = normalizeLocation(data.destination);

    const { data: request, error } = await supabase
        .from('v3_requests')
        .insert({
            source: data.source || 'whatsapp-baileys-v3',
            source_group: data.sourceGroup,
            source_contact: data.sourceContact,
            sender_name: data.senderName || null,
            request_type: data.type,
            request_category: data.category,
            ride_plan_date: data.date,
            ride_plan_time: data.ridePlanTime   || null,
            date_fuzzy:     data.dateFuzzy      ?? false,
            possible_dates: data.possibleDates  ?? [],
            time_fuzzy:     data.timeFuzzy      ?? true,
            request_origin: normOrigin,
            request_destination: normDest,
            request_details: data.details || {},
            raw_message: data.rawMessage,
            tags: Array.isArray(data.tags) ? data.tags : [],
            request_status: 'open',
            request_hash: hash
        })
        .select()
        .single();

    if (error) {
        console.error('[DB] Error saving request:', sanitizeError(error.message));
        return null;
    }

    console.log(`[DB] Saved ${data.type} for ${data.category}: ${request.id}`);

    // ── Round-trip: save the return leg as a sibling row ──────────────────
    const rl = data.returnLeg;
    if (rl && (rl.date != null || rl.origin != null || rl.destination != null)) {
        const returnOrigin      = rl.origin      || normalizeLocation(data.destination);
        const returnDestination = rl.destination || normalizeLocation(data.origin);
        const returnDate        = rl.date ?? null;
        const returnTime        = rl.ride_plan_time ?? null;
        const returnDateFuzzy   = rl.date_fuzzy ?? (returnDate == null);
        const returnTimeFuzzy   = rl.time_fuzzy ?? (returnTime == null);

        const returnHash = computeRequestHash({
            sourceContact: data.sourceContact,
            type:          data.type,
            category:      data.category,
            destination:   returnDestination,
            date:          returnDate
        }, 'return');

        const existingReturn = await findExistingRequest(returnHash);
        if (existingReturn) {
            console.log(`[DB] Duplicate return-leg suppressed for primary ${request.id} (existing ${existingReturn.id})`);
        } else {
            const { data: returnRow, error: returnErr } = await supabase
                .from('v3_requests')
                .insert({
                    source: data.source || 'whatsapp-baileys-v3',
                    source_group: data.sourceGroup,
                    source_contact: data.sourceContact,
                    sender_name: data.senderName || null,
                    request_type: data.type,
                    request_category: data.category,
                    ride_plan_date: returnDate,
                    ride_plan_time: returnTime,
                    date_fuzzy:     returnDateFuzzy,
                    possible_dates: [],
                    time_fuzzy:     returnTimeFuzzy,
                    request_origin: normalizeLocation(returnOrigin),
                    request_destination: normalizeLocation(returnDestination),
                    request_details: data.details || {},
                    raw_message: data.rawMessage,
                    tags: Array.isArray(data.tags) ? data.tags : [],
                    request_status: 'open',
                    request_hash: returnHash,
                    roundtrip_parent_id: request.id
                })
                .select()
                .single();

            if (returnErr) {
                console.error('[DB] Error saving return leg:', sanitizeError(returnErr.message));
            } else {
                console.log(`[DB] Saved return leg for ${request.id}: ${returnRow.id}`);
            }
        }
    }

    return request;
}

// ============================================================
// Matching
// ============================================================

async function findMatches(request) {
    const oppositeType = request.request_type === 'need' ? 'offer' : 'need';

    let query = supabase
        .from('v3_requests')
        .select('*')
        .eq('request_category', request.request_category)
        .eq('request_type', oppositeType)
        .eq('request_status', 'open')
        .neq('id', request.id);

    if (request.request_category === 'ride' && request.request_destination) {
        query = query.eq('request_destination', request.request_destination);
    }

    if (request.ride_plan_date) {
        const date = new Date(request.ride_plan_date);
        const dayBefore = new Date(date);
        const dayAfter = new Date(date);
        dayBefore.setDate(date.getDate() - 1);
        dayAfter.setDate(date.getDate() + 1);

        query = query
            .gte('ride_plan_date', dayBefore.toISOString().split('T')[0])
            .lte('ride_plan_date', dayAfter.toISOString().split('T')[0]);
    }

    const { data: matches, error } = await query;

    if (error) {
        console.error('[DB] Error finding matches:', sanitizeError(error.message));
        return [];
    }

    return matches || [];
}

async function saveMatch(needId, offerId, score = 1.0, match_quality = 'medium') {
    const { data: existing, error: existErr } = await supabase
        .from('v3_matches')
        .select('id')
        .or(`and(need_id.eq.${needId},offer_id.eq.${offerId}),and(need_id.eq.${offerId},offer_id.eq.${needId})`)
        .single();

    if (existErr && existErr.code !== 'PGRST116') console.error(`[DB] saveMatch duplicate-check failed for need=${needId} offer=${offerId}: ${sanitizeError(existErr.message)}`);
    if (existing) return null;

    const { data: match, error } = await supabase
        .from('v3_matches')
        .insert({
            need_id: needId,
            offer_id: offerId,
            score,
            match_quality,
            notified: false
        })
        .select()
        .single();

    if (error) {
        console.error('[DB] Error saving match:', sanitizeError(error.message));
        return null;
    }

    await supabase
        .from('v3_requests')
        .update({ request_status: 'matched' })
        .in('id', [needId, offerId]);

    console.log(`[DB] Match created: ${match.id} (quality: ${match_quality})`);
    return match;
}

// ============================================================
// Stats
// ============================================================

async function getStats() {
    const { data: requests } = await supabase
        .from('v3_requests')
        .select('request_type, request_category, request_status');

    return {
        total: requests?.length || 0,
        needs: requests?.filter(r => r.request_type === 'need').length || 0,
        offers: requests?.filter(r => r.request_type === 'offer').length || 0,
        open: requests?.filter(r => r.request_status === 'open').length || 0,
        matched: requests?.filter(r => r.request_status === 'matched').length || 0
    };
}

module.exports = {
    supabase,
    loadMonitoredGroups,
    getGroupUpdates,
    seedGroups,
    upsertContact,
    resolveContactPhone,
    loadAllContacts,
    logMessage,
    messageAlreadyProcessed,
    computeRequestHash,
    saveRequest,
    findMatches,
    saveMatch,
    getStats
};
