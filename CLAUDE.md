# CLAUDE.md

## Project
WhatsApp bot monitoring TAMU ride-share groups. Parses messages with LLM, stores in Supabase (v3_* tables), matches needs with offers. Deployed on VPS via PM2.

## Architecture
- `bot.js` — Baileys WhatsApp client, processes group messages
- `parser.js` — Sends messages to LLM (OpenRouter), extracts ride intent/date/time
- `db.js` — Supabase CRUD, dedup, contact resolution
- `matcher.js` — Matches needs↔offers, scores quality (strong/medium/low)
- `normalize.js` — Location name normalization
- `dashboard.js` — Express entry point, mounts routes/ + middleware/
- `monitor.js` — PM2 health dashboard
- `routes/` — clusters.js, housing.js, verify.js, profile.js, auth.js
- `lib/` — views.js (HTML), housing.js (cache), profiles.js, wa-verify.js, wa-otp.js
- `middleware/auth.js` — optionalAuth, getUserTier (T0/T1/T2)

## Key Facts
- Supabase tables: `v3_requests`, `v3_matches`, `v3_message_log`, `outbound_queue`, `wa_contacts`, `monitored_groups`, `user_profiles`, `wa_verify_tokens`, `wa_otp_codes`
- PM2 processes: `aggie-v3-bot`, `aggie-v3-dash` (port 3004), `aggie-v3-monitor` (port 3005)
- TZ: America/Chicago (set in ecosystem.config.js)
- Live: ridesplit.app
- Deploy: `git push && ssh agconnect "cd ~/aggieconnect-v3 && git pull && pm2 restart ecosystem.config.js"`
- `v3_requests.raw_message` — stores original WA text (used in clusters cards)
- `v3_housing.message_text` — stores original WA text for housing listings (shown in full, no truncation)

## /clusters Page
- T0 anon: names→"Someone", message→blurred placeholder (sign-in text), group name hidden
- T1 email: names→"Someone", message+group shown, WA verify nudge banner
- T2 WA verified: full names, raw message, group, green WA Message button (wa.me link); hidden on own posts
- Person counts (leaving/arriving/other) = people, not cluster count
- Sticky "🏠 Housing" pill button top-right links to /housing
- `/verify/wa` supports `?returnTo=` param; auto-redirects 2s after success

## /housing Page
- T2 contact row: phone + green WA Message button (wa.me link)
- Sticky "🚗 Rides" pill button top-right links to /clusters
- message_text shown in full (no 200-char truncation)

## Display
- Always show timestamps in Central US time, never raw UTC
- Format: `Apr 14, 12:10 AM CDT (UTC-5)` — always include date and offset
- CDT (UTC-5): mid-March through early November. CST (UTC-6): November through mid-March
- Apply to all log lines, deploy times, event times quoted in responses

## Status File
- `STATUS_v3.8.md` is the canonical project status doc — **read it at the start of every new chat**
- After completing any sprint or significant change, update `STATUS_v3.8.md`: move items from Open→Completed, add new open items, bump version header
- When a new sprint finishes, rename the file to match the new version (e.g. `STATUS_v3.9.md`) and update this line

## Rules
- Do NOT modify bot.js unless explicitly asked — it's connected to live WhatsApp
- Do NOT delete .v3_auth/ — it contains Baileys auth state
- Keep changes minimal and incremental
- Test locally before suggesting VPS deploy
- The `archive/` folder has historical docs — don't read them unless asked
