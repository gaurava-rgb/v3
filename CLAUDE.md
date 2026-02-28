# CLAUDE.md

## Project
WhatsApp bot monitoring TAMU ride-share groups. Parses messages with LLM, stores in Supabase (v3_* tables), matches needs with offers. Deployed on VPS via PM2.

## Architecture
- `bot.js` — Baileys WhatsApp client, processes group messages
- `parser.js` — Sends messages to LLM (OpenRouter), extracts ride intent/date/time
- `db.js` — Supabase CRUD, dedup, contact resolution
- `matcher.js` — Matches needs↔offers, scores quality (strong/medium/low)
- `normalize.js` — Location name normalization
- `dashboard.js` — Express: public board (/) + admin digest (/digest)
- `monitor.js` — PM2 health dashboard

## Key Facts
- Supabase tables: `v3_requests`, `v3_matches`, `v3_message_log`, `outbound_queue`, `wa_contacts`, `monitored_groups`
- PM2 processes: `aggie-v3-bot`, `aggie-v3-dash` (port 3004), `aggie-v3-monitor` (port 3005)
- TZ: America/Chicago (set in ecosystem.config.js)
- Live: v3.myburrow.club
- Deploy: `git push && ssh agconnect "cd ~/aggieconnect-v3 && git pull && pm2 restart ecosystem.config.js"`

## Rules
- Do NOT modify bot.js unless explicitly asked — it's connected to live WhatsApp
- Do NOT delete .v3_auth/ — it contains Baileys auth state
- Keep changes minimal and incremental
- Test locally before suggesting VPS deploy
- The `archive/` folder has historical docs — don't read them unless asked
