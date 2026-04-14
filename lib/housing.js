/**
 * Housing listing operations for v3_housing table.
 * Handles subleases, roommate searches, lease transfers, and other housing posts.
 */

var crypto = require('crypto');
var { writeClient, readClient } = require('./supabase');

// In-memory caches — avoids round trips to Supabase on repeat requests
var slugCache  = new Map(); // slug  → { data, expires }
var boardCache = new Map(); // key   → { data, expires }
var SLUG_TTL   = 5  * 60 * 1000; // 5 min — listing detail
var BOARD_TTL  = 60 * 1000;       // 60 sec — board list (refreshes quickly for new listings)

function cacheGet(map, key) {
    var entry = map.get(key);
    if (entry && entry.expires > Date.now()) return entry.data;
    map.delete(key);
    return null;
}
function cacheSet(map, key, data, ttl) {
    map.set(key, { data: data, expires: Date.now() + ttl });
}

/**
 * Derive a URL-safe slug segment from a raw string.
 * Lowercases, converts spaces to hyphens, strips non-alphanumeric chars except hyphens.
 */
function slugify(str) {
    if (!str) return 'unknown';
    return str
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
}

/**
 * Format a date string (YYYY-MM-DD) or Date into "mon-yyyy", e.g. "apr-2026".
 * Falls back to current month if date is missing or unparseable.
 */
function monthYear(dateStr) {
    var months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    var d = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    return months[d.getUTCMonth()] + '-' + d.getUTCFullYear();
}

/**
 * Extract a 10-digit US phone number from a free-text string.
 * Returns the digits only (no formatting), or null if none found.
 */
function extractPhone(contactInfo) {
    if (!contactInfo) return null;
    var match = contactInfo.replace(/\D/g, '').match(/\d{10}/);
    return match ? match[0] : null;
}

/**
 * Insert a housing listing parsed from a WhatsApp message.
 *
 * @param {Object} parsed       - Housing sub-object from parser:
 *                                { listing_type, location, price, available_date,
 *                                  end_date, bedrooms, bathrooms, contact_info, amenities }
 * @param {string} rawMessage   - Original raw message text (used for hash + storage)
 * @param {string} sourceContact - WhatsApp JID of the sender
 * @param {string} senderName   - Display name of the sender
 * @returns {Object|null}       - Inserted row, or null on duplicate / error
 */
async function upsertHousing(parsed, rawMessage, sourceContact, senderName) {
    if (!parsed || !rawMessage) return null;

    // --- Dedup hash ---
    var hash = crypto.createHash('sha256').update(rawMessage).digest('hex');

    // --- Slug (random, reveals nothing about the listing) ---
    var slug = crypto.randomBytes(8).toString('hex'); // e.g. a3f12b8c9d4e5f6a

    // --- Contact phone ---
    var contactPhone = extractPhone(parsed.contact_info);

    // --- Build row ---
    var row = {
        slug:           slug,
        source_contact: sourceContact || null,
        sender_name:    senderName    || null,
        message_text:   rawMessage,
        listing_type:   parsed.listing_type    || null,
        location:       parsed.location        || null,
        price:          parsed.price           || null,
        available_date: parsed.available_date  || null,
        end_date:       parsed.end_date        || null,
        bedrooms:       parsed.bedrooms        || null,
        bathrooms:      parsed.bathrooms       || null,
        amenities:      parsed.amenities       || null,
        contact_phone:  contactPhone,
        contact_info:   parsed.contact_info    || null,
        message_hash:   hash,
    };

    var { data, error } = await writeClient
        .from('v3_housing')
        .insert(row)
        .select()
        .single();

    if (error) {
        // Unique constraint on message_hash → duplicate
        if (error.code === '23505') {
            console.log('[Housing] Duplicate skipped');
            return null;
        }
        console.error('[Housing] Insert failed:', error.message);
        return null;
    }

    console.log('[Housing] Inserted:', slug);
    return data;
}

/**
 * Fetch active housing listings, optionally filtered by listing_type.
 *
 * @param {Object} filters - Optional. Supports: { listing_type }
 * @returns {Array}        - Array of v3_housing rows, newest first.
 */
async function getActiveListings(filters) {
    filters = filters || {};

    var cacheKey = 'board:' + (filters.listing_type || 'all');
    var cached = cacheGet(boardCache, cacheKey);
    if (cached) return cached;

    var query = readClient
        .from('v3_housing')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });

    if (filters.listing_type) {
        query = query.eq('listing_type', filters.listing_type);
    }

    var { data, error } = await query;
    if (error) {
        console.error('[Housing] getActiveListings failed:', error.message);
        return [];
    }
    var result = data || [];
    cacheSet(boardCache, cacheKey, result, BOARD_TTL);
    return result;
}

/**
 * Fetch a single listing by its slug.
 *
 * @param {string} slug
 * @returns {Object|null} - The row, or null if not found.
 */
async function getListingBySlug(slug) {
    if (!slug) return null;

    var cached = cacheGet(slugCache, slug);
    if (cached) return cached;

    var { data, error } = await readClient
        .from('v3_housing')
        .select('*')
        .eq('slug', slug)
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('[Housing] getListingBySlug failed:', error.message);
        return null;
    }
    if (!data) return null;

    // Resolve poster's phone from wa_contacts — only if not already cached in the row

    if (data.source_contact && !data.poster_phone) {
        var { data: contact } = await readClient
            .from('wa_contacts')
            .select('phone')
            .eq('lid', data.source_contact)
            .maybeSingle();
        if (contact && contact.phone) {
            data.poster_phone = contact.phone;
            // Cache it back so future loads skip this query entirely
            writeClient
                .from('v3_housing')
                .update({ poster_phone: contact.phone })
                .eq('id', data.id)
                .then(function() {})
                .catch(function() {});
        }
    }

    cacheSet(slugCache, slug, data, SLUG_TTL);
    return data;
}

module.exports = { upsertHousing, getActiveListings, getListingBySlug };
