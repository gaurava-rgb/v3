# CLAUDE.md

## Project
WhatsApp bot monitoring TAMU ride-share groups. Parses messages with LLM, stores in Supabase (v3_* tables), matches needs with offers. Deployed on VPS via PM2.

## Architecture
- `bot.js` — Baileys WhatsApp client, processes group messages
- `parser.js` — Sends messages to LLM (OpenRouter), extracts ride intent/date/time
- `db.js` — Supabase CRUD, dedup, contact resolution
- `matcher.js` — Matches needs↔offers, scores quality (strong/medium/low)
- `normalize.js` — Location name normalization + corridor grouping (`getClusterCorridor`)
- `dashboard.js` — Express app wiring (routes in `routes/`, middleware in `middleware/`, shared code in `lib/`)
- `lib/clusters.js` — Cluster grouping query (by date + origin corridor + dest corridor)
- `routes/clusters.js` — Public cluster board at `/clusters` (Level 0: headers + counts only)
- `monitor.js` — PM2 health dashboard

## Key Facts
- Supabase tables: `v3_requests`, `v3_matches`, `v3_message_log`, `outbound_queue`, `wa_contacts`, `monitored_groups`
- PM2 processes: `aggie-v3-bot`, `aggie-v3-dash` (port 3004), `aggie-v3-monitor` (port 3005)
- TZ: America/Chicago (set in ecosystem.config.js)
- Live: ridesplit.app
- Deploy: `git push && ssh agconnect "cd ~/aggieconnect-v3 && git pull && pm2 restart ecosystem.config.js"`

## Rules
- Do NOT modify bot.js unless explicitly asked — it's connected to live WhatsApp
- Do NOT delete .v3_auth/ — it contains Baileys auth state
- Keep changes minimal and incremental
- Test locally before suggesting VPS deploy
- The `archive/` folder has historical docs — don't read them unless asked
