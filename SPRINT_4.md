# Sprint 4 — Architecture

**Status:** READY

## Goal
Split the monolithic dashboard.js into smaller modules and add remaining security hardening.

## Prior sprint
Sprint 3 (complete): Test infrastructure (51 tests), time proximity scoring, configurable match threshold. See `SPRINT_3.md`.

## Tasks

### 1. Split dashboard.js into routes/views/middleware
- **File:** `dashboard.js` (read), new `routes/`, `views/`, `middleware/` dirs
- **What:** Extract route handlers, view rendering, and middleware (auth, rate limit) into separate files. dashboard.js becomes a thin Express app that wires them together.
- **Why:** dashboard.js is ~1800 lines. Harder to review, harder to test individual pieces.
- **Done when:**
  - Route handlers live in `routes/`
  - Auth/rate-limit middleware live in `middleware/`
  - `dashboard.js` is under 100 lines (setup + imports + listen)
  - Dashboard still works: public board, digest, submit form

### 2. Extract duplicated date-filter query
- **What:** The date-filter logic (filtering requests by date range) appears in multiple route handlers. Extract to a shared function.
- **Why:** DRY — changes to date logic should happen in one place.
- **Done when:**
  - Shared date-filter function exists
  - All routes use it instead of inline date logic

### 3. Supabase client separation
- **What:** Create a read-only Supabase client for public dashboard queries. Keep the write client for bot/admin operations.
- **Why:** Defense-in-depth. Public endpoints should not have write access to the database.
- **Done when:**
  - Public dashboard routes use a read-only client
  - Bot and admin routes still use the write client
  - Both clients configured via env vars

### 4. Add CSRF protection to /submit form
- **What:** Add double-submit cookie CSRF protection to the /submit POST endpoint.
- **Why:** The submit form creates ride requests — CSRF could inject fake requests.
- **Done when:**
  - /submit POST rejects requests without valid CSRF token
  - /submit GET form includes the CSRF token
  - Existing form functionality still works

## Version
Target: v3.6.0

## Verification checklist
- [ ] Dashboard starts and serves public board at /
- [ ] Admin digest at /digest still works with cookie auth
- [ ] /submit form works end-to-end (GET form → POST submission)
- [ ] /submit POST without CSRF token is rejected
- [ ] Route files exist in routes/ directory
- [ ] Middleware files exist in middleware/ directory
- [ ] dashboard.js is under 100 lines
- [ ] Date-filter logic is in a shared function
- [ ] Public routes use read-only Supabase client
- [ ] `npm test` still passes (no regressions)
