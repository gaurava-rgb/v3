/**
 * Housing listing operations for v3_housing table.
 * Handles subleases, roommate searches, lease transfers, and other housing posts.
 */

var crypto = require('crypto');
var { writeClient, readClient } = require('./supabase');

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

    // --- Slug ---
    var listingType = parsed.listing_type || 'other';
    var location    = parsed.location    || 'unknown';
    var mon         = monthYear(parsed.available_date);
    var randHex     = crypto.randomBytes(2).toString('hex'); // 4 hex chars
    var slug = [slugify(listingType), slugify(location), mon, randHex].join('-');

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
    return data || [];
}

/**
 * Fetch a single listing by its slug.
 *
 * @param {string} slug
 * @returns {Object|null} - The row, or null if not found.
 */
async function getListingBySlug(slug) {
    if (!slug) return null;

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

    // Resolve poster's phone from wa_contacts using source_contact (JID/LID)
    if (data.source_contact) {
        var { data: contact } = await readClient
            .from('wa_contacts')
            .select('phone')
            .eq('lid', data.source_contact)
            .maybeSingle();
        if (contact && contact.phone) {
            data.poster_phone = contact.phone;
        }
    }

    return data;
}

module.exports = { upsertHousing, getActiveListings, getListingBySlug };
