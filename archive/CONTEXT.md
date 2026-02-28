# Aggie Connect — Baileys v3

## What this is

v3 of the Aggie Connect WhatsApp bot, built on `@whiskeysockets/baileys`. Runs **alongside**
v2 (`aggieconnect-baileys`) on the same VPS (`agconnect`) and Supabase project.

## What's new in v3

- **Fuzzy date/time parsing** — parser extracts `date_fuzzy`, `possible_dates`, `ride_plan_time`, `time_fuzzy`
- **Match quality tiers** — each match is scored Strong / Medium / Low based on date+time certainty
- **Dashboard 3** (`dashboard3.js`) — trip cluster view with conversion gap indicators, grouped by quality

## How v3 differs from v2

| Thing              | v2 (aggieconnect-baileys)     | v3 (this repo)                       |
|--------------------|-------------------------------|--------------------------------------|
| Auth storage       | .baileys_auth/                | .v3_auth/                            |
| DB tables          | baileys_requests, baileys_matches, baileys_message_log | v3_requests, v3_matches, v3_message_log |
| Dashboard port     | 3002                          | 3004                                 |
| Monitor port       | 3003                          | 3005                                 |
| Dashboard 3 port   | —                             | 3006                                 |
| PM2 names          | aggie-baileys-*               | aggie-v3-*                           |
| Parser             | basic date/destination        | + fuzzy dates, ride_plan_time        |
| Matcher            | score only                    | + match_quality (strong/medium/low)  |

## What's identical to v2

- `normalize.js` — same location normalization
- `monitored_groups` Supabase table — shared, activating a group monitors it in ALL bots

## Deployment

```
git push && ssh agconnect "cd /root/aggieconnect-baileys-v3 && git pull && pm2 restart ecosystem.config.js"
```

## Supabase setup (run once before first start)

Run `schema.sql` in the Supabase SQL editor. This creates:
- `v3_requests` — ride requests with fuzzy date/time fields
- `v3_matches` — matches with match_quality column
- `v3_message_log` — parsed message log
- `outbound_queue` — schema prep for future outbound bot

## First run

On first start, the bot will print a QR code. Scan it with WhatsApp — it will appear as a
new linked device. Auth is persisted in `.v3_auth/` and the bot reconnects automatically.
