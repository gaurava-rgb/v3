# Aggie Connect — Completed v3.1.x Implementation Details

> Archived from the main plan file on Feb 27, 2026.
> These sections are DONE and deployed. Kept here for historical reference only.

---

# v3.1 — Dashboard Redesign ✅ COMPLETE

## What It Is
One clean public page at v3.myburrow.club that answers two questions:
- **Student**: "Who else is going my direction?"
- **Potential driver**: "Is there demand I could serve?"
- **Operator (you)**: "Is the system collecting and organizing data correctly?"

## Key Design Decisions
- **Language**: "Going the same way" — not "matched." No confirmed bookings exist yet. These are signals, not commitments.
- **Need/offer split**: Keep it. When someone offers with a time ("driving to Houston at 10 AM"), that's the highest-value signal on the page.
- **No "driver" framing**: Avoids cultural baggage around being a "driver." The framing is peer-to-peer: people going the same way who might share the trip.
- **Soft "no offer" language**: When nobody's offered a ride on a route, use "Nobody on this route is driving as of now" or "Undecided" — NOT "No driver yet" or "Travel plans unclear."
- **Redacted data**: Public page shows partial info (Ga***v, 19***7). Full details behind auth in v3.2.

## Page Structure

**1. Hero**
- "Aggie Connect"
- "Tracking [X] ride requests across [Y] WhatsApp groups this week"

**2. "Going the Same Way" Board (main content)**
- Grouped by date (upcoming 7 days)
- Each date card shows routes:
  ```
  Fri, Feb 28

  College Station → Houston
  🚗 1 offering (10:00 AM)
  👋 3 looking for rides
  🟢 Going the same way

  College Station → Dallas
  👋 2 looking for rides
  ○ Nobody's driving as of now
  ```
- Offering details (time) shown when available
- Routes with offers → "🟢 Going the same way"
- Routes with only needs → "○ Nobody's driving as of now" (soft, not alarming)
- Uses dashboard3's buildClusters() logic for route+date grouping

**3. Opportunities**
- Routes where 2+ people need rides but no one's offered
- "3 students heading to Houston this Friday — no ride offered yet"
- Soft pitch: this is where someone with a car thinks "I could do that"

**4. Recent Activity**
- "Saw 8 ride requests today across 16 groups"
- Light signal that the system is alive and working

**5. Footer (operator stats)**
- Total requests / groups / last updated / version

## Technical Changes
- **Merge** dashboard3.js cluster logic into dashboard.js
- **Kill** dashboard3.js, port 3006, PM2 process aggie-v3-dash3
- **Modify**: dashboard.js (rewrite HTML), ecosystem.config.js, .claude/launch.json
- **Preserve**: GA tag G-PT7Y07LEPC, Supabase queries, cluster logic

## Deploy
```
git commit + push → ssh agconnect "cd ~/aggieconnect-v3 && git pull && pm2 restart aggie-v3-dash && pm2 delete aggie-v3-dash3 && pm2 save"
```

## Verification
1. Preview locally, screenshot, review before deploying
2. Check demand board renders with real Supabase data
3. Deploy to VPS, confirm v3.myburrow.club shows new design

---

# v3.1.1 — Migrate v2 Data + Test Group Toggle

## Context
The `baileys_*` tables (v2) have been collecting ride data the longest. That data should appear on the v3.1 dashboard. Both table sets live in the same Supabase database — this is a SQL-only migration.

Separately, the "dump group" used for testing pollutes the dashboard. We need a way to exclude test data.

## Part 1: Data Migration (baileys_* → v3_*)

**Scope:** Only future-dated requests (ride_plan_date >= today OR NULL). Past rides won't help the dashboard.

**Schema diff — what v3 has that v2 doesn't:**
| v3 column | Default for migrated rows |
|-----------|--------------------------|
| sender_name | NULL |
| ride_plan_time | NULL |
| date_fuzzy | false |
| possible_dates | '{}' |
| time_fuzzy | true (conservative — v2 didn't track time precision) |

**Migration order:** requests → matches → message_log (FK dependencies)

### SQL to run in Supabase SQL Editor

```sql
-- Step 1: Migrate requests (future-dated only)
INSERT INTO v3_requests (
  id, source, source_group, source_contact, sender_name,
  request_type, request_category, ride_plan_date,
  ride_plan_time, date_fuzzy, possible_dates, time_fuzzy,
  request_origin, request_destination, request_details,
  raw_message, request_status, request_hash, created_at
)
SELECT
  id, source, source_group, source_contact, NULL,
  request_type, request_category, ride_plan_date,
  NULL, false, '{}', true,
  request_origin, request_destination, request_details,
  raw_message, request_status, request_hash, created_at
FROM baileys_requests
WHERE ride_plan_date >= CURRENT_DATE
   OR ride_plan_date IS NULL
ON CONFLICT (request_hash) DO NOTHING;

-- Step 2: Migrate matches (only for requests that made it)
INSERT INTO v3_matches (
  id, need_id, offer_id, score, match_quality, notified, created_at
)
SELECT
  bm.id, bm.need_id, bm.offer_id, bm.score, 'medium', bm.notified, bm.created_at
FROM baileys_matches bm
WHERE EXISTS (SELECT 1 FROM v3_requests vr WHERE vr.id = bm.need_id)
  AND EXISTS (SELECT 1 FROM v3_requests vr WHERE vr.id = bm.offer_id)
ON CONFLICT (id) DO NOTHING;

-- Step 3: Migrate message_log (future-dated messages only)
INSERT INTO v3_message_log (
  id, wa_message_id, source_group, source_contact, sender_name,
  message_text, is_request, parsed_data, error, created_at
)
SELECT
  id, wa_message_id, source_group, source_contact, sender_name,
  message_text, is_request, parsed_data, error, created_at
FROM baileys_message_log
WHERE created_at >= (CURRENT_DATE - INTERVAL '7 days')
ON CONFLICT (id) DO NOTHING;
```

## Part 2: Fix Test Group Data Leak (BUG)

### The Bug
Migration completed but Dump group data is showing on the dashboard. Root cause:
- **v2** stored `source_group` as the group **name** (e.g. `"Dump"`)
- **v3** stores `source_group` as the group **JID** (e.g. `"120363424670154278@g.us"`)
- Dashboard filter builds a `testGroupIds` Set containing only JIDs, so `testGroupIds.has('Dump')` → `false` → data leaks through

### Fix
Use `is_test` column on `monitored_groups`. Build a filter set containing **both** `group_id` AND `group_name` for each test group to catch both v2 (stored by name) and v3 (stored by JID) rows.

---

# v3.1.2 — Timezone Fix + UI/UX Skill

## Context
The VPS runs in UTC (`Etc/UTC`). At 8-9 PM CST on Wed Feb 25 (= 01:00-02:00 UTC Thu Feb 26), `new Date()` returns Feb 26 — so the dashboard showed "Today, Thu Feb 26" when it was still Wednesday evening in Texas. This also affects `parser.js` — the LLM is told the wrong date, so relative dates like "tomorrow" and "Friday" get resolved incorrectly.

### The Fix
Add `TZ: 'America/Chicago'` to `ecosystem.config.js` env block for all PM2 processes. Zero code changes needed — Node's `new Date()` respects TZ env var.

---

# v3.1.3 — Admin Digest Page (Value Gauge)

**Status: REPLACES standalone digest.js Baileys bot (failed — WhatsApp rate-limited linking)**

## Context
Before building v3.2 auth + automated notifications, validate that matches are actually worth connecting. Added a password-protected `/digest` page to dashboard.js with:
- Full unredacted contact info for all open matches
- wa.me deep links for one-tap WhatsApp messaging with pre-filled templates
- "Mark Handled" buttons for tracking
- Auto-refresh every 5 minutes

### Routes Added
| Route | Method | Purpose |
|---|---|---|
| `GET /digest?key=SECRET` | GET | Renders admin digest HTML page |
| `POST /digest/mark?key=SECRET` | POST | Marks match(es) as handled (notified=true) |

### Functions Ported from digest.js
`digestFormatPhone()`, `digestFirstName()`, `phoneDigitsOnly()`, `generateRiderMessage()`, `generateDriverMessage()`, `fetchOpenMatches()`, `markNotified()`, `renderMatchCard()`, `digestAuth()`
