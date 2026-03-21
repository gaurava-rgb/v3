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
- [ ] **Split `dashboard.js`** — *Sprint 4*. Routes, views, middleware separation.
- [ ] **Date filter logic duplicated** — *Sprint 4*. Extract to shared function.
- [ ] **Supabase client separation** — *Sprint 4*. Read-only client for public queries.

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
