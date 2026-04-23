# Aggie Connect v3 — Project Status
**Version:** 1.6 | **Date:** Apr 23, 2026 | **App version:** 3.8.0

Update this file after each sprint. Increment version (1.1, 1.2, ...) each time.

---

## Live URLs
- ridesplit.app — public rides board
- ridesplit.app/housing — housing board (162+ listings)
- ridesplit.app/clusters — trip clustering view
- ridesplit.app/digest — admin digest (password-protected)
- Port 3004: Express dashboard | Port 3005: PM2 monitor

---

## Architecture

```
WhatsApp Groups
    → bot.js (Baileys linked device)
    → parser.js (OpenRouter LLM)
    → db.js (Supabase CRUD)
    → matcher.js (need↔offer matching)
    → v3_requests, v3_matches, v3_housing

User Browser
    → dashboard.js (Express, 3 route groups)
    → lib/views.js (server-side HTML)
    → Supabase read queries
```

**Core files:**

| File | Size | Purpose |
|------|------|---------|
| bot.js | 24.9 KB | Baileys WA client, message processing, LID→phone mapping, OTP poller |
| parser.js | 8.4 KB | OpenRouter LLM parse: intent, dates, times, locations, housing fields |
| db.js | 12.9 KB | Supabase CRUD, dedup (SHA256 hash), contact backfill |
| matcher.js | 5.8 KB | need↔offer matching, scoring (date/location/time/origin), quality tiers |
| normalize.js | 2.3 KB | 40+ location variants → 12 standard forms, nearby-pair scoring |
| dashboard.js | 1.6 KB | Express: mounts all routes + middleware |
| monitor.js | 12.2 KB | PM2 health dashboard (port 3005) |
| lib/views.js | ~75 KB | All HTML rendering (rides board, housing, auth pages, profile) |
| lib/housing.js | — | upsertHousing(), getActiveListings(), getListingBySlug(), 60s/5min cache |
| lib/profiles.js | — | upsertProfile(), linkEmailToProfile() |
| lib/wa-otp.js | — | OTP gen/verify/rate-limit (delivery via outbound_queue) |

---

## Supabase Tables

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| v3_requests | id, source_contact, sender_name, type, category, destination, ride_plan_date, ride_plan_time, date_fuzzy, possible_dates, request_hash, status | All ride/help requests from WA |
| v3_matches | id, need_id, offer_id, score, match_quality, notified | Matched need↔offer pairs |
| v3_message_log | wa_message_id, source_group, parsed_data, error | Every WA message + LLM parse result |
| v3_housing | id, slug (unique), source_contact, poster_phone, contact_phone, contact_info, listing_type, location, price, bedrooms, bathrooms, amenities, available_date, message_hash, active | Housing listings |
| wa_contacts | lid (PK), phone, name | LID→phone mappings (resolved from WA events) |
| user_profiles | id, phone (unique), display_name, email, email_verified, wa_name | One row per verified user |
| wa_otp_codes | phone, code_hash, attempts, used, expires_at | WA phone OTP codes (hashed) |
| outbound_queue | contact, channel, message_type, payload, status, related_request_id | Pending/sent outbound messages |
| monitored_groups | group_id, group_name, active, is_test | WA groups to listen to |

| wa_verify_tokens | id, token (unique), email, phone, verified, created_at, expires_at | WA tap-to-verify tokens |

---

## PM2 Processes

| Process | Script | Port | Notes |
|---------|--------|------|-------|
| aggie-v3-bot | bot.js | — | Max 10 restarts, 5s delay |
| aggie-v3-dash | dashboard.js | 3004 | Max 10 restarts, 3s delay |
| aggie-v3-monitor | monitor.js | 3005 | Max 10 restarts, 3s delay |

All: `TZ=America/Chicago`, `NODE_ENV=production`

---

## Auth System

Three session types, all coexist:

**1. Email (Supabase OTP)**
- `/login` → email → 6-digit OTP via Supabase → `access_token` cookie (1hr) + `refresh_token` (7d)
- `req.user.email` available

**2. WhatsApp Phone OTP**
- `/login/phone` → phone → OTP sent via WA bot from outbound_queue
- `/verify/phone` → code → hash compare → upsertProfile() → `wa_phone` cookie (HMAC-signed, 7d, stateless)
- `req.user.phone` available, `req.user.auth_type = 'phone'`

**3. Linked Profile**
- If both email + phone sessions active → linkEmailToProfile() → user_profiles.email set
- Profile page shows three states: unlinked | linked | phone-verified

**Middleware:** `optionalAuth` checks wa_phone cookie (HMAC validate) first, then email token (Supabase call)

---

## Access Tiers (Current State — Sprint 11)

| Tier | Condition | Rides | Housing |
|------|-----------|-------|---------|
| T0 anon | no session | listings/dates/destinations visible, names+phones masked | cards, location, price — contact redacted |
| T1 email | email session | same as T0 (nudge to verify WA) | price+beds filter bar unlocked; contact still gated |
| T2 WA verified | WA tap-to-verify done | full names, phones, "Your post" badge | contact_phone + contact_info visible |

**WA verify flow:** `/verify/wa` → deep link to +1 201-322-5726 → user sends `verify <token>` → Kapso workflow `wa-verify-handler` → `POST /api/verify-wa` → `linkEmailToProfile()` → frontend poll → T2 unlocked.

**Tier detection** (`middleware/auth.js`): `getUserTier()` — T2 = `auth_type==='phone'` OR email linked to profile with non-null phone.

---

## Sprints Completed

| Sprint | Focus | Status | Key Deliverable |
|--------|-------|--------|-----------------|
| 1–3 | Security, Reliability, Tests | ✅ | Rate limiting, LLM retry, 51 unit tests |
| 4 | Architecture | ✅ | Split dashboard.js → routes/ + lib/ |
| 7 | User Profiles | ✅ | WA OTP, user_profiles, profile page |
| 8 | Profile Editing | ✅ | Inline name edit, email linking |
| 9 | Housing Board | ✅ | v3_housing table, /housing, /listing/:slug, WA gate |
| 10 | Housing Polish | ✅ | Performance fix (830ms→184ms), poster_phone cache, source_contact as primary phone |
| 11 | Unified 3-Tier Access + WA Tap-to-Verify | ✅ | T0/T1/T2 gates on rides+housing, wa_verify_tokens, /verify/wa flow via Kapso (+1 201-322-5726) |
| 12 | /clusters Polish + Analytics | ✅ | See Apr 20 session below |
| 13 | Homepage Swap + FAQ/GA Polish | ✅ | See Apr 20 session below |

---

## Sprint 12 — Apr 20, 2026 (Clusters Polish + Analytics)

### /clusters fixes
- `raw_message` bug fixed (was reading `original_message` which never existed)
- T0 anon: message blurred (sign-in notice as actual text), group name hidden
- T1: names masked ("Someone"), message+group visible, verify nudge banner
- Person counts (leaving/arriving/other) = people not cluster count
- WA Message button (green pill, wa.me link) on T2 person cards; hidden on own posts
- `/verify/wa` auto-redirects to `returnTo` param (2s after success); clusters passes `?returnTo=/clusters`

### /housing fixes
- Full `message_text` shown (removed 200-char truncation)
- WA Message button on T2 contact row (same style as clusters)

### Cross-page nav
- Sticky "🏠 Housing" pill top-right on /clusters
- Sticky "🚗 Rides" pill top-right on /housing

### Analytics (new Supabase tables)
- `card_expand_log` — fires on cluster/listing expand (anon OK); columns: `page, listing_slug, origin, destination, ride_date, user_email, phone`
- `wa_click_log` — updated: now logs `phone` (contact clicked) + `page`
- `req.user.phone` now populated for T2 email-session users via `getPhoneForEmail()` (was always null before)
- sendBeacon uses `Blob({type:'application/json'})` so Express JSON parser accepts it

---

## Sprint 13 — Apr 20, 2026 (Homepage Swap + Polish)

### Homepage
- `/clusters` now serves `GET /` — is the homepage
- Old homepage moved to `GET /old-home` (preserved, not deleted)
- Rollback tag: `pre-homepage-swap` (`git checkout pre-homepage-swap -- routes/clusters.js routes/public.js lib/views.js`)

### GA
- Added `GA_TAG` to `/clusters` HTML head (was missing — only `/housing` had it)

### Navigation
- Housing page "Rides" pill: `/clusters` → `/`

---

## Apr 21, 2026 — Housing Share Button + Data Cleanup

### Share button (housing board)
- Added "Share" button inline with WA Message button on expanded listing cards
- Web Share API on mobile (native share sheet), clipboard fallback on desktop
- Flat pill design matching WA button (same shape/size/weight, gray instead of green)
- Upload-arrow SVG icon (not emoji), subtle box-shadow
- Clicks logged to `card_expand_log` with `page='housing-share'`
- Share button also present on `/listing/:slug` detail pages

### Data cleanup
- Deleted 14 near-duplicate listings (same source_contact + location + price)
- Deleted 1 false positive: graduation hood request misclassified as housing
- Deleted 1 out-of-area listing: New York sublease (60 Henry St)
- Root cause of dupes: dedup hashes exact message text; WA message edits bypass hash → new insert
- Clusters page tagline: added FAQ link
- Clusters footer: added FAQ + Terms links, bumped to v3.8

### FAQ
- Q2 updated to reflect T1/T2 flow (email login + WA phone verify)

---

## Apr 23, 2026 — My Profile Rewrite + Maintenance Page

### /profile rewrite (feed-style layout)
- Identity card: avatar, name (inline-editable for any T2 user with a profile row), member since, email (✓ Verified), phone numbers list
- Phones: all phones linked to user's email shown (via new `getPhonesForEmail()`); "+ Add another number" CTA routes to `/verify/wa?returnTo=/profile`
- Empty state: "No phone linked" → big green "Verify via WhatsApp" CTA
- My Rides section (maroon header): Upcoming (ride_plan_date >= today) + Past split, each with count
- My Housing section (teal header): Active (active=true) + Inactive split, each with count
- Rides show origin→destination, date, type badge, truncated raw_message preview
- Housing show location, price, beds/baths, listing_type, link to `/listing/:slug`, truncated message_text
- Edit name pill: SVG pencil + "Edit" label (replaced tiny ✏ unicode)

### Backend changes
- `lib/profiles.js` — new `getPhonesForEmail(email)` returns all linked phones
- `lib/data.js` — new `fetchUserListings({phones})` queries `v3_requests` (by source_contact) + `v3_housing` (by source_contact OR poster_phone), splits by date/active
- `routes/profile.js` — loads phones + listings, passes ctx to view
- `routes/profile.js` POST `/profile/name` — gate changed from `auth_type==='phone'` to `req.user.phone` presence (supports T2 email-session users)
- `routes/verify.js` GET `/verify/wa` — phone-auth users now resolve linked email via `getProfile()`, enables "Add 2nd number" flow from phone session

### Deploy maintenance page (nginx error_page)
- `public/maintenance.html` in repo (branded spinner, auto-refresh 15s, "Back online in seconds")
- Deployed to VPS `/var/www/ridesplit-maintenance/maintenance.html` (owned www-data:www-data, 755/644)
- `/etc/nginx/sites-available/ridesplit.app` updated: `proxy_intercept_errors on`, `proxy_connect_timeout 2s`, `error_page 502 503 504 = @maintenance`, new `location @maintenance` block
- Backup saved: `/etc/nginx/sites-available/ridesplit.app.bak.<timestamp>`
- Verified: stopping `aggie-v3-dash` → HTTP 200 maintenance page served; restart → normal app back
- Fires automatically during `pm2 restart` (~1-2s window). No app code changes.

---

## Open / Planned

| Item | Sprint | Priority | Notes |
|------|--------|----------|-------|
| ~~Kapso workflow + verify bugs~~ | ~~11~~ | ~~P0~~ | ~~DONE — wa-verify-handler live, linkEmailToProfile upsert fix, isEmailWaVerified multi-phone fix, user_profiles table created~~ |
| Outbound match notifications | 12 | P1 | outbound_queue ready, sender not built, needs new PM2 process |
| Kapso bot flows (ride auth, match alerts) | 13 | P2 | WABA live (+1 201-322-5726, CONNECTED). Build workflows in Kapso. |
| Request lifecycle (auto-close, expiry) | 14 | P2 | Requests stay open forever currently |
| Housing expiry notifications | 14 | P2 | H14 use case |
| Help category matching | Backlog | P3 | Parsed but matcher ignores it |
| Retroactive match notifications | Backlog | P3 | R17 use case |

---

## Known Gaps / Debt

- `outbound_queue` — 6mo old, fully schemed, only used for OTP. Match notifications never implemented.
- `MATCH_THRESHOLD` env — exists, never tuned in prod (default 0.5)
- `wa_otp_codes` — superseded by `wa_verify_tokens` (Sprint 11). Old table still exists, can be dropped later.
- `wa_otp_codes` — superseded by `wa_verify_tokens`. Old table still exists, can drop later.
- `user_profiles` table — now created. Multi-phone supported (same email, multiple phone rows).
- Package version — updated to 3.8.0, still manual
- monitor.js (port 3005) not routed through dashboard.js — accessible only direct
- No telemetry on match outcome quality (matches created but no feedback loop)
- Bryan→College Station normalization edge case still open

---

## Deploy

```bash
git push && ssh agconnect "cd ~/aggieconnect-v3 && git pull && pm2 restart ecosystem.config.js"
```

Auth state: `.v3_auth/` — **never delete**
