# Sprint 9 — Housing Board

**Status:** PLANNED  
**Picks up from:** Sprint 8 (v3.8.0, committed 2026-04-13)  
**Target tag:** v3.9.0

---

## Context (read this cold)

**Project:** WhatsApp bot monitoring TAMU ride-share/housing groups. Dashboard at ridesplit.app.  
**Stack:** Node/Express, Supabase, Baileys WA bot, PM2 on VPS.  
**Auth:** Two session types:
  1. Supabase email OTP (`access_token` + `refresh_token` cookies) — @tamu.edu only
  2. WA phone OTP (`wa_phone` HMAC-signed cookie)

**What Sprint 8 shipped:**
- Inline name editing on /profile (pencil icon, fetch POST /profile/name, Enter/Escape shortcuts)
- Three-state email field: not linked / ✓ Verified (email-auth) / ✓ Linked (phone+email)
- Phone↔email linking: POST /verify links email→phone profile; POST /verify/phone links phone→email session
- `parsePhoneSession` exported from middleware/auth.js
- `nameLimiter` (10/hr) added to middleware/rateLimiter.js
- Fixed missing `renderPhoneLoginPage`/`renderPhoneVerifyPage` import in routes/auth.js

**Existing tables (Supabase):**
- `v3_requests` — ride requests/offers parsed from WA groups
- `v3_message_log` — raw messages (source for backfill)
- `user_profiles` — one row per verified phone (id, phone, display_name, wa_name, email, email_verified)
- `wa_contacts` — phone→name map from Baileys

**Existing routes:**
- `/` — public ride board
- `/clusters` — three-bucket layout (leaving/arriving/other)
- `/profile` — user profile (Sprint 8)
- `/login`, `/verify` — email OTP
- `/login/phone`, `/verify/phone` — WA OTP

---

## Sprint 9 Goal

Add a housing board: parse housing messages from WA groups (sublease, roommate, lease-transfer), store them in a new `v3_housing` table, show them at `/housing`, and link to individual listing pages at `/listing/:slug`.

---

## Schema

### v3_housing table

```sql
CREATE TABLE IF NOT EXISTS v3_housing (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug          TEXT UNIQUE NOT NULL,      -- url-safe, e.g. "sublease-college-station-apr-2026-a3f1"
    source_contact TEXT,                      -- phone digits (FK-ish to wa_contacts)
    sender_name   TEXT,
    message_text  TEXT NOT NULL,
    listing_type  TEXT,                       -- 'sublease' | 'roommate' | 'lease_transfer' | 'other'
    location      TEXT,                       -- normalized city/area
    price         INTEGER,                    -- monthly rent in dollars, null if not mentioned
    available_date DATE,                      -- null if not mentioned
    end_date      DATE,                       -- for subleases
    bedrooms      INTEGER,
    bathrooms     NUMERIC(3,1),
    amenities     TEXT[],                     -- ['pool','gym','utilities_included',...]
    contact_phone TEXT,                       -- can differ from source_contact if poster specifies
    contact_info  TEXT,                       -- raw: "text 979-xxx-xxxx" or "DM me"
    active        BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    message_hash  TEXT UNIQUE               -- SHA256 dedup key
);
```

Run this in Supabase SQL editor before deploy. Save as `schema_housing.sql`.

---

## Tasks

### 1. Parser extension — detect housing messages

In `parser.js`, the current prompt asks for ride intent. Add a second extraction path:
- If the message contains keywords like "sublease", "roommate", "bedroom", "lease", "rent", "furnished", "utilities", "/mo", "$/month" → classify as housing
- Return a housing object: `{ type: 'housing', listing_type, location, price, available_date, end_date, bedrooms, bathrooms, contact_info, amenities }`
- If it's not housing and not a ride → `{ type: 'none' }`

The cleanest approach: extend the existing LLM prompt to return a `category` field (`'ride'` | `'housing'` | `'none'`) and a `housing` sub-object when category is housing.

### 2. lib/housing.js — DB operations

New file. Functions:
- `upsertHousing(parsed, rawMessage, sourceContact, senderName)` — insert or ignore on `message_hash` conflict
- `getActiveListings(filters)` — `SELECT * FROM v3_housing WHERE active=true ORDER BY created_at DESC`; filter by `listing_type` if provided
- `getListingBySlug(slug)` — single row fetch

Slug generation: `listing_type + '-' + location + '-' + month-year + '-' + random 4 hex chars`, lowercased, spaces→hyphens.

### 3. bot.js — housing message routing

When parser returns `category: 'housing'`, call `upsertHousing()` instead of the ride request path.

Do NOT modify bot.js beyond adding the housing branch — keep changes minimal as per CLAUDE.md.

### 4. Backfill script — scripts/backfill_housing.js

One-time script (not served, not part of the app). Reads last 30 days from `v3_message_log`, runs each through the parser, inserts housing records. Run manually via `node scripts/backfill_housing.js`.

### 5. routes/housing.js — /housing board

- `GET /housing` — renders housing board with filter chips (All / Sublease / Roommate / Lease Transfer)
- `GET /listing/:slug` — individual listing page; contact info gated behind auth (redirect to /login/phone if not logged in)

### 6. lib/views.js — renderHousingBoard() and renderListingPage()

Housing board layout:
- Filter chips at top (tabs, not dropdowns)
- Cards showing: listing_type badge, location, price/mo, bedrooms, available date, sender_name
- Responsive grid (2-col on desktop, 1-col mobile)

Listing page:
- Full details: all fields
- Contact section: if not logged in → prompt "Sign in to see contact info"; if logged in → show contact_phone / contact_info

### 7. dashboard.js — register housing route

Add `app.use('/', housingRouter)` alongside existing routes.

---

## Files to touch

| File | Change |
|---|---|
| `schema_housing.sql` | New: CREATE TABLE v3_housing |
| `parser.js` | Extend prompt to detect housing, return category + housing object |
| `lib/housing.js` | New: upsertHousing, getActiveListings, getListingBySlug |
| `bot.js` | Add housing branch (minimal — just call upsertHousing) |
| `routes/housing.js` | New: GET /housing, GET /listing/:slug |
| `lib/views.js` | Add renderHousingBoard(), renderListingPage() |
| `dashboard.js` | Register housing route |
| `scripts/backfill_housing.js` | New: one-time backfill script |
| `ROADMAP.md` | Mark Sprint 9 DONE |

---

## Testing criteria

- [ ] POST a housing-style WA message → v3_housing row created with correct fields
- [ ] GET /housing returns 200, shows listing cards
- [ ] Filter chip ?type=sublease → only sublease cards shown
- [ ] GET /listing/:slug returns 200 with full details
- [ ] GET /listing/:slug when not logged in → contact section shows sign-in prompt, not phone number
- [ ] GET /listing/:slug when logged in → contact info visible
- [ ] Duplicate message → no second row (message_hash dedup)
- [ ] Backfill script runs without crashing, inserts housing rows from message_log
- [ ] Existing ride board (/) unaffected

---

## Housekeeping

- [ ] schema_housing.sql run in Supabase before deploy
- [ ] bot.js change is minimal — one extra branch, no restructuring
- [ ] parser.js prompt change backward-compatible (ride messages still parsed correctly)
- [ ] No regressions on /profile, /clusters, /login flows

---

## Git

Commit message style: `Sprint 9: housing board (v3.9.0)`  
Tag: `v3.9.0`  
Update ROADMAP.md sprint table: change Sprint 9 status from PLANNED → DONE.  
Write SPRINT_10.md before committing.
