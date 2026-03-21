# Sprint 2 — Reliability

**Status:** NOT STARTED

## Goal
Stop losing data silently — retry failed LLM calls and surface DB errors in PM2 logs.

## Prior sprint
Sprint 1 (complete): matcher local-errand fix, rate limiting on `/submit`, digest cookie auth. See `SPRINT_1.md`.

## Tasks

### 1. Add retry on LLM failures
- **File:** `parser.js`
- **What:** Wrap the `openai.chat.completions.create()` call with one retry after ~2s delay on failure.
- **Why:** If OpenRouter drops a call, the message is silently lost. No retry, no log — the ride request just disappears.
- **Done when:**
  - Temporarily break the OpenRouter key → confirm retry fires and logs both attempts
  - Restore key → confirm normal flow still works (no double-processing)

### 2. Surface DB errors
- **File:** `db.js`
- **What:** All DB functions catch errors and return `null` silently. Add structured `console.error()` with context: which function, which message/group/contact, and the error message. Do NOT change return values (callers expect `null` on failure).
- **Why:** When a save fails in prod, PM2 logs show nothing. Debugging requires guessing.
- **Done when:**
  - Force a DB error (e.g. bad table name) → confirm it appears in logs with enough context to identify the failing operation
  - Revert the break → confirm normal flow has no extra noise

### 3. Log duplicate suppressions
- **File:** `db.js`
- **What:** When `findExistingRequest()` finds a hash match and the message is dropped, log it: sender, destination, date, and the existing request ID. This is cheap instrumentation that lets us measure whether dedup is too aggressive (Sprint 5 follow-up).
- **Why:** We suspect dedup drops legitimate updates (e.g. "ride to Houston Friday" then "ride to Houston Friday morning, 2 seats" — same hash, second dropped). We need data before building a fix.
- **Done when:**
  - A duplicate message logs: `[DB] Duplicate suppressed: {sender} → {dest} on {date} (existing request {id})`
  - Non-duplicate messages produce no extra log output

## Version
Target: v3.4.0

## Verification checklist
- [ ] LLM retry: bad key → two attempts logged, then failure
- [ ] LLM retry: good key → single call, no double-processing
- [ ] DB errors: forced failure → structured log line with function name + context
- [ ] DB errors: normal operation → no new log noise
- [ ] Dedup logging: duplicate message → structured log with sender, dest, date, existing ID
- [ ] Dedup logging: new message → no extra noise
- [ ] Smoke test: `node -e "require('./parser')"` and `node -e "require('./db')"` load without errors
