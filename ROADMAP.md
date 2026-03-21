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
| 2 | Reliability | READY | LLM retry, DB error surfacing, log duplicate suppressions |
| 3 | Testing + match quality | PLANNED | Matcher unit tests, time in match score, parser contract tests |
| 4 | Architecture | PLANNED | Split dashboard.js, extract shared queries, Supabase client separation |
| 5 | Lifecycle + dedup | PLANNED | Don't close requests on match, expiry TTL, soft dedup |
| 6 | Observability | PLANNED | Parse false negative review, unmatched aging, match outcomes |

---

## Sprint Scopes

### Sprint 1 — DONE (v3.3.0, deployed 2026-03-21)
Committed pending matcher/normalize fix. Added rate limiting to `/submit`. Moved digest auth from query string to httpOnly cookie.

### Sprint 2 — Reliability
Stop losing data silently. Wrap LLM call with one retry + 2s backoff. Add structured error logging to all DB functions (function name, context, error). Log duplicate suppressions in dedup logic so we can measure how aggressive it is.

### Sprint 3 — Testing + Match Quality
Add first test infrastructure (jest or node:test). Matcher unit tests: score calculation, known location gate, nearby pairs, threshold. Parser contract tests: mock LLM response, verify field extraction, test error recovery. Add time proximity to match score (not just quality tier). Configurable score threshold via env var.

### Sprint 4 — Architecture
Split dashboard.js (~1800 lines) into routes/, views/, middleware/. Extract duplicated date-filter query to shared function. Introduce read-only Supabase client for public dashboard queries (defense-in-depth). Add CSRF to /submit form.

### Sprint 5 — Lifecycle + Dedup
Stop closing requests on match creation (biggest product win). Add request expiry (48h TTL). Add `closed` state for admin action. Simple match states: candidate → notified → accepted/expired. Improve dedup: add time bucket to hash, log suppression reasons.

### Sprint 6 — Observability
Admin view for parse false negatives (isRequest=false review queue). Unmatched request aging buckets. Match outcome tracking (notified → accepted vs expired). Quality tier correlation with real outcomes.
