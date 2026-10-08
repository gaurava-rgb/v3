# RideSplit intermittent latency investigation

Snapshot: October 6, 2026. Status: **historical severe delay verified; exact root cause unresolved; no production changes made.** See [AUDIT-HANDOFF.md](AUDIT-HANDOFF.md) for repository and backup paths.

## Question and bottom-line evidence

The user saw ridesplit.app sometimes take many seconds to load. They asked a separate subagent to investigate independently rather than repeat the earlier Claude explanation. The agent inspected raw saved tool results, code, fresh client timing samples, and read-only server diagnostics.

**Cloudflare's request path remains the leading suspect.** Historical edge requests were much slower than direct-origin samples. However, these were not sufficient synchronized end-to-end measurements to rule out intermittent origin/application stalls. Do not state “Cloudflare is definitely the cause” or “Supabase is definitely the cause.”

## Evidence ledger

| Measurement | Observation | What it establishes | Limitation |
|---|---|---|---|
| Saved Claude public curl results | 11.7–16.3 seconds to first byte through Cloudflare | Severe stalls actually occurred | Does not locate the wait inside Cloudflare vs its origin path vs app |
| Client connection timing in saved slow probes | TLS about 0.085 seconds; DNS/TLS fast | The severe delay came after connecting to Cloudflare | Says nothing about Cloudflare's separate origin connection |
| Saved direct-origin anonymous homepage probes | 1.17–1.36 seconds | Origin was fast in those samples | Not a simultaneous trace of the exact stalled request |
| Direct-origin method checked by agent | Same hostname/Host and `/` route; no cookies; `-k` certificate-validation bypass | Route/auth differences were not obvious confounds | `-k` is diagnostic only and is not normal-user TLS validation |
| Independent fresh public homepage samples | 21 requests, 0.66–1.44 seconds | Severe delay did not recur during sampling | Intermittent incidents can evade short sampling |
| Independent fresh direct-origin samples | 0.92–1.44 seconds | Direct origin was similar to edge during normal operation | Does not prove earlier edge path behavior |
| Independent server-local app probes | Five samples, 0.40–0.63 seconds | Normal application execution was subsecond in these samples | Different request timing and network context |
| Fresh housing navigation/request samples | 1.30–2.49 seconds | Housing has higher normal latency | Separate from 10–16 second stalls |
| After about 50 seconds idle | Edge 1.02 seconds; direct 1.31 seconds | An idle interval did not reliably reproduce the issue | Longer/different idle intervals could behave differently |
| Server diagnostics | Low load, no recent relevant nginx errors; dashboard error logs returned no entries | No obvious resource saturation/error evidence | Slow successes need not generate error logs |
| One origin–Cloudflare TCP connection | A retransmission observed | Some packet loss/retransmission existed | One retransmission is insufficient to explain 15 seconds |

Initial root browser checks also observed approximately 1.8 seconds rides total navigation and 2.6 seconds housing, with TTFB about 1.4 and 2.1 seconds respectively. Those are browser navigation measurements, not identical to all curl measurements above.

The investigator returned summarized evidence rather than a complete exported fresh trace. The raw historical measurements remain in the supplied JSONL backups. A future investigator should capture fresh samples and associated timestamps/IDs in files; do not invent the unrecorded sample order or exact command flags.

## Corrections to earlier explanations

1. **IPv6 hypothesis was disproved in the saved conversation.** Claude initially guessed a dead AAAA path, then acknowledged that the supplied DNS export contained no AAAA record. Do not delete DNS records based on this abandoned guess.
2. **nginx access timestamps are completion timestamps.** Claude used tagged requests and access-log times to infer delay before nginx. Those log timestamps alone do not identify request arrival. That inference was invalid.
3. **“After idle” is not an established trigger.** It was reported as a pattern; the independent idle test was fast.
4. **Finland-to-Texas distance is insufficient to explain 15 seconds.** Geography adds baseline latency but no specific observed failure mechanism.
5. **Two dashboard workers are a separate configuration concern.** The saved chat reports two despite one configured; this may create cache inconsistencies. No evidence ties it directly to the severe stalls.
6. **Current code defects are not proven latency causes.** Auth, privacy, and ingestion bugs from the broader audit should be fixed on their own merits; do not attribute intermittent slowness to them without timing evidence.

## Remaining plausible explanations

| Hypothesis | Supporting evidence | Missing discriminator |
|---|---|---|
| Cloudflare→origin connection establishment/retry delay | Historical edge slow/direct fast; one retransmission | Timings/trace from the same slow request |
| Cloudflare processing/routing issue | Wait after fast client TLS; edge-path difference | Low origin duration correlated with high edge/client duration and CF-Ray |
| Intermittent Node/Supabase delay | Dynamic pages await upstream DB/auth work | High upstream-header/response time for a slow request, then per-operation timing |
| Network trouble on origin connection | Retransmission evidence | Sustained losses/retries during a severe request |

The application can be fast in separately sampled requests and slow in another; therefore existing fast local probes do not fully eliminate the database/application hypothesis.

## Smallest useful next diagnostic change

**Proposed, not performed:** add a narrowly scoped nginx timing log for ridesplit.app. Read actual nginx configuration first; syntax below is illustrative and must be adapted to the existing deployment. Keep existing logging and use an access-controlled log destination.

```nginx
log_format ridesplit_timing escape=json
  '{"time":"$time_iso8601","request_id":"$request_id",'
  '"method":"$request_method","uri":"$uri","status":$status,'
  '"request_time":"$request_time",'
  '"upstream_connect_time":"$upstream_connect_time",'
  '"upstream_header_time":"$upstream_header_time",'
  '"upstream_response_time":"$upstream_response_time",'
  '"cf_ray":"$http_cf_ray"}';
```

Use `$uri` rather than the complete request/query to avoid logging verification tokens and sensitive query values. Avoid cookies, auth headers, bodies, and user identifiers. Configure an additional `access_log` only in the correct ridesplit server context. Confirm nginx version/context syntax with `nginx -t` before any reload. A reload/config write has not been approved by the documentation task.

Capture client DNS, TCP, TLS, first-byte, and total times plus response CF-Ray. Correlate a stalled client request to the nginx entry using CF-Ray where available, otherwise a safe diagnostic ID logged separately. Do not weaken authentication or caching to get timings. Sequential sampling should be bounded, not a load test.

Interpretation:

- **High client time, low nginx request/upstream time:** investigate outside origin application: Cloudflare processing, origin-connection setup, routing/retries, or return network path.
- **High upstream header/response time:** investigate Node route, auth calls, Supabase queries, connection wait, and event-loop delays with per-operation timings.
- **High upstream connect time:** check origin→Node proxy connection/backlog/process behavior.
- **High nginx time with low upstream time:** inspect request/response transfer and nginx handling; bytes, request size, and network behavior may be needed.
- **Missing log entry:** first check matching/log completion/rotation and failed vs in-flight requests; absence alone is not proof the request never arrived.

Upstream variables may contain multiple values for retries; do not treat them as one scalar blindly. Timings from separate machines require synchronized clocks when comparing absolute timestamps. CF-Ray correlation is preferable to guesswork from timestamps.

## Follow-up workflow and completion criteria

1. Reconfirm current effective PM2 topology and nginx proxy configuration with sanitized read-only output.
2. Add approved instrumentation with a backup and minimal reload; do not restart WhatsApp.
3. Compare anonymous public `/`, direct-origin same Host/TLS route, localhost app, `/housing`, and a public static asset. Preserve path/auth/cache comparability and record response status/cache headers.
4. Capture at least one severe slow request with matching origin timing. Static assets can help isolate DB/auth, but a different endpoint alone cannot prove the dynamic route's cause.
5. If time is outside app, take an approved short packet trace or inspect connection metrics during recurrence. Sanitize traces; do not broadly capture user traffic indefinitely.
6. If time is upstream, instrument individual route/auth/DB operations and event-loop delay; avoid full user data logging.
7. Document cause, fix, before/after samples, and remaining uncertainty. Do not claim resolved merely because a batch of probes is fast.

No cache purge, DNS change, Cloudflare setting change, nginx log change, service restart, or deployment was performed during this investigation.
