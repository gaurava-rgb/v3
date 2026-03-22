# Sprint 4 — Architecture

**Status:** COMPLETE

## Goal
Split the monolithic dashboard.js into smaller modules and add remaining security hardening.

## Prior sprint
Sprint 3 (complete): Test infrastructure (51 tests), time proximity scoring, configurable match threshold. See `SPRINT_3.md`.

## Tasks

### 1. Split dashboard.js into routes/views/middleware — DONE
- `dashboard.js` went from 1957 lines to 36 lines
- Route handlers in `routes/` (public.js, auth.js, submit.js, digest.js, static.js)
- Auth/rate-limit middleware in `middleware/` (auth.js, rateLimiter.js)
- Shared code in `lib/` (helpers.js, views.js, data.js, dateFilter.js, supabase.js)

### 2. Extract duplicated date-filter query — DONE
- `lib/dateFilter.js` exports `filterActiveRequests()` and `buildTestGroupSet()`
- Used by both `routes/public.js` (GET /) and `lib/data.js` (fetchSameWayClusters)

### 3. Supabase client separation — DONE
- `lib/supabase.js` exports three clients:
  - `readClient` — uses `SUPABASE_READ_KEY` (falls back to `SUPABASE_KEY`), for public queries
  - `writeClient` — uses `SUPABASE_KEY`, for bot/admin write operations
  - `authClient` — separate client for auth operations (prevents session poisoning)
- Public routes (GET /, /faq) use `readClient`
- Write operations (POST /submit, POST /digest/mark, POST /log-click) use `writeClient`

### 4. Add CSRF protection to /submit form — DEFERRED
- Deprioritized per user. Form is low-traffic. Can be added in a future sprint.

## Version
v3.6.0

## Verification checklist
- [x] Route files exist in routes/ directory (5 files)
- [x] Middleware files exist in middleware/ directory (2 files)
- [x] dashboard.js is under 100 lines (36 lines)
- [x] Date-filter logic is in a shared function (`lib/dateFilter.js`)
- [x] Public routes use read-only Supabase client
- [x] `npm test` still passes (51 tests, 0 failures)
- [ ] Dashboard starts and serves public board at / (verify on deploy)
- [ ] Admin digest at /digest still works with cookie auth (verify on deploy)
- [ ] /submit form works end-to-end (verify on deploy)

## File map (new)
```
dashboard.js          — 36 lines, wires middleware + routes + listen
lib/
  supabase.js         — read/write/auth Supabase clients
  helpers.js          — escHtml, formatting, redaction, clusters, message generators
  dateFilter.js       — filterActiveRequests(), buildTestGroupSet()
  views.js            — HTML renderers (login, verify, static, match card, cluster card, date table)
  data.js             — fetchOpenMatches, markNotified, fetchSameWayClusters
middleware/
  auth.js             — optionalAuth, digestAuth, cookie helpers
  rateLimiter.js      — submitLimiter (10/15min)
routes/
  public.js           — GET / (main board)
  auth.js             — login, verify, logout, log-click
  submit.js           — POST /submit
  digest.js           — digest login/logout, GET /digest, POST /digest/mark
  static.js           — GET /terms, GET /faq
```
