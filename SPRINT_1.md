# Sprint 1 — Ship what's ready + quick security wins

**Status:** COMPLETE (deployed 2026-03-21)

## Goal
Commit the pending matcher fix and close the two easiest security gaps.

## Tasks
- [x] Commit matcher/normalize local-errand fix → `656e916`
- [x] Add rate limiting to `/submit` (10 per 15min per IP) → `a0f75f3`
- [x] Move digest auth from `?key=` query string to httpOnly cookie → `d5d3801`
- [x] Update DEV_NOTES.md → `5353f70`

## Version
v3.3.0 (tagged at first commit; remaining commits are incremental on same sprint)

## Verification (all passed)
- Rate limiter: 11th request returns 429 with JSON error
- Digest: `/digest` without cookie → redirects to `/digest/login`
- Digest: correct key → sets httpOnly cookie, redirects to `/digest`
- Digest: POST `/digest/mark` without cookie → 401 JSON
- Digest: `/digest/logout` → clears cookie
- Matcher: unknown locations score 0, nearby pairs score 0.9, same dest scores 1.0
