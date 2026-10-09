# Deployment memory

- October 8, 2026: RS-01/RS-19 legacy phone-cookie authentication retirement deployed as `2ea18ee` to `/root/aggieconnect-v3` via `git pull --ff-only` and `pm2 reload aggie-v3-dash`.
- Verified Oct 8, 3:28 PM CDT (UTC-5): both existing dashboard cluster workers online; bot and monitor not restarted. Single-instance config vs two effective workers remains RS-11, outside this rollout.
- Checks: 65 local tests pass; 14 isolated auth checks pass on VPS. Origin and public malformed-cookie session-tier requests return HTTP 200, tier 0, phone null and delete `wa_phone`; public home/housing/login HTTP 200.
- Email sessions/profile-backed verification remain supported. Legacy phone-only sessions must use email login. No production account/DB changes; existing profile links not audited or undone. Secret applicability/prior misuse remain unknown.
- Read AUDIT-HANDOFF.md and AUDIT-RANKED-2026-10-06.md for other open findings. Do not revert to the vulnerable phone-cookie auth as a default rollback.
