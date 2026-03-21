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

## Version
Target: v3.4.0

## Verification checklist
- [ ] LLM retry: bad key → two attempts logged, then failure
- [ ] LLM retry: good key → single call, no double-processing
- [ ] DB errors: forced failure → structured log line with function name + context
- [ ] DB errors: normal operation → no new log noise
- [ ] Smoke test: `node -e "require('./parser')"` and `node -e "require('./db')"` load without errors
