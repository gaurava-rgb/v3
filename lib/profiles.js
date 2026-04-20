/**
 * User profile operations.
 * One profile per verified phone. Name seeded from wa_contacts on first login.
 */

var { writeClient, readClient } = require('./supabase');

/**
 * Create or update a profile for a verified phone.
 * Seeds display_name from wa_contacts if this is the first login and no name yet.
 * Returns the profile row.
 */
async function upsertProfile(phone) {
    if (!phone) return null;
    var digits = phone.replace(/\D/g, '');

    // Look up existing name in wa_contacts
    var waName = null;
    var { data: contact } = await readClient
        .from('wa_contacts')
        .select('name')
        .eq('phone', digits)
        .maybeSingle();
    if (contact?.name) waName = contact.name;

    // Upsert: insert on first login, update wa_name + updated_at on repeat logins.
    // display_name is only set on insert (don't overwrite edits).
    var { data: existing } = await readClient
        .from('user_profiles')
        .select('id, display_name')
        .eq('phone', digits)
        .maybeSingle();

    if (!existing) {
        var { data: created, error } = await writeClient
            .from('user_profiles')
            .insert({
                phone:        digits,
                display_name: waName || null,
                wa_name:      waName || null,
            })
            .select()
            .single();
        if (error) console.error('[Profiles] Insert failed:', error.message);
        return created || null;
    }

    // Already exists — refresh wa_name in case it changed, touch updated_at
    var { data: updated, error: updateError } = await writeClient
        .from('user_profiles')
        .update({ wa_name: waName || existing.wa_name, updated_at: new Date().toISOString() })
        .eq('phone', digits)
        .select()
        .single();
    if (updateError) console.error('[Profiles] Update failed:', updateError.message);
    return updated || null;
}

/**
 * Fetch a profile by phone. Returns null if not found.
 */
async function getProfile(phone) {
    if (!phone) return null;
    var digits = phone.replace(/\D/g, '');
    var { data, error } = await readClient
        .from('user_profiles')
        .select('*')
        .eq('phone', digits)
        .maybeSingle();
    if (error) console.error('[Profiles] Fetch failed:', error.message);
    return data || null;
}

/**
 * Update a profile's display_name. Returns true on success.
 */
async function updateProfileName(phone, name) {
    if (!phone || !name) return false;
    var digits = phone.replace(/\D/g, '');
    var trimmed = name.trim().slice(0, 60);
    if (!trimmed) return false;
    var { error } = await writeClient
        .from('user_profiles')
        .update({ display_name: trimmed, updated_at: new Date().toISOString() })
        .eq('phone', digits);
    if (error) { console.error('[Profiles] Name update failed:', error.message); return false; }
    return true;
}

/**
 * Link a verified email address to a phone's profile.
 */
async function linkEmailToProfile(phone, email) {
    if (!phone || !email) return false;
    var digits = phone.replace(/\D/g, '');
    // Upsert: tap-to-verify users may not have a profile row yet (never WA-OTP-logged in)
    var { error } = await writeClient
        .from('user_profiles')
        .upsert({
            phone:          digits,
            email:          email.toLowerCase(),
            email_verified: true,
            updated_at:     new Date().toISOString(),
        }, { onConflict: 'phone' });
    if (error) { console.error('[Profiles] Email link failed:', error.message); return false; }
    return true;
}

/**
 * Returns true if the given email is linked to a verified phone in user_profiles.
 * Used to determine whether an email-logged-in user has completed WhatsApp verification.
 */
async function isEmailWaVerified(email) {
    if (!email) return false;
    var { data } = await readClient
        .from('user_profiles')
        .select('phone')
        .eq('email', email.toLowerCase())
        .not('phone', 'is', null)
        .limit(1);
    return !!(data && data.length > 0);
}

async function getPhoneForEmail(email) {
    if (!email) return null;
    var { data } = await readClient
        .from('user_profiles')
        .select('phone')
        .eq('email', email.toLowerCase())
        .not('phone', 'is', null)
        .limit(1);
    return (data && data.length > 0) ? data[0].phone : null;
}

module.exports = { upsertProfile, getProfile, updateProfileName, linkEmailToProfile, isEmailWaVerified, getPhoneForEmail };
