# Dev Notes — AggieConnect v3

Running notes on improvements, staging setup, and known issues identified during code review (2026-03-21).

---

## Pending Improvements

See `ROADMAP.md` for full sprint plan. Sprint assignments shown below.

### Security
- [x] **Remove digest key from query string** — ~~Sprint 1~~ DONE. Moved to httpOnly cookie.
- [ ] **Add CSRF protection to `/submit` form** — *Sprint 4*. Double-submit cookie pattern.
- [x] **Add rate limiting to `/submit`** — ~~Sprint 1~~ DONE. 10 per 15min per IP.

### Reliability
- [x] **Add retry on LLM failures** — ~~Sprint 2~~ DONE. One retry after ~2s in `parser.js`.
- [x] **Surface DB errors** — ~~Sprint 2~~ DONE. Structured logging in `db.js`.
- [x] **Log duplicate suppressions** — ~~Sprint 2~~ DONE. Logs sender, dest, date, existing ID.

### Matching Quality
- [x] **Time in match score** — ~~Sprint 3~~ DONE. Time proximity in `calculateScore()`: ≤30min full, ≤2h small penalty, >2h larger penalty.
- [ ] `areNearby()` pairs are static in `normalize.js` — *Backlog*. Not urgent.
- [x] **Score threshold configurable** — ~~Sprint 3~~ DONE. `MATCH_THRESHOLD` env var, default 0.5.
- [x] **Prevent local-errand mismatches** — ~~Sprint 1~~ DONE. v3.3.0.

### Testing
- [x] **Matcher unit tests** — ~~Sprint 3~~ DONE. 33 tests: scoring, quality tiers, nearby, time proximity, threshold.
- [x] **Parser contract tests** — ~~Sprint 3~~ DONE. 18 tests: skip patterns, field extraction, error recovery, retry.

### Architecture
- [x] **Split `dashboard.js`** — ~~Sprint 4~~ DONE. Routes in `routes/`, middleware in `middleware/`, shared code in `lib/`. dashboard.js is 36 lines.
- [x] **Date filter logic duplicated** — ~~Sprint 4~~ DONE. `lib/dateFilter.js`: `filterActiveRequests()` + `buildTestGroupSet()`.
- [x] **Supabase client separation** — ~~Sprint 4~~ DONE. `lib/supabase.js`: `readClient` (public queries), `writeClient` (bot/admin), `authClient` (auth ops).

### Lifecycle + Dedup
- [ ] **Don't close requests on match** — *Sprint 5*. Biggest product-logic fix.
- [ ] **Request expiry** — *Sprint 5*. 48h TTL, auto-expire stale requests.
- [ ] **Improve dedup hash** — *Sprint 5*. Add time bucket, log suppression reasons.

### Observability
- [ ] **Parse false negative review** — *Sprint 6*. Admin view of isRequest=false messages.
- [ ] **Unmatched request aging** — *Sprint 6*. Track open requests by age bucket.
- [ ] **Match outcome tracking** — *Sprint 6*. Notified → accepted vs expired.

### Outbound Messaging
- [ ] `outbound_queue` table exists but is unused — *Backlog*. Schema is ready.

---

## Housing Detail Page — 830ms TTFB Lag (Fixed Apr 14 2026)

### Symptom
Clicking a listing card on `/housing` had a noticeable ~1.5s delay before the page opened. Measured via Playwright + Chrome Performance API: **TTFB 830ms**, all of it at the origin server (`cfOrigin: 803ms`).

### Root Cause
`getListingBySlug()` in `lib/housing.js` was making **two sequential Supabase queries** on every page load:

1. `SELECT * FROM v3_housing WHERE slug = $1` — fetch the listing row
2. `SELECT phone FROM wa_contacts WHERE lid = $1` — resolve the poster's real phone number

The VPS (Hetzner, Germany) → Supabase round trip is ~400ms. Two sequential queries = ~800ms before any HTML was sent.

There was also no index on `v3_housing.slug`, so query 1 was doing a full table scan.

### Fix (3 layers)

**1. Indexes** (already applied in Supabase SQL editor Apr 14 2026)
```sql
CREATE INDEX IF NOT EXISTS idx_v3_housing_slug ON v3_housing(slug);
CREATE INDEX IF NOT EXISTS idx_wa_contacts_lid ON wa_contacts(lid);
ALTER TABLE v3_housing ADD COLUMN IF NOT EXISTS poster_phone TEXT;
```

**2. Eliminate the second query after first visit**
`getListingBySlug` now skips the `wa_contacts` lookup if `poster_phone` is already cached in the housing row. On the first load it still does both queries, but writes the resolved phone back into `v3_housing.poster_phone` (fire-and-forget). Every subsequent page load is one query.

**3. In-memory cache**
Added a `Map`-based cache in `lib/housing.js`:
- Listing detail (`slugCache`): 5-minute TTL per slug
- Board listings (`boardCache`): 60-second TTL per filter key

After the cache is warm, TTFB drops to ~184ms (from 830ms). Board page dropped from ~3.7s to ~2.0s cold, sub-100ms warm.

### Results
| Scenario | TTFB | Total nav |
|---|---|---|
| Before | 830ms | ~1500ms |
| After — cold (first visit) | 480ms | ~1100ms |
| After — warm (cache hit) | 184ms | ~815ms |

### What to watch
- Cache is process-scoped (`aggie-v3-dash`). A `pm2 restart` clears it — first visit after restart will be cold.
- `poster_phone` backfill only happens on page view, not in batch. Listings never previously opened will still do 2 queries on first load.
- Board cache is 60s — new listings from the bot may take up to 60s to appear.

---

## Staging Environment

### Goal
Test dashboard changes, matching logic, and normalize tweaks without touching prod data or the live WhatsApp session.

### What can be staged easily
- `dashboard.js`, `matcher.js`, `normalize.js`, `parser.js` — all just need different env vars pointing to a staging Supabase project.
- Run on a different port (e.g. 3006) locally or on VPS alongside prod.

### What can't be simply staged
- `bot.js` — WhatsApp only allows one Baileys session per account. Running a staging bot requires a second WhatsApp number (burner SIM or Google Voice), or skip the bot entirely and use the web form to inject test rides.

### Recommended minimal staging setup

1. Create a second free Supabase project (staging).
2. Run `schema.sql` against it.
3. Copy a subset of `v3_requests` + `v3_matches` rows; anonymize `source_contact`, `sender_name`, `raw_message`.
4. Create `.env.staging` with staging Supabase creds + same OpenRouter key.
5. Run dashboard against it on a different port:
   ```
   PORT=3006 $(cat .env.staging) node dashboard.js
   ```

### Note on "read replicas"
Supabase read replicas (paid) are for query scaling — writes still hit prod. For isolation you want a **separate project with a data snapshot**, not a replica. Free tier allows multiple projects.

### Best approach for testing matching logic changes
Use the **replay approach**: read historical rows from `v3_message_log` in prod (read-only), re-run them through the modified `matcher.js` against the staging DB, and compare results. Tests real data without touching prod.

---

## Architecture Reference (quick)

| File | Role |
|---|---|
| `bot.js` | Baileys WhatsApp client, message orchestration |
| `parser.js` | LLM extraction via OpenRouter |
| `db.js` | Supabase CRUD, dedup, contact resolution |
| `matcher.js` | Need↔offer matching, quality scoring |
| `normalize.js` | Location name normalization |
| `dashboard.js` | Express: public board + admin digest + auth |
| `monitor.js` | PM2 health dashboard (port 3005) |

PM2 processes: `aggie-v3-bot`, `aggie-v3-dash` (3004), `aggie-v3-monitor` (3005)
