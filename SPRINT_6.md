# Sprint 6: Optimize Startup Contact Sync

**Date:** 2026-03-27
**Goal:** Stop the bot from hammering Supabase with thousands of unnecessary DB calls on every restart.

## Problem

On every restart, the bot fetches all group participants (~2,862 contacts) and for each one:
1. Upserts to `wa_contacts` (even if nothing changed)
2. Runs 2 backfill UPDATE queries on `v3_requests` and `v3_message_log` (even if zero rows need fixing)

That's ~8,586 DB calls firing all at once. Supabase gets overwhelmed — we see Cloudflare 502s and connection pool timeouts. Meanwhile:
- `wa_contacts` already has 4,183 contacts
- `v3_requests` (408 rows) has zero LIDs left to backfill
- `v3_message_log` (973 rows) has zero LIDs left to backfill

99.9% of the work is wasted.

## Plan

### File 1: `db.js`
- Add `loadAllContacts()` — one query to fetch all `lid`, `phone`, `name` from `wa_contacts`. Returns a Map.

### File 2: `bot.js`
- On startup (`onConnected()`), call `loadAllContacts()` to pre-populate `lidToPhone` and a `knownContacts` Map (tracks phone + name)
- In the group participant loop, compare each contact against `knownContacts` — skip if lid exists with same phone and name
- Only call `upsertContact` for new or changed contacts
- In `upsertContact`: only run the 2 backfill UPDATEs when the contact is new or the phone changed (the only cases where old rows could have a stale LID)

### What we don't touch
- Real-time message handling (messages.upsert, contacts.upsert, lid-mapping.update, etc.) — those stay as-is
- Parser, matcher, dashboard — no changes
- No other files

## Testing

1. Add logging: "Loaded X contacts from DB, Y new, Z changed, W skipped"
2. Local dry run — bot connects, loads contacts, skips ~2,862, fires zero upserts, no Supabase errors
3. Verify bot still connects, lists 16 groups, shows DB stats
4. Review diff before deploying to VPS
5. After deploy — check PM2 logs for clean startup, no 502s, no connection pool errors

## Known edge cases (deferred)
- LID→phone mapping can theoretically change (user ports number). Not enough users to worry about now. Flagged for later.

## Result target
Restart goes from ~8,586 DB calls to <50 (only genuinely new contacts).
