# Sprint 8 — Profile Editing + Email Linking

**Status:** DONE  
**Picks up from:** Sprint 7 (v3.7.0, committed 2026-04-13)  
**Target tag:** v3.8.0

---

## Context (read this cold)

**Project:** WhatsApp bot monitoring TAMU ride-share/housing groups. Dashboard at ridesplit.app.  
**Stack:** Node/Express, Supabase, Baileys WA bot, PM2 on VPS.  
**Auth:** Two session types coexist:
  1. Supabase email OTP (`access_token` + `refresh_token` cookies) — @tamu.edu only
  2. WA phone OTP (`wa_phone` HMAC-signed cookie) — built in Sprint 7

**What Sprint 7 shipped:**
- `wa_otp_codes` table — stores hashed OTP codes (schema_wa_otp.sql)
- `user_profiles` table — one row per verified phone (schema_user_profiles.sql)
- `lib/wa-otp.js` — sendOtp(), verifyOtp()
- `lib/profiles.js` — upsertProfile(), getProfile()
- `middleware/auth.js` — `wa_phone` cookie parsed in optionalAuth; also exports setPhoneSessionCookie, clearPhoneSessionCookie
- `routes/auth.js` — GET/POST /login/phone, GET/POST /verify/phone; upsertProfile() called on verify success
- `routes/profile.js` — GET /profile (auth-guarded; redirects to /login/phone if not logged in)
- `lib/views.js` — renderPhoneLoginPage(), renderPhoneVerifyPage(), renderProfilePage()
- `bot.js` — 5s setInterval polls outbound_queue for message_type='wa_otp', sends via sock.sendMessage
- `dashboard.js` — profile route registered

**user_profiles schema:**
```
id            UUID PK
phone         TEXT UNIQUE   -- E.164 digits, no +
display_name  TEXT          -- editable by user
wa_name       TEXT          -- seed from wa_contacts.name (read-only)
email         TEXT          -- nullable, linked @tamu.edu
email_verified BOOLEAN      -- default false
created_at    TIMESTAMPTZ
updated_at    TIMESTAMPTZ
```

**Current /profile page shows:**
- Avatar (first letter of name)
- display_name (or wa_name as fallback, or "No name set")
- Masked phone (+1 (•••) •••-XXXX) with "✓ Verified via WhatsApp" badge
- Email row: "Not linked yet — coming soon" (greyed)
- "Editing coming in a future update." hint
- Sign out link

**optionalAuth sets req.user as:**
- Phone session: `{ phone, id: phone, auth_type: 'phone' }`
- Email session: standard Supabase user object (has `.email`, no `.phone`)

---

## Sprint 8 Goal

1. **Name editing** — inline edit on /profile, POST /profile/name, persists to display_name
2. **Email field** — show greyed-out email on profile when user is email-authenticated, or when phone↔email are linked
3. **Phone↔email linking** — when both sessions present simultaneously, link them in user_profiles

---

## Tasks

### 1. POST /profile/name — update display_name

- Route: `POST /profile/name` in `routes/profile.js`
- Auth: `optionalAuth` — reject 401 if not logged in
- Validation: non-empty, stripped, ≤ 60 chars
- Rate limit: reuse `submitLimiter` from `middleware/rateLimiter.js` or write a new one
- DB: `UPDATE user_profiles SET display_name=$1, updated_at=NOW() WHERE phone=$2`
- Response: JSON `{ ok: true, name: "..." }` or `{ ok: false, error: "..." }`
- Add `updateProfileName(phone, name)` to `lib/profiles.js`

### 2. Inline edit UI on /profile

- Replace the static name line with an editable row:
  - Display mode: name text + pencil icon button
  - Edit mode: text input (pre-filled) + Save / Cancel buttons (no page reload)
  - On save: `fetch('POST /profile/name', { name })` → update DOM on success, show error inline on fail
- Keep it simple — no framework, just vanilla JS in the rendered HTML

### 3. Email field logic in renderProfilePage()

Three states to handle:
  a. **Phone-auth user, no email linked** → show "Not linked — sign in with @tamu.edu to link" (greyed)
  b. **Email-auth user** → show their email with "✓ Verified" badge (green)
  c. **Both linked** → show email with "✓ Linked" badge

Pass `profile.email` and `profile.email_verified` into the render. The render already receives the full profile row.

### 4. Phone↔email linking

When does linking happen:
  - On `POST /verify` (email OTP success): if `wa_phone` cookie is present → link phone's profile to this email
  - On `POST /verify/phone` (WA OTP success): if `access_token` cookie is present → link email to this phone's profile

Add `linkEmailToProfile(phone, email)` to `lib/profiles.js`:
```js
UPDATE user_profiles SET email=$1, email_verified=true, updated_at=NOW() WHERE phone=$2
```

Call it in `routes/auth.js`:
- In `POST /verify` (email success): extract phone from `wa_phone` cookie via `parsePhoneSession` (not exported yet — export it from middleware/auth.js), then call `linkEmailToProfile`
- In `POST /verify/phone` (WA success): extract email from Supabase session if `access_token` cookie present

**Note:** `parsePhoneSession` is currently private in `middleware/auth.js`. Export it.

---

## Files to touch

| File | Change |
|---|---|
| `lib/profiles.js` | Add `updateProfileName(phone, name)`, `linkEmailToProfile(phone, email)` |
| `middleware/auth.js` | Export `parsePhoneSession` |
| `routes/profile.js` | Add `POST /profile/name` |
| `routes/auth.js` | Call link functions in both verify handlers |
| `lib/views.js` | Update `renderProfilePage` — inline edit UI, email field logic |
| `middleware/rateLimiter.js` | Check if name-change rate limit needs a new limiter or can reuse existing |

---

## Testing criteria

- [ ] Edit name → save → refresh → new name persists
- [ ] Empty name → error shown inline, not saved
- [ ] Name > 60 chars → rejected
- [ ] Unauthenticated POST /profile/name → 401 JSON
- [ ] Sign in with phone → sign in with email → profile.email populated
- [ ] Sign in with email → sign in with phone → profile.email populated  
- [ ] Profile page shows email with ✓ badge when linked
- [ ] Profile page shows greyed "not linked" when only phone-authed
- [ ] No duplicate user_profiles rows after linking (phone stays PK)

---

## Housekeeping

- [ ] `parsePhoneSession` exported cleanly (don't duplicate the logic)
- [ ] Rate limiter for name edits documented in rateLimiter.js
- [ ] No regressions: existing email OTP login (/login → /verify) still works
- [ ] No regressions: /profile still loads for email-only users (profile will be null — handle gracefully)

---

## Git

Commit message style: `Sprint 8: profile editing + email linking (v3.8.0)`  
Tag: `v3.8.0`  
Update ROADMAP.md sprint table: change Sprint 8 status from PLANNED → DONE.  
Write SPRINT_9.md before committing.
