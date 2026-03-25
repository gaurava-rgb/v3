/**
 * Supabase client configuration
 * - readClient: read-only client for public dashboard queries
 * - writeClient: full-access client for bot/admin operations
 * - authClient: separate client for auth operations (prevents session poisoning)
 */

var { createClient } = require('@supabase/supabase-js');

var url = process.env.SUPABASE_URL;
var serviceKey = process.env.SUPABASE_KEY;
var readOnlyKey = process.env.SUPABASE_READ_KEY || serviceKey;

var writeClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

var readClient = createClient(url, readOnlyKey, {
    db: { schema: 'public' },
    auth: { autoRefreshToken: false, persistSession: false }
});

var authClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

module.exports = { readClient, writeClient, authClient };
