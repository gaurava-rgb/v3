# Sprint 5 — Lifecycle + Dedup

**Status:** READY

## Goal
Fix the biggest product-logic issue: stop closing requests when a match is created. Add request expiry and improve dedup hashing.

## Prior sprint
Sprint 4 (complete): Dashboard split into routes/middleware/lib (36 lines). Shared date filter. Read-only Supabase client. See `SPRINT_4.md`.

## Tasks

### 1. Don't close requests on match
- **File:** `matcher.js`, `db.js`
- **What:** Currently, when a match is created, the request is marked as closed. This prevents it from matching with other potential rides. Remove the auto-close behavior.
- **Why:** Biggest product-logic fix. A need should be able to match multiple offers (and vice versa). Only admin action or expiry should close a request.
- **Done when:**
  - Creating a match does NOT close the need or offer
  - A request can appear in multiple matches
  - Existing match quality/scoring logic is unchanged

### 2. Request expiry (48h TTL)
- **File:** `db.js` or new `lib/expiry.js`
- **What:** Auto-expire ride requests older than 48 hours past their ride_plan_date. Requests with no date expire 48h after creation.
- **Why:** Stale requests clutter the board and produce irrelevant matches.
- **Done when:**
  - Expired requests don't appear on the public board
  - Expired requests don't generate new matches
  - Expiry runs on a schedule or at query time

### 3. Improve dedup hash
- **File:** `db.js`
- **What:** Add time bucket to the dedup hash so that the same person requesting the same route at different times isn't suppressed. Log suppression reasons.
- **Why:** Current hash (contact + type + category + dest + date) is too coarse — it suppresses legitimate re-requests at different times.
- **Done when:**
  - Dedup hash includes a time component
  - Suppressed duplicates log the reason
  - Existing dedup behavior for true duplicates is preserved

## Version
Target: v3.7.0

## Verification checklist
- [ ] Creating a match does not close the underlying requests
- [ ] A request can appear in multiple matches
- [ ] Requests older than 48h past ride_plan_date don't appear on board
- [ ] Dedup hash includes time bucket
- [ ] Duplicate suppressions log the reason
- [ ] `npm test` still passes (no regressions)
- [ ] Public board and digest still work
