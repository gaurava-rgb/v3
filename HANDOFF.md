# Aggie Connect Baileys v3 — Handoff Document

## What This Project Is
A WhatsApp group monitoring bot that reads rideshare request/offer messages from TAMU student groups, parses them with an LLM (Claude), stores them in Supabase, and matches needs with offers. Runs alongside v2 (`aggieconnect-baileys`) on the same VPS.

## Key Differences: v3 vs v2
| | v2 | v3 |
|---|---|---|
| Table prefix | `baileys_` | `v3_` |
| Ports | 3002/3003 | 3004/3005/3006 |
| PM2 names | `aggie-baileys-*` | `aggie-v3-*` |
| Auth dir | `.baileys_auth/` | `.v3_auth/` |
| Fuzzy dates | ❌ | ✅ `date_fuzzy`, `possible_dates` |
| Fuzzy times | ❌ | ✅ `ride_plan_time`, `time_fuzzy` |
| Match quality | ❌ | ✅ `strong`/`medium`/`low` |
| Trip clusters dashboard | ❌ | ✅ `dashboard3.js` (port 3006) |
| `outbound_queue` table | ❌ | ✅ (schema prep, not used yet) |
| `sender_name` in requests | ❌ | ✅ |

## File Structure
```
aggieconnectbaileysv3/
├── bot.js          — main bot (Baileys, message processing, LID resolution)
├── parser.js       — Claude LLM parser (extracts ride intent, dates, times)
├── db.js           — Supabase client (v3_ tables, dedup, match saving)
├── matcher.js      — matching logic + match quality computation
├── normalize.js    — location name normalization (copied from v2)
├── dashboard.js    — port 3004, requests/matches view
├── monitor.js      — port 3005, PM2 health + logs
├── dashboard3.js   — port 3006, trip clusters with conversion gap indicators
├── schema.sql      — full schema (run once in Supabase SQL editor)
├── ecosystem.config.js — PM2: aggie-v3-bot, aggie-v3-dash, aggie-v3-monitor, aggie-v3-dash3
├── package.json    — name: aggieconnect-baileys-v3, version: 3.0.0
├── .env.example    — SUPABASE_URL, SUPABASE_KEY, ANTHROPIC_API_KEY, DASH_PORT=3004, DASH3_PORT=3006
├── .v3_auth/       — Baileys auth state (DO NOT DELETE — re-scan QR if you do)
└── CONTEXT.md      — full architecture notes
```

## Supabase Tables
- `v3_requests` — parsed rideshare requests (need/offer)
- `v3_matches` — matched need+offer pairs
- `v3_message_log` — all messages (request and non-request)
- `outbound_queue` — future outbound messaging (not used yet)
- `wa_contacts` — LID→phone mapping (populated if contacts.upsert fires)
- `monitored_groups` — shared with v2, controls which groups are watched

## Schema Migrations Needed (run in Supabase)
The table `v3_requests` needs a `sender_name` column — run this if you haven't already:
```sql
ALTER TABLE v3_requests ADD COLUMN IF NOT EXISTS sender_name TEXT;
```

## Current Bot State
- **Running**: `node bot.js` (PID varies), logs to `/tmp/v3bot.log`
- **Connected**: Linked device on WhatsApp (scanned QR once, auth persisted in `.v3_auth/`)
- **Monitoring**: 16 groups (configured in Supabase `monitored_groups` table)
- **DB**: ~5 test requests saved, 0 matches (all test data from same contact)

## Resolved Issues
- **440 connectionReplaced loop**: Fixed — bot now calls `process.exit(1)` on this reason instead of reconnecting
- **Parser fuzzy fields**: Working — `date_fuzzy`, `time_fuzzy`, `possible_dates`, `ride_plan_time` all extracted correctly
- **Dedup**: Working — same contact + same route + same date = duplicate, skipped

## LID → Phone Number Resolution (FIXED in v3.1)
Previously accepted as a hard limitation, but Baileys 6.7.21 already had untapped data sources:

**Resolution sources (in order of reliability):**
1. `msg.key.participantPn` — phone number on every incoming group message (biggest win)
2. `participant.jid` in group metadata — phone numbers for all participants at startup (handles LID addressing mode)
3. `chats.phoneNumberShare` event — fires when a user shares their phone number
4. `contacts.upsert` with `c.jid` field — phone JID when `c.id` is a LID
5. `messaging-history.set` contacts array — LID→phone from history sync
6. `lid-mapping.update` event — explicit pairs from WA protocol (rare)
7. DB fallback via `resolveContactPhone()` — persists across restarts

**How it works:** Each source calls `lidToPhone.set()` (in-memory) + `upsertContact()` (persists to `wa_contacts` + retroactively backfills `v3_requests` and `v3_message_log` rows that stored raw LIDs).

**Fallback:** If no phone mapping exists yet, `sender_name` (from `msg.pushName`) provides a human-readable identifier.

**Recovery tag:** `v3.0.0-stable` — the pre-fix baseline commit.

## Parser Schema (what Claude extracts)
```json
{
  "isRequest": true,
  "type": "need|offer",
  "category": "ride",
  "origin": "College Station",
  "destination": "Austin",
  "date": "2026-02-26",
  "date_fuzzy": false,
  "possible_dates": [],
  "ride_plan_time": "08:00",
  "time_fuzzy": false,
  "details": {}
}
```

## Match Quality Logic (`matcher.js`)
- **strong**: exact date (not fuzzy) + exact time (not fuzzy) for both sides
- **medium**: exact date (not fuzzy), at least one side has fuzzy time
- **low**: fuzzy date overlap, or dates 1 day apart

## How to Run Locally
```bash
cp .env.example .env   # fill in credentials
npm install
node bot.js            # starts bot, scan QR on first run
node dashboard.js      # port 3004
node dashboard3.js     # port 3006
```

## How to Deploy (VPS)
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```
Ports: 3004 (dashboard), 3005 (monitor), 3006 (clusters)

## Next Steps / Open Items
1. **Test a real match** — send a `need` and `offer` for same route/date from two different numbers, verify match is created and logged
2. **Dashboard review** — check `localhost:3004` and `localhost:3006` look correct with real data
3. **Deploy to VPS** — copy files, run `npm install`, start with PM2
4. **Destination normalization edge case** — "Bryan San Office" gets normalized to "College Station" because `normalize.js` maps Bryan → College Station variants. May want to pass unknown destinations through as-is.
5. **Outbound bot (v3.1)** — `outbound_queue` table is ready; build a separate process to send WhatsApp messages for match notifications
