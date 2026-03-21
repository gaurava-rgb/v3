# Dev Notes — AggieConnect v3

Running notes on improvements, staging setup, and known issues identified during code review (2026-03-21).

---

## Pending Improvements

### Security
- [x] **Remove digest key from query string** — moved to httpOnly cookie with `/digest/login` flow. Cookie expires in 30 days. POST endpoints return 401 JSON on failure.
- [ ] **Add CSRF protection to `/submit` form** — form submissions rely only on auth check, no token. Add a CSRF token (e.g. `csurf` middleware or a simple double-submit cookie pattern).
- [x] **Add rate limiting to `/submit`** — `express-rate-limit`, 10 per 15min per IP. Returns 429 with JSON error.

### Reliability
- [ ] **Add retry on LLM failures** — if OpenRouter drops a call, the message is silently lost. Add one retry after ~2s around the `openai.chat.completions.create()` call in `parser.js`.
- [ ] **Surface DB errors** — all DB functions catch errors and return `null` silently. Caller never knows if a save failed. Consider at minimum logging with enough context (which message, which group) to trace in PM2 logs.

### Matching Quality (parked — in progress)
- [ ] Time matching — time is only used for quality tier label, not the match score. Two people at opposite ends of a day score the same.
- [ ] `areNearby()` pairs are static in `normalize.js` — adding a new city pair requires a code change.
- [ ] Score threshold (0.5) is hardcoded in `matcher.js:58` — no operational dial.
- [x] **Prevent local-errand mismatches** — `isKnownLocation()` gate + `areNearby()` pairs committed in v3.3.0. Bryan split from College Station.

### Architecture
- [ ] **Split `dashboard.js`** — 1710+ lines handling auth, HTML, CSS, client JS, routing, and digest in one file. Not urgent but will become painful as features grow. Suggested split: `routes/`, `views/`, `middleware/`.
- [ ] **Date filter logic duplicated** — the same Supabase `.or('ride_plan_date.gte...`)` filter appears at `dashboard.js:1172` and `dashboard.js:675`. Extract to a shared function.

### Outbound Messaging
- [ ] `outbound_queue` table exists but is unused — bot can receive but not close the loop with matched users. Planned for a future iteration. Schema is ready.

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
