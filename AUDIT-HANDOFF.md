# RideSplit audit: start here

Prepared October 6, 2026. This file is the durable entry point for a fresh agent.

**Continuation update — October 8, 2026:** User authorized fixing/testing RS-01 and RS-19. Legacy phone-cookie authentication and cookie-derived profile linking are now removed locally; email/profile-backed verification remains. All 65 tests pass (14 new auth regressions). No deployment or production changes. See ranked finding continuation notes and STATUS_v3.8.md. Historical investigation-only constraints below describe the original audit; local auth fixes were subsequently authorized.

## User intent and current authorization

The user feared something had happened to the project, supplied Claude Code conversations, and requested a code audit and observations. They then explicitly requested an independent subagent investigation of intermittent website slowness. Finally they requested ranked Markdown findings with enough detail to preserve context after clearing the chat.

**This work has been investigation and documentation only. No fixes or production deployments have been authorized by the final documentation request.** Do not mistake suggested remediations for completed work. The user allowed subagents; three reviewed code and a fourth later investigated latency independently. No agents are currently implementing fixes.

## Reading order

1. Read repository `CLAUDE.md` and `STATUS_v3.8.md` for operational constraints and historical product intent.
2. Read [AUDIT-RANKED-2026-10-06.md](AUDIT-RANKED-2026-10-06.md), the canonical prioritized backlog with evidence, limitations, proposed fixes, and acceptance checks.
3. Read [AUDIT-LATENCY-2026-10-06.md](AUDIT-LATENCY-2026-10-06.md) before investigating slowness. It preserves the independent investigation and corrects an earlier invalid log inference.
4. [AUDIT-2026-10-06.md](AUDIT-2026-10-06.md) is the original audit snapshot. Its statement that this audit did not connect to the VPS refers to the initial code audit. A subsequent independent subagent DID perform read-only server diagnostics; the latency document is authoritative for that follow-up.

## Workspace and source material

- Repository: `/Users/gauravarora/Documents/aggieconnectbaileysv3`.
- Live website: `https://ridesplit.app`.
- Audited commit: `f83c504` (`feat(dash): Poparide ad slot + honest two-step signup copy + ad-click logging`, August 14, 2026).
- At audit start tracked working tree was clean; `sample.txt` was already untracked. Do not delete or overwrite it.
- Claude raw chat backups: `/Users/gauravarora/Desktop/backup/ee6ddd63-e3f7-44e9-a6ff-023b379d9b37.jsonl` (long conversation) and `/Users/gauravarora/Desktop/backup/ba26830a-71e7-43de-87af-9e79f26b8843.jsonl` (short initial conversation).
- Additional memory notes: `/Users/gauravarora/Desktop/backup/memory/`. These are context, not proof of current production state.
- Earlier Claude mentioned `/Users/gauravarora/Downloads/ridesplit.app.txt` as DNS context. It was not required for this audit; do not reproduce credentials or private data from related files.
- Existing SSH alias: `agconnect`. Conversation says production checkout is `~/aggieconnect-v3`. Independent investigator successfully performed read-only server diagnostics. Reconfirm locations before future work.

## Architecture needed to orient quickly

WhatsApp/Baileys → `bot.js` → OpenRouter `parser.js` → `db.js`/Supabase → `matcher.js`; housing storage uses `lib/housing.js`. Dashboard is Express 5 (`dashboard.js`) mounting `routes/`; HTML/browser code is mostly `lib/views.js` and `routes/clusters.js`. `middleware/auth.js` implements email and legacy HMAC phone sessions. Kapso verification uses `routes/verify.js`, `lib/wa-verify.js`, and `lib/profiles.js`.

Configured PM2 processes: `aggie-v3-bot`, `aggie-v3-dash` (3004, one instance), `aggie-v3-monitor` (3005). Outbound worker is paused unless `OUTBOUND_ENABLED=1`. Match alerts enqueue admin messages through this worker. Do not enable it simply to test a fix: pending rows can exist.

## Findings that must not be forgotten

- No evidence of recent local code corruption, but substantial privacy, identity, ingestion, and correctness defects were found.
- Existing tests all pass yet do not cover most defects: parser/matcher only, 51 tests.
- Severe historical latency was real in raw curl outputs, but exact cause remains unknown. Cloudflare path is the leading suspect, not a proven root cause.
- IPv6/AAAA was an abandoned hypothesis. Do not repeat it as fact.
- Access-log timestamps were completion timestamps, not request-arrival evidence. The earlier claim that they located the delay before nginx was invalid.
- Local `WA_OTP_SECRET` was missing; local `KAPSO_VERIFY_SECRET` was set. Values were never printed. Production effective secret values/presence were NOT established by this audit.
- The backup reports an eight-day WhatsApp disconnection followed by restart October 6 at 6:04 PM CDT (UTC-5), and two dashboard workers. Treat those historical observations separately from current production verification.

## Verification already completed

Dependencies were installed outside the repository at `/tmp/ridesplit-audit-deps` using `npm ci --ignore-scripts --no-audit --no-fund`. An initial sandboxed install stalled; a subsequent approved unrestricted install succeeded. No package/lock changes were made.

Passing command:

```sh
NODE_PATH=/tmp/ridesplit-audit-deps/node_modules SUPABASE_URL=http://127.0.0.1:9 SUPABASE_KEY=audit-placeholder node --test *.test.js
```

Result: **51 passed, 0 failed**. Dummy environment prevents reliance on production Supabase credentials. `/tmp` is ephemeral; reinstall in an isolated temp directory if absent. A bare `npm test` initially failed from missing modules, and after modules were available matcher import required Supabase URL/key configuration. Neither failure proved an application regression.

Actual generated housing scripts were exercised in isolated VMs; synthetic renders reproduced contact leakage and date shifts. Actual matcher functions reproduced incompatible trips marked strong. Phone-cookie parser reproduced a RangeError with mocked imports. Public rides/housing inline scripts compiled; rides filter ran without error. Ego-browser task space 1 was finished with no retained agent pages.

No live login, verification webhook, submission, database mutation, outbound message, process restart, auth deletion, or production config edit was performed by this audit. The restart in the saved Claude conversation predates this work.

## Safe continuation and implementation guidance

- Recheck `git status`, current HEAD, applicable `AGENTS.md`, and line numbers; this is a snapshot.
- Repository instructions forbid editing `bot.js` without explicit authorization and deleting `.v3_auth`. An audit finding notes that existing code itself deletes auth on logout; reporting it is not permission to delete it.
- Local file permissions allow repository and temporary writes; production edits and GUI/shell operations may require tool approvals. Existing SSH capability does not imply authorization for production mutation.
- Never dump `.env`, PM2 environment, full message logs, private user rows, cookies, or SSH configuration. Print presence/absence or sanitized summaries only.
- Use synthetic accounts/listings, mocked transports, and dummy environment for regression checks. Avoid real WhatsApp messages and replaying eight days of history without inspecting idempotency/date behavior.
- Test rendered inline JavaScript, not just outer Node syntax. CLAUDE.md warns about escaping JS inside server strings.
- Do not run a blanket production ecosystem restart as an audit check. Duplicate workers and queued messages require deliberate rollout planning.
- Fixes involving matching semantics or availability should establish the desired product rules before changing them; several existing tests encode questionable behavior.
- Update this backlog with implementation status, validation, commits, and unresolved production checks after subsequent work. Do not mark a finding fixed merely because a test passes or local code changes.

## Suggested skills for future tasks

Use `diagnosing-bugs` for sustained latency/reconnect diagnosis; `ego-browser` for browser inspection; `tdd` if the user requests test-first fixes; `implement` for an agreed implementation spec; and `code-review` for a review against an explicit fixed point. Read the relevant SKILL.md before applying it. These are suggestions, not claims that all were invoked in this audit.
