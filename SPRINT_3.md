# Sprint 3 — Testing + Match Quality

**Status:** COMPLETE

## Goal
Add first test infrastructure and improve match scoring with time proximity.

## Prior sprint
Sprint 2 (complete): LLM retry, structured DB error logging, dedup suppression logging. See `SPRINT_2.md`.

## Tasks

### 1. Set up test infrastructure
- **What:** Add a test runner (node:test or jest) and create the first test file for matcher.
- **Why:** Zero tests right now. matcher.js is pure functions — easiest place to start.
- **Done when:**
  - `npm test` runs and passes
  - At least one test file exists

### 2. Matcher unit tests
- **File:** `matcher.js` (read-only), new test file
- **What:** Test `computeMatchQuality()` and score calculation. Cover: known location gate, nearby pairs from normalize.js, strong/medium/low thresholds, edge cases (same origin/dest, missing fields).
- **Why:** Matching is the core product logic. Changes to scoring need a safety net.
- **Done when:**
  - Tests cover: strong match, medium match, low match, no match
  - Tests cover: nearby location pairs (e.g. Bryan↔College Station)
  - Tests cover: missing/null fields don't crash

### 3. Parser contract tests
- **File:** `parser.js` (read-only), new test file
- **What:** Mock the LLM response (don't call OpenRouter). Verify field extraction: type, category, origin, destination, date, time, seats. Test error recovery: malformed JSON, empty response, timeout.
- **Why:** Parser output shape is a contract — if fields change or disappear, downstream breaks silently.
- **Done when:**
  - Tests verify all expected fields from a mocked LLM response
  - Tests verify graceful handling of bad/empty LLM responses

### 4. Add time proximity to match score
- **File:** `matcher.js`
- **What:** If both need and offer have `ride_plan_time`, factor time proximity into the match score. Same time = full bonus, within 2 hours = partial, beyond = no bonus. Don't break existing scoring — this is additive.
- **Why:** Currently a 6am offer matches an 11pm need equally. Time matters for rides.
- **Done when:**
  - Matching a need at 10:00 with an offer at 10:30 scores higher than one at 18:00
  - Existing matches without times are unaffected
  - New unit test covers the time scoring

### 5. Configurable score threshold
- **File:** `matcher.js`
- **What:** Read `MATCH_THRESHOLD` from env var, default to current hardcoded value. Use it in match filtering.
- **Why:** Lets us tune matching sensitivity without code changes.
- **Done when:**
  - Setting `MATCH_THRESHOLD=0.3` lowers the bar for matches
  - Unsetting it uses the current default
  - Unit test covers threshold behavior

## Version
Target: v3.5.0

## Verification checklist
- [x] `npm test` runs and all tests pass (51 tests, 0 failures)
- [x] Matcher tests: strong, medium, low, no match scenarios
- [x] Matcher tests: nearby locations, missing fields
- [x] Parser tests: field extraction from mocked response
- [x] Parser tests: malformed/empty response handling
- [x] Time proximity: same-time scores higher than far-apart times
- [x] Time proximity: requests without times unaffected
- [x] Score threshold: env var overrides default
- [x] Smoke test: `node -e "require('./matcher')"` and `node -e "require('./parser')"` load without errors
