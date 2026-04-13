# AggieConnect v3 — Sprint Roadmap

Created 2026-03-21. Updated as sprints complete.

## How to use this

- **ROADMAP.md** (this file) = where we're going. The full plan.
- **SPRINT_N.md** = what we're doing now. Self-contained: goal, tasks, files, verification.
- **DEV_NOTES.md** = full backlog with sprint assignments.

**Sprint cycle:**
1. Start of session → read `SPRINT_N.md` + `DEV_NOTES.md`
2. Work tasks, test each one
3. End of sprint → mark `SPRINT_N.md` complete, update `DEV_NOTES.md` checkboxes, write `SPRINT_N+1.md`, commit + deploy
4. Clear context → new session picks up cold from `SPRINT_N+1.md`

Future sprint files are written at the end of the preceding sprint (not pre-created).

---

## Sprint Table

| Sprint | Focus | Status | Key Items |
|--------|-------|--------|-----------|
| 1 | Security quick wins | DONE | Matcher local-errand fix, rate limiting, digest cookie auth |
| 2 | Reliability | DONE | LLM retry, DB error surfacing, log duplicate suppressions |
| 3 | Testing + match quality | DONE | Matcher unit tests, time in match score, parser contract tests, configurable threshold |
| 4 | Architecture | DONE | Split dashboard.js (36 lines), shared date filter, read-only Supabase client |
| 5 | Lifecycle + dedup | PLANNED | Don't close requests on match, expiry TTL, soft dedup |
| 6 | Observability | PLANNED | Parse false negative review, unmatched aging, match outcomes |
| 7 | User profiles | DONE | WA OTP auth, user_profiles table, /profile page, name seeding from wa_contacts |
| 8 | Profile editing | PLANNED | Edit display_name, email↔phone linking (greyed), rate-limited updates |
| 9 | Housing board | PLANNED | v3_housing table, parser extension, /housing board, /listing/:slug |
| 10 | Listing claim | PLANNED | Claim via OTP, edit form, image upload, bot DM on ingest |

---

## Sprint Scopes

### Sprint 1 — DONE (v3.3.0, deployed 2026-03-21)
Committed pending matcher/normalize fix. Added rate limiting to `/submit`. Moved digest auth from query string to httpOnly cookie.

### Sprint 2 — DONE (v3.4.0, deployed 2026-03-21)
LLM retry with 2s backoff in parser.js. Structured error logging in all db.js functions. Dedup suppression logging for measurement.

### Sprint 3 — DONE (v3.5.0, 2026-03-21)
Test infrastructure via node:test (51 tests). Matcher unit tests: computeMatchQuality, calculateScore, nearby locations, time proximity, configurable threshold. Parser contract tests: mocked LLM, field extraction, skip patterns, error recovery. Time proximity scoring in calculateScore(). MATCH_THRESHOLD env var (default 0.5).

### Sprint 4 — DONE (v3.6.0, 2026-03-22)
Split dashboard.js from 1957 lines to 36 lines. Route handlers in `routes/` (5 files), middleware in `middleware/` (2 files), shared logic in `lib/` (5 files). Extracted duplicated date-filter to `lib/dateFilter.js`. Read-only Supabase client for public queries (`lib/supabase.js`). CSRF deferred (low-traffic form).

### Sprint 5 — Lifecycle + Dedup
Stop closing requests on match creation (biggest product win). Add request expiry (48h TTL). Add `closed` state for admin action. Simple match states: candidate → notified → accepted/expired. Improve dedup: add time bucket to hash, log suppression reasons.

### Sprint 6 — Observability
Admin view for parse false negatives (isRequest=false review queue). Unmatched request aging buckets. Match outcome tracking (notified → accepted vs expired). Quality tier correlation with real outcomes.

---

## Housing + Auth Track (Sprints 7–10)

### Sprint 7 — User Profiles — DONE (v3.7.0, 2026-04-13)
WA OTP auth system (no SMS dependency). `user_profiles` table seeded from `wa_contacts`. `/profile` page showing name + masked phone + verified badge. `wa_phone` HMAC cookie alongside existing Supabase email sessions.

### Sprint 8 — Profile Editing + Email Linking
Edit display_name inline on `/profile`. Link email↔phone when both sessions present. Show email row greyed-out (read-only). Rate limit: 5 name changes/hour.

### Sprint 9 — Housing Board
Parser detects housing messages (sublease/roommate/lease-transfer). `v3_housing` table. Backfill 30 days from `v3_message_log`. `/housing` board with filter chips. `/listing/:slug` individual page with progressive disclosure (contact gated behind auth).

### Sprint 10 — Listing Claim + Photos
Claim a listing via phone OTP matched to `contact_phone`. Post-claim edit form. Image upload → Supabase Storage. Bot DM on housing ingest: "Your listing is live — claim it at ridesplit.app/listing/xyz".
