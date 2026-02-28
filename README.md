# Aggie Connect — v3

WhatsApp bot that monitors TAMU student ride-share groups, parses requests with an LLM, stores them in Supabase, and matches needs with offers.

## Active Files

| File | Purpose |
|------|---------|
| `bot.js` | Main WhatsApp bot (Baileys, message processing, LID resolution) |
| `parser.js` | LLM parser — extracts ride intent, dates, times via OpenRouter |
| `db.js` | Supabase client — v3_* tables, dedup, contact persistence |
| `matcher.js` | Matching logic + match quality (strong/medium/low) |
| `normalize.js` | Location name normalization |
| `dashboard.js` | Express server — public ride board (/) + admin digest (/digest) |
| `monitor.js` | PM2 health + logs dashboard |
| `schema.sql` | Full Supabase schema (run once) |
| `ecosystem.config.js` | PM2 config — 3 processes, TZ: America/Chicago |

## Supabase Tables

`v3_requests`, `v3_matches`, `v3_message_log`, `outbound_queue`, `wa_contacts`, `monitored_groups` (shared with v2)

## Run Locally

```bash
cp .env.example .env   # fill in SUPABASE_URL, SUPABASE_KEY, OPENROUTER_API_KEY
npm install
node bot.js            # scan QR on first run
node dashboard.js      # port 3004
```

## Deploy (VPS)

```bash
pm2 start ecosystem.config.js && pm2 save
```

Ports: 3004 (dashboard), 3005 (monitor). Live at `v3.myburrow.club`.

## Archive

Historical docs (HANDOFF.md, CONTEXT.md, completed plan details) and superseded files (dashboard3.js, migrate-v2.js) are in `archive/`.
