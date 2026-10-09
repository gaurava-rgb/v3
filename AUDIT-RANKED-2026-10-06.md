# RideSplit ranked findings and implementation backlog

Prepared October 6, 2026 against local HEAD `f83c504`. **RS-01 and RS-19 deployed in `2ea18ee` October 8, 2026; live smoke checks passed. Other findings remain open.** Read [AUDIT-HANDOFF.md](AUDIT-HANDOFF.md) first for context, authorization, source files, tests, and operational constraints. Read [AUDIT-LATENCY-2026-10-06.md](AUDIT-LATENCY-2026-10-06.md) for the independently investigated website slowness.

## How to use this ranking

Ranks reflect recommended investigation/remediation order, considering access-control impact, unintended collection, outage/data loss, user harm, and confidence. A conditional high-impact risk ranks early so its production applicability can be checked quickly; this does not mean it is a confirmed live exploit. Latency instrumentation can run alongside high-priority fixes once authorized.

Priority definitions: **P1** = high impact, address promptly; **P2** = important correctness/reliability or unresolved incident; **P3** = lower-impact product/maintenance work. No P0 active compromise or total outage was established.

Evidence labels: **Confirmed code** = directly present in the audited code; **Reproduced** = exercised safely with synthetic data/mocks/VM or observed read-only; **Conditional production** = impact depends on settings/network exposure not established; **Historical report** = saved chat says it happened; **Needs policy** = code behavior clear but desired product semantics need agreement.

| Rank / ID | Priority | Finding | Evidence / production certainty |
|---|---|---|---|
| 1 / RS-01 | P1 | Known fallback phone-session signing secret | Confirmed code; missing locally; VPS unknown |
| 2 / RS-02 | P1 | Housing original text bypasses contact gate | Reproduced synthetic anonymous render |
| 3 / RS-03 | P1 | Submission ownership trusts browser phone | Confirmed code; no live attack attempted |
| 4 / RS-04 | P1 | Group-load failure permits all groups | Confirmed code; outage path not live-tested |
| 5 / RS-05 | P1 | Disconnected bot can remain online but inactive | Confirmed gap; historical outage consistent |
| 6 / RS-06 | P1 | Failed ingestion is treated as processed | Confirmed code; real lost rows not counted |
| 7 / RS-07 | P1 if applicable | Missing webhook secret disables auth | Conditional production; secret set locally |
| 8 / RS-08 | P1 if exposed | Unauthenticated monitor exposes logs | Conditional network exposure |
| 9 / RS-09 | P2 | Edit/delete writes ignore DB errors | Confirmed code |
| 10 / RS-10 | P2 | Intermittent 12–16s website latency | Historical raw timings verified; cause unresolved |
| 11 / RS-11 | P2 | Effective dashboard worker count may drift | Historical two workers vs one configured |
| 12 / RS-12 | P2 | Recovered relative dates use current day | Confirmed code |
| 13 / RS-13 | P2 | Incompatible trips can be strong matches | Reproduced actual matcher functions; needs policy |
| 14 / RS-14 | P2 | Edit rematching bypasses score/quality | Confirmed code |
| 15 / RS-15 | P2 | Suggested matches consume availability | Confirmed code; needs policy |
| 16 / RS-16 | P2 | Additional dates/return legs miss matching | Confirmed code |
| 17 / RS-17 | P2 | Verification succeeds before profile link | Confirmed ordering/error behavior |
| 18 / RS-18 | P2 | Secondary verified phones fail ownership | Confirmed code |
| 19 / RS-19 | P2 | Malformed phone cookie throws 500 | Reproduced isolated parser |
| 20 / RS-20 | P2 | Proxy IP may make rate limits global | Conditional proxy configuration |
| 21 / RS-21 | P2 | UTC date blocks current evening rides | Confirmed date behavior |
| 22 / RS-22 | P2 | Housing calendar dates shift backward | Reproduced synthetic board/detail |
| 23 / RS-23 | P2 | Housing filters undo other selections | Reproduced actual generated browser JS |
| 24 / RS-24 | P2 | Logout handler deletes WhatsApp auth | Confirmed code; not incident trigger established |
| 25 / RS-25 | P3 | Housing may never expire automatically | No app job found; DB automation unknown |
| 26 / RS-26 | P3 | Public demo parameter fakes badges | Confirmed code; intentionally documented |
| 27 / RS-27 | P3 | Housing cards lack keyboard expansion | Confirmed inspected rendering/script |
| 28 / RS-28 | P3 | Listing detail lacks WA message action | Reviewer observation; product polish |
| 29 / RS-29 | Cross-cutting | Tests miss routes/auth/rendering/ops | Confirmed coverage inventory |

## P1: identity, privacy, and ingestion

### RS-01 — Phone sessions use a known fallback secret

**Continuation status — October 8, 2026: deployed, live smoke checks passed.** Removed legacy phone-cookie signing, parsing, T2 authentication, and cookie-derived email/profile linking in `middleware/auth.js` and `routes/auth.js`. Legacy cookies are cleared; email/profile-backed WhatsApp verification remains. `auth.test.js` adds 14 isolated regression checks; full suite: 65 passed, zero failed. Deployed implementation commit `2ea18ee` via dashboard-only reload. All 14 auth tests passed on VPS. Verified Oct 8, 3:28 PM CDT (UTC-5): both workers online; origin/public malformed-cookie request returns tier 0 and clears cookie; home/housing/login HTTP 200. No live email OTP/account mutation performed. Legacy phone-only users must sign in by email after rollout. Production secret state and prior identity misuse remain unknown; no existing profile links were modified. Rollback to the prior auth code would restore the defects and is not a safe default.


**Evidence:** `middleware/auth.js:13` defaults WA_OTP_SECRET to `change-me-in-production`. `signPhoneSession` at `25–31` signs a payload; `optionalAuth` at `78–84` accepts valid signed cookies as phone-auth tier 2. Local .env inspection checked presence only and found this variable absent/empty. This audit did not establish the effective VPS environment.

**Impact:** if fallback is used live, someone knowing the source literal can create a session claiming a phone and bypass WA possession checks. This can affect contact access and ride ownership, not just one disabled legacy login screen: the cookie parser remains active.

**Next step:** inspect effective production presence without printing the value. Check all process/env sources, not only a checked-in example. Fail closed or disable legacy phone sessions when a configured strong secret is absent. Do not silently keep a default. If fallback was used, rotate to a new random secret and invalidate existing phone sessions; communicate expected reauthentication if necessary.

**Acceptance:** missing/empty/default secret never grants T2; wrong signatures rejected; correctly configured sessions work; secret never appears in logs/tests/artifacts. Coordinate valid-cookie tests with RS-19. No forged cookie was sent to the live website.

### RS-02 — Anonymous housing HTML includes original contact text

**Evidence:** `lib/views.js:907–909` creates snippetHtml from full message_text for every tier, and `985` inserts it unconditionally. ContactHtml is separately gated at `912` onward. A synthetic tier-0 listing containing a fictional phone in message_text rendered that phone while showing the sign-in contact gate.

**Impact:** names, phone numbers, and contact instructions embedded in original WhatsApp messages can be read without verification. HTML escaping protects against markup injection, not disclosure. Collapsing/blurred CSS alone cannot protect text already delivered to the browser.

**Fix direction:** preserve instructed housing-message behavior for authorized viewers; for T0/T1 choose server-side removal or robust redaction of sensitive message content. Inspect board and detail rendering and any structured data/attributes for equivalent disclosure. Do not change the product gate implicitly: agree on whether T1 can see noncontact message text.

**Acceptance:** synthetic names/phones/contact instructions absent from unauthorized HTML, not merely hidden; T2 retains intended details; no regression in escaping or inline scripts. Use fictional data, not real student messages.

### RS-03 — Ride submission identity is supplied by the browser

**Evidence:** `routes/submit.js:13–19` requires T2, but `26` reads body.phone and `56–57,82` stores its normalized value as sourceContact. No comparison to req.user.phone. Readonly frontend phone fields can be changed in a crafted request.

**Impact:** a verified user can attribute posts to another phone. Their submission may appear as another person's post or be uneditable by the submitter. The identity flaw persists even if RS-01 is fixed.

**Fix direction:** derive sourceContact from the authenticated verified identity; if several verified phones are supported, validate a selection against a server-fetched allowlist. Decide separately whether alternate contact information is allowed, and do not confuse it with listing ownership.

**Acceptance:** body.phone cannot change ownership; a selected verified secondary phone works only if authorized; unauthorized requests rejected; own posts remain editable. Test the route with mocked DB, never impersonate a real number in production.

### RS-04 — Empty monitored-group set fails open

**Evidence:** `db.js:43–53` returns [] on monitored-group fetch error. `bot.js:59–63` clears the stored set. Live/history predicates at `187,504` restrict groups only when set size is positive.

**Trigger:** DB query failure after a valid list, first startup while DB unavailable, or deliberately deactivating all groups.

**Impact:** messages from every joined group may be processed rather than none. This combines privacy scope expansion, unexpected API spend, and unwanted listings. The audit did not count actual unintended collection.

**Fix direction:** represent fetch error separately from valid empty configuration. Retain last known good list on refresh failure; first startup without a valid list should ingest nothing. A valid empty list must mean no groups. Apply consistently to live/history buffers.

**Acceptance:** DB error never expands scope; deactivating all groups ingests nothing; successful reconfiguration applies; recovery/history uses the same allowlist. Requires explicit authorization to modify bot.js.

### RS-05 — Watchdog cannot recover a stuck disconnected bot

**Evidence:** close handler sets isReady=false (`bot.js:417–419`). Watchdog starts `if (!isReady) return` (`591–597`). Reconnect schedules async connect without a surrounding recovery/deadline (`436–440`); connect awaits auth/version discovery before making a socket (`329–340`). Global unhandled-rejection handling only logs (`614`). There are five reconnect attempts in normal close-event flow, but those do not bound a connect call that hangs/rejects without another close event.

**Historical context:** backup says bot last saved a message September 28, 1:06 PM CDT (UTC-5), disconnected at 1:46 PM CDT (UTC-5), and remained PM2-online until restart October 6 at 6:04 PM CDT (UTC-5). Those exact incident claims were reported by Claude, not independently reconstructed in this audit. They are consistent with the gap, not proof of its precise trigger.

**Fix direction:** health state should include disconnected duration, reconnect progress/deadline, and successful activity. Wrap connect failures and arrange bounded retries or controlled PM2 exit. Distinguish a quiet group from disconnected transport. A stale-message warning can supplement, not replace, transport health. Do not introduce automatic outbound alerts through the paused queue without choosing an authorized delivery mechanism.

**Acceptance:** mocked rejected/hung version fetch or reconnect causes recovery/controlled exit within a defined bound; successful reconnect clears unhealthy state; quiet connected periods avoid false restarts; overlapping socket/reconnect attempts avoided. Explicit bot.js edit authorization required.

### RS-06 — Failed message processing becomes permanently deduplicated

**Evidence:** bot adds msgId to processedMessages before parsing/saving (`104`); parse result is logged before listing persistence (`118` onward); parser returns isRequest:false on terminal parse failure (`parser.js:302–304`). `messageAlreadyProcessed` checks only existence in v3_message_log (`db.js:177–189`), and history uses that check (`bot.js:195`).

**Impact:** parser/API/DB failure can leave no listing and still block replay/recovery. A successful message-log insert followed by failed save is especially problematic. Memory dedup can also suppress immediate retry until process state changes. Actual lost listings are not enumerated.

**Fix direction:** distinguish attempted, parsed-not-request, retryable-error, and persisted processing outcomes. Mark successfully processed only after required writes. Add bounded retry and idempotency for fan-out/return legs; duplicates must not send duplicate alerts. Avoid replaying historical logs until RS-12 and matching semantics are considered.

**Acceptance:** parser/storage transient failures can recover; confirmed casual messages need not retry forever; duplicate deliveries do not duplicate rows/alerts; partially successful fan-out recovers safely. Requires schema/migration review and explicit bot.js authorization.

### RS-07 — Missing verification webhook secret skips authentication

**Evidence:** `routes/verify.js:63–70` checks bearer auth only if KAPSO_VERIFY_SECRET is nonempty, otherwise warns and proceeds. Local secret is set; production applicability unknown.

**Impact if absent live:** a signed-in user can obtain their own verify token and submit a claimed phone through the webhook without possessing that phone, then reach T2. This is distinct from guessing random tokens.

**Fix direction:** make secret mandatory in environments serving this endpoint, or reject webhook requests when absent. Preserve Kapso's legitimate integration. Test bearer validation and missing config with mocked storage.

**Acceptance:** missing config fails closed; unauthenticated/wrong bearer cannot mutate tokens; correct integration works. No unauthenticated verification attempt was sent live.

### RS-08 — Monitor has no authentication and listens externally

**Evidence:** `monitor.js:275` serves report without auth; `316` binds 0.0.0.0:3005. Report includes recent snippets/group names/process logs around `195–263`.

**Unknown:** firewall, private reverse proxy, and actual external reachability of port 3005 were not established by this code review. A missing MONITOR_KEY locally is not the mechanism; monitor does not implement a key check.

**Fix direction:** verify firewall/bind/proxy policy read-only, then use private binding/access control consistent with operational access. Avoid removing monitoring visibility needed to diagnose RS-05.

**Acceptance:** unauthenticated public access cannot read reports; authorized ops access works; secrets/message contents not copied into audit outputs.

## P2: incident investigation and data correctness

### RS-09 — Edit/delete mutations ignore Supabase errors

**Evidence:** `db.js:592` updates, `604` writes changelog, `614` deletes matches, and `651–665` handles soft delete without checking returned error. Supabase/PostgREST errors typically resolve as `{error}`, so route try/catch does not catch these failures automatically.

**Impact:** redirects imply success despite failed mutations; partial edit can delete matches; changelog may not reflect state. Failed side effects can leave confusing recovery states.

**Fix direction:** check every read/write outcome, enforce consistent failures, and prefer transactional server-side operations for related row/changelog/match work. Confirm schema and constraints before designing RPCs. Coordinate with RS-14/15 rather than layering a new rematch on inconsistent status.

**Acceptance:** injected failed update/delete/changelog produces appropriate failure and no false success; no destructive follow-up after unsuccessful core mutation; rollback/partial-failure behavior specified.

### RS-10 — Website sometimes waits 12–16 seconds

**Evidence and unknowns:** [latency report](AUDIT-LATENCY-2026-10-06.md) contains the full evidence ledger. Historical severe TTFB is verified. Independent 21 public samples were fast. Cloudflare path is leading suspect; exact mechanism unresolved. Nginx access completion timestamps did not prove pre-origin delay.

**Next action:** approved scoped nginx timing log + correlated CF-Ray/client timings, then capture one severe request. No speculative DNS/Cloudflare/cache changes. Investigate normal housing latency separately from rare severe stalls.

**Acceptance:** a slow request is assigned to a measured layer; cause/fix supported by before/after evidence, not only a fast batch. Config mutation was not authorized/performed by documentation work.

### RS-11 — Dashboard topology may not match configured single instance

**Evidence:** ecosystem.config.js specifies one dashboard instance; saved Claude conversation reports two running, explaining that pm2 restart did not remove old cluster topology. Fresh effective topology must be checked. This is not proven to cause latency.

**Impact:** housing per-process caches can differ; rate-limit counters are also per-process unless backed by shared storage. Reconciliation can interrupt web requests if done carelessly.

**Fix direction:** inspect sanitized PM2 process names/count/mode/path/env, choose desired topology, and reconcile explicitly. Recheck saved PM2 startup/resurrection state. Do not delete unrelated apps or restart bot to fix dashboard.

**Acceptance:** effective and saved topology agree; intended cache/rate-limit behavior consistent; minimal web-only rollout verified.

### RS-12 — Historical “today/tomorrow” uses processing day

**Evidence:** `bot.js:116` computes sentAt but `118` passes only body/senderName. `parser.js:196` accepts receivedAt as third parameter and defaults to new Date.

**Impact:** recovery/replay can create misleading dates and matches, especially after a long disconnection. syncFullHistory=false (`bot.js:338`) also means no guarantee that missed messages will be recoverable.

**Fix direction:** pass original valid sent timestamp, define fallback for absent/invalid timestamps, and use consistent Central date interpretation. Do not blindly backfill based on new reconnect date.

**Acceptance:** synthetic historical “tomorrow” anchored to original Central date, not run date; missing timestamp deterministic; dates correct near midnight/DST. No real historical reprocessing performed.

### RS-13 — Strong match can mean certainty rather than compatibility

**Reproduction:** actual functions in matcher.js, with DB import stub only: same-date need College Station→Houston at 08:00 and offer Austin→Houston at 20:00 yields score 0.8, quality strong. Default threshold 0.5. Origin mismatch receives no penalty (`110–112`); >2h time mismatch only multiplies by 0.8 (`125`); strong depends on dates/times being nonfuzzy (`40`).

**Impact:** impossible/impractical travel pairs can be promoted as strong; alerts may amplify them. This finding tests scoring functions, not every database candidate query or production threshold.

**Fix direction:** establish route/time compatibility policy and quality meaning. Known mismatched origins and incompatible precise times likely deserve rejection or low quality; fuzzy data needs different rules. Inspect existing tests that intentionally assert current behavior before replacing semantics.

**Acceptance:** compatible concrete trips strong; clearly incompatible routes/times not strong or eligible; uncertain data represented honestly; configurable threshold cannot unintentionally restore impossible matches.

### RS-14 — Edited requests bypass normal rematch scoring

**Evidence:** `db.js:627–632` uses findMatches then saveMatch directly; defaults are score 1.0 and quality medium (`440`). This skips matcher scoring/threshold/quality logic used on ingestion.

**Impact:** changing a ride creates matches under different rules than posting it, including candidates normal scoring would reject.

**Fix direction:** route all match creation through one compatible pipeline, with consistent edit/status handling. Coordinate RS-09,13,15 and avoid recursive database/matcher imports.

**Acceptance:** identical data produces same score/quality/eligibility whether created or edited; failed edits don't rematch; stale matches removed/replaced consistently.

### RS-15 — Suggested match changes both listings to matched

**Evidence:** saveMatch updates both statuses to matched (`db.js:466–469`), while findMatches queries request_status=open (`410`). No rider/driver confirmation is required in this path.

**Impact:** one inferred pairing removes availability from future incoming candidates, potentially preventing multiple riders from finding an offer. Note that one processRequest may already have gathered several candidates; the concern is subsequent matching.

**Needs policy:** does matched mean algorithm found a suggestion, accepted contact, confirmed ride, or filled seats? Clarify capacities and lifecycle before changing schema/statuses.

**Acceptance:** suggestions don't accidentally consume still-available seats; confirmed fulfillment excludes appropriately; multiple riders and deletion/edit reopening behavior defined; dedup of match rows preserved.

### RS-16 — Multi-date and return-trip rows do not all match immediately

**Evidence:** saveRequest returns inserted[0] for fan-out (`db.js:283–285`) and outbound after saving return leg (`339–395`); bot processRequest only gets returned row (`160`).

**Impact:** existing counterparts for other dates/return leg aren't matched at creation, though another incoming post may later trigger a match.

**Fix direction:** expose all created rows or encapsulate matching across them, maintaining idempotency and alert behavior. Preserve callers' contracts or migrate all callers together.

**Acceptance:** counterparts on each date and reversed leg matched immediately; duplicate messages do not create duplicate rows/alerts; partial failure accounted for (RS-06).

### RS-17 — Verification completion and profile linking can disagree

**Evidence:** routes/verify.js marks token verified, then calls linkEmailToProfile non-blocking and returns ok. `lib/profiles.js:93–105` can return false on DB error rather than reject, so `.catch` does not report that failure. Polling checks token. Authentication tier checks linked profile. `lib/wa-verify.js` also reads token then updates unconditionally, without atomic verified=false/expiry constraint.

**Impact:** frontend says verified but account remains T1; concurrent token consumption can race.

**Fix direction:** atomically claim valid token and link profile consistently, or implement resumable completion with honest status. Decide duplicate webhook/retry behavior. A successful token claim must not make failed linking unrecoverable.

**Acceptance:** link failure doesn't falsely complete; retried webhook recovers safely; simultaneous verification doesn't overwrite with inconsistent identities; expiry enforced at mutation time; tier and UI agree.

### RS-18 — Ownership ignores secondary verified phones

**Evidence:** profile route collects all linked phones (`routes/profile.js:21–27`), but ownership expects req.user.phones (`routes/rides.js:39`), which optionalAuth never sets. getPhoneForEmail (`lib/profiles.js:124–132`) selects one row with limit(1), no order.

**Impact:** profile shows another linked phone's ride yet edit returns 403. Which phone appears as primary can vary.

**Fix direction:** load authorized phones once into trusted user context or ownership lookup. Preserve verified membership; a browser-provided phones array is unacceptable. Consider RS-03 selection.

**Acceptance:** all legitimately linked numbers' rides editable; unrelated numbers rejected; deterministic primary/contact display; reasonable DB-call count.

### RS-19 — Invalid signature length throws rather than rejects session

**Continuation status — October 8, 2026: deployed, live smoke checks passed.** Removed legacy phone-cookie signing, parsing, T2 authentication, and cookie-derived email/profile linking in `middleware/auth.js` and `routes/auth.js`. Legacy cookies are cleared; email/profile-backed WhatsApp verification remains. `auth.test.js` adds 14 isolated regression checks; full suite: 65 passed, zero failed. Deployed implementation commit `2ea18ee` via dashboard-only reload. All 14 auth tests passed on VPS. Verified Oct 8, 3:28 PM CDT (UTC-5): both workers online; origin/public malformed-cookie request returns tier 0 and clears cookie; home/housing/login HTTP 200. No live email OTP/account mutation performed. Legacy phone-only users must sign in by email after rollout. Production secret state and prior identity misuse remain unknown; no existing profile links were modified. Rollback to the prior auth code would restore the defects and is not a safe default.


**Reproduction:** parsePhoneSession('abc.x') in isolated VM throws `RangeError ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH`. `middleware/auth.js:42` calls timingSafeEqual outside its try without equal-length validation.

**Impact:** malformed/stale cookie can break that visitor's optionalAuth pages with 500. Not established as a server-wide process crash or the intermittent latency cause; Express 5 handles rejected route work.

**Fix direction:** validate signature encoding/length safely before constant-time compare, handle all parse errors, and clear invalid cookie without granting access.

**Acceptance:** malformed/truncated/empty/wrong-signature/expired tokens reject normally; valid token accepted; no exception; constant-time compare retained for comparable signatures.

### RS-20 — Proxy trust may aggregate visitors under one limiter IP

**Evidence:** dashboard.js config does not set trust proxy. express-rate-limit uses request IP; submit/name limits are memory based (`middleware/rateLimiter.js`). Actual forwarding/proxy configuration needs confirmation.

**Impact under standard nginx setup:** users share proxy IP, potentially making ten submissions/15 minutes a collective cap; duplicate workers can produce inconsistent caps.

**Fix direction:** inspect trusted proxy chain, then configure narrowly correct trust. Do not set trust proxy=true blindly: attacker-controlled forwarded headers must not evade limits. Consider distributed state only if topology requires it.

**Acceptance:** real users isolated, spoofed headers ineffective, auth/submit endpoints bounded as intended, multiworker behavior understood.

### RS-21 — UTC date validation blocks evening same-day rides

**Evidence:** routes/submit.js:49–50 derives today with toISOString; modal JS also uses UTC minimum date. UTC advances before Central midnight.

**Trigger:** from 7 PM CDT or 6 PM CST onward, local current-date rides appear past. Browser minimum can block before the server rejects.

**Fix direction:** shared Central calendar-date semantics for server/browser; distinguish date-only from timestamps. Check edit forms too.

**Acceptance:** current Central date allowed all evening, yesterday rejected, next day boundary correct in both DST seasons; rendered browser scripts compile.

### RS-22 — Housing date-only values display a day early

**Reproduction:** available_date='2026-10-06' renders Oct 5 on board/detail. `lib/views.js:876–877,1368–1371` parses YYYY-MM-DD as UTC midnight then formats Chicago.

**Fix direction:** treat availability/end values as calendar dates, not instants. Prefer component parsing/shared date-only formatter; don't globally change timestamp rendering or Central log rules.

**Acceptance:** date-only values render unchanged across timezones/DST; actual posted timestamps retain correct Central display; absent/invalid values handled.

### RS-23 — Housing filters overwrite one another

**Reproduction:** generated browser script in VM: set max price $600, then change type back to all; a $1,000 listing becomes visible while $600 remains selected. Type/city (`lib/views.js:1230–1248`) and price/beds (`1264–1274`) independently set card.style.display.

**Fix direction:** one filter state and one combined visibility predicate; all controls call it. Update counts/empty-state consistently and preserve tier control gating.

**Acceptance:** city+type+price+beds intersect regardless of selection order; resetting one dimension preserves others; no script syntax regression.

### RS-24 — Logout removes stored WhatsApp auth automatically

**Evidence:** bot.js:425–428 rmSync('.v3_auth') on loggedOut, contradicting repository instruction not to delete .v3_auth.

**Impact:** destroys local auth material and forces fresh pairing. It may be intentional cleanup for invalid auth, but policy and implementation conflict. Saved outage described plain disconnect, not logout, so this isn't established as its cause.

**Fix direction:** preserve/quarantine state for diagnostics and require deliberate recovery according to agreed policy. Ensure working directory/path is correct. Do not delete current auth to test this.

**Acceptance:** mocked logout follows explicit policy; no unintended real auth deletion; reconnect behavior distinguishes logged-out/connection-replaced/temporary disconnect. Explicit bot.js authorization needed.

## P3 and cross-cutting findings

### RS-25 — Housing expiry automation was not found in application

lib/housing.js:136 filters active=true, without excluding passed end_date. No expiry job found in application/scripts. Database jobs may independently manage active state, so first inspect schema/automation read-only. Specify whether listings with unknown end dates should expire or require confirmation. Verify expired known-date listings don't linger while current/unknown-date listings follow agreed rules.

### RS-26 — Public demo query marks every poster verified

routes/housing.js:45–50 adds all phones to verifiedSet for ?demo=1. This is intentionally documented behavior, but public users can see misleading badges. It does not itself prove contact gate bypass; RS-02 is separate. Restrict demo to explicit preview environment or label it clearly. Acceptance: normal production badge means genuine verification, and demo presentation can't be mistaken for real verification.

### RS-27 — Housing expansion is not keyboard operable

lib/views.js:964–965 emits tabindex=0/role=button/aria-expanded but expansion only through listing-head click. No Enter/Space expansion handler found in inspected generated JS. Add appropriate keyboard behavior without intercepting nested links/buttons; validate focus and aria-expanded updates. Lower priority than identity/data loss, but meaningful accessibility work.

### RS-28 — Detail page lacks board's WhatsApp action

Reviewer observed verified listing detail renders phone text without the board's green WhatsApp message action. Confirm current renderer and intended product behavior before treating as required. Add a consistent authorized action only if desired; gate and analytics must match board behavior. This is polish, not established data loss.

### RS-29 — Tests pass but omit most critical paths

Only parser.test.js and matcher.test.js are present in the audited root suite. All 51 tests passed with isolated dependencies and dummy Supabase config. No auth, submission ownership, verification, rendering, reconnect, group scope, or edit/delete failure tests found. Some matcher tests encode current questionable behavior (e.g. missing dates can be medium), so green tests are not product validation.

Add focused regression checks alongside each authorized fix, especially P1 security/ingestion failures and date/rendered script behavior. Do not write shallow tests that merely repeat implementation. Avoid loading actual .env/production DB for tests; mocked clients or transactional disposable fixtures should isolate state. CI/runtime dependency expectations should be documented if imports require env even for pure matcher tests.

## Recommended implementation batches

1. **Verify exposure/config now:** RS-01,07,08,11,20 read-only checks. This can downgrade conditional risks or reveal urgent production mitigation needs.
2. **Identity/privacy fixes:** RS-01,02,03,07,19 with route/render/session regression checks. Coordinate user/session effects before production rollout.
3. **Bot health and loss prevention:** RS-04,05,06,12,24 after explicit bot.js authorization. Inspect schema/idempotency before migration/replay; keep outbound paused.
4. **DB mutation and matching:** RS-09,13,14,15,16 after defining match/availability policy. Preserve edit audit history and rollback behavior.
5. **Verification and account ownership:** RS-17,18; ensure webhook/tier/linked-phone consistency.
6. **Dates and filter correctness:** RS-21,22,23; these are smaller changes but real user-impacting defects.
7. **Product/ops polish:** RS-25–28 and remaining config work.

RS-10 latency instrumentation is an independent track. Don't postpone a measured incident indefinitely, but don't claim another bug explains it. Agent work can parallelize by separate module ownership; bot/db/matcher changes overlap and need coordination.

## Outstanding decisions and evidence gaps

- Effective VPS secrets, monitor reachability, proxy trust, current/saved dashboard count.
- Exact failure that caused September 28 reconnect to stop; raw logs may be rotated.
- Whether missed WhatsApp messages exist in available history; syncFullHistory disabled means no recovery promise.
- Whether logged processing failures represent real missing listings; count safely before replay.
- Product semantics of matching, strong quality, seat capacity, and matched status.
- Tier policy for original housing text and alternate contact vs owner phone.
- Database automation/constraints/RLS/RPCs not fully audited; don't assume app-only behavior covers them.
- Severe latency origin timing has not been captured; root cause remains open.

## Continuation status template

For each finding, add: `Status: open / verified production / in progress / fixed locally / deployed / validated`, implementation commit, files/schema changes, exact meaningful checks, rollout date in Central time with offset, rollback notes, and remaining uncertainty. Keep original evidence distinguishable from later measurements. Never update status based solely on this proposed backlog.
