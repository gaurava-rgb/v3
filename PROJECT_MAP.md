# Project Map — v1   (updated 2026-05-18)

> WhatsApp bot that monitors TAMU ride-share groups, parses messages with an
> LLM, stores them in Supabase, matches ride needs with offers, and serves a
> web dashboard at ridesplit.app.

## Changelog

| v | date       | change      |
|---|------------|-------------|
| 1 | 2026-05-18 | initial map |

---

## 1. How a message flows

```
   TAMU WhatsApp ride-share groups
              │
              │  group message
              ▼
        ┌───────────┐      message text       ┌────────────┐
        │  bot.js   │ ──────────────────────► │ parser.js  │
        │ (Baileys  │                         │ LLM call   │
        │  client)  │ ◄────────────────────── │ OpenRouter │
        └───────────┘    ride intent JSON     └────────────┘
              │            (type/date/time/tags)
              │
              │  saveRequest / logMessage / upsertContact
              ▼
        ┌───────────┐                          ┌────────────┐
        │   db.js   │ ───────────────────────► │  Supabase  │
        │ (Supabase │                          │  v3_* tbls │
        │  CRUD)    │ ◄─────────────────────── │            │
        └───────────┘                          └────────────┘
              │
              │  processRequest
              ▼
        ┌───────────┐   match quality          v3_matches
        │ matcher.js│   strong / medium / low
        └───────────┘

  Support: normalize.js cleans location names before store/match.
           lib/housing.js stores housing listings (upsertHousing).
```

```
   Web visitor                              ┌──────────────┐
        │                                   │  ridesplit   │
        │  HTTP                             │   .app       │
        ▼                                   └──────┬───────┘
   ┌──────────────┐  mounts   ┌──────────┐         │
   │ dashboard.js │ ────────► │ routes/  │ ────────┘  HTML pages
   │ (Express)    │           │  *.js    │
   └──────────────┘           └────┬─────┘
        │ uses                     │ render via
        ▼                          ▼
   middleware/               lib/views.js  (+ other lib/ helpers)
   (auth, rateLimiter)

   PM2 cron (aggie-v3-digest) runs scripts/cluster-digest.js hourly
   → sends a cluster digest back to WhatsApp.
```

---

## 2. Core files

| File           | Role                                                            |
|----------------|-----------------------------------------------------------------|
| `bot.js`       | Baileys WhatsApp client (linked device). Receives group messages, drives parse → store → match. **Live — do not modify unless asked.** |
| `parser.js`    | Sends message text to an LLM via OpenRouter, extracts ride intent (type, date, time, tags). |
| `db.js`        | Supabase CRUD, SHA256 dedup, contact resolution (LID → phone).  |
| `matcher.js`   | Matches ride needs ↔ offers, scores quality (strong/medium/low).|
| `normalize.js` | Location-name normalization.                                    |
| `dashboard.js` | Express entry point — mounts `routes/` + `middleware/`. Port 3004. |
| `monitor.js`   | PM2 health dashboard. Port 3005.                                |

---

## 3. Web layer

**`routes/`** — each mounted by `dashboard.js`:

| File          | Serves                                                        |
|---------------|---------------------------------------------------------------|
| `clusters.js` | Homepage `/` and `/clusters` — ride clusters, three buckets.  |
| `auth.js`     | Email magic-link auth (`/auth/callback`, `/check-email`).     |
| `verify.js`   | `/verify/wa` — WhatsApp phone verification.                   |
| `profile.js`  | `/profile` — user profile, listings feed.                     |
| `submit.js`   | `/submit` — Post-a-Ride form.                                 |
| `rides.js`    | `/ride/:id` view + edit/delete own rides.                     |
| `housing.js`  | `/housing` — housing board.                                   |
| `digest.js`   | Admin digest pages — `/digest/*`, key-gated preview of matches/clusters. |
| `static.js`   | Static pages — `/faq`, `/terms`.                              |

**`lib/`** — shared helpers:

| File           | Role                                            |
|----------------|-------------------------------------------------|
| `supabase.js`  | Supabase client.                                |
| `views.js`     | HTML rendering for dashboard pages.             |
| `housing.js`   | Housing listing cache + `upsertHousing`.        |
| `profiles.js`  | User profiles (`getPhoneForEmail`, `linkEmailToProfile`). |
| `wa-verify.js` | WhatsApp verify tokens (`markTokenVerified`).   |
| `dateFilter.js`| Date filtering for listings.                    |
| `helpers.js`   | Misc helpers (`parseTzPref`, etc.).             |
| `data.js`      | Supabase data-fetch queries for dashboard routes (matches, clusters, user listings). |

**`middleware/`**:

| File            | Role                                                  |
|-----------------|-------------------------------------------------------|
| `auth.js`       | `optionalAuth`, `getUserTier` (T0 anon / T1 email / T2 WA-verified). |
| `rateLimiter.js`| Request rate limiting.                                |

---

## 4. Data — Supabase tables

**Rides**
- `v3_requests` — parsed ride requests/offers (`raw_message`, `tags`, `request_details` JSONB, `parent_id` for fan-out).
- `v3_matches` — matched need ↔ offer pairs.
- `v3_request_edits` — full-snapshot changelog of ride edits.
- `v3_message_log` — every processed WhatsApp message (dedup record).
- `outbound_queue` — queued outbound bot messages.

**Housing**
- `v3_housing` — housing listings (`message_text` original WA text).

**Contacts / groups**
- `wa_contacts` — WhatsApp contacts, LID → phone mapping.
- `monitored_groups` — which WhatsApp groups the bot watches.

**Users / auth**
- `user_profiles` — linked email + phone(s), tier data.
- `wa_verify_tokens` — WhatsApp verification tokens.

**Analytics**
- `card_expand_log` — ride/housing card expands (`POST /log-expand`).
- `wa_click_log` — WhatsApp button clicks (`POST /log-click`).

---

## 5. Processes & deploy

**PM2 processes** (config: `ecosystem.config.js`, TZ America/Chicago):

| Process            | Script                      | Port | What                          |
|--------------------|-----------------------------|------|-------------------------------|
| `aggie-v3-bot`     | `bot.js`                    | —    | WhatsApp client. No HTTP port.|
| `aggie-v3-dash`    | `dashboard.js`              | 3004 | Web app — ridesplit.app.      |
| `aggie-v3-digest`  | `scripts/cluster-digest.js` | —    | PM2 cron `0 * * * *` — sends hourly cluster digest to WhatsApp. |
| `aggie-v3-monitor` | `monitor.js`                | 3005 | Health dashboard.             |

- **Live:** ridesplit.app (Hetzner VPS, runs alongside v2).
- **Auth state:** `.v3_auth/` — Baileys session, never delete.
- **Deploy:** `git push && ssh agconnect "cd ~/aggieconnect-v3 && git pull && pm2 restart ecosystem.config.js"`

---

## 6. Scripts

**`scripts/`** — `cluster-digest.js` is part of the running system (PM2 cron,
see §5); the rest are run by hand:

- `cluster-digest.js` — hourly cluster digest sender (run by `aggie-v3-digest`).
- `analyze-housing.js`, `backfill_housing.js`, `housing-outreach.js` — housing maintenance.
- `reparse_active.js` — re-parse active rows.
- `*-mockup.html`, `housing-outreach.csv` — design mockups / data, not code.

**Root-level one-off / maintenance scripts** (run by hand, not in the running system):

- `backfill_flexible.js`, `backfill_tags.js` — backfill columns on old rows.
- `reparse_errors.js` — re-parse messages that failed LLM JSON parsing.
- `roundtrip_check.js` — round-trip parser check.
- `test_dest_tags.js`, `test_houston_tags.js` — ad-hoc tag tests.
- `matcher.test.js`, `parser.test.js` — unit tests.
