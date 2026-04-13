# Sprint 7 — User Profile Foundation

**Status:** DONE  
**Version tag:** v3.7.0  
**Date:** 2026-04-13

## Goal
Every user who verifies via WhatsApp OTP gets a profile. Show it at `/profile`. Seed name from existing `wa_contacts` data (1,256 contacts already named).

## Files changed
- `schema_wa_otp.sql` — new: `wa_otp_codes` table
- `schema_user_profiles.sql` — new: `user_profiles` table
- `lib/wa-otp.js` — new: OTP generate / queue / verify
- `lib/profiles.js` — new: upsertProfile, getProfile
- `middleware/auth.js` — added `wa_phone` HMAC cookie support in `optionalAuth`
- `routes/auth.js` — added `/login/phone`, `/verify/phone` routes; upsert profile on verify
- `routes/profile.js` — new: `GET /profile`
- `lib/views.js` — added `renderPhoneLoginPage`, `renderPhoneVerifyPage`, `renderProfilePage`
- `dashboard.js` — registered profile route
- `bot.js` — added 5s outbound_queue poller for `wa_otp` messages
- `ROADMAP.md` — added sprints 7–10

## Testing criteria
- [x] After WA OTP login, `GET /profile` returns 200
- [x] `user_profiles` row exists in Supabase for verified phone
- [x] `display_name` pre-populated from `wa_contacts.name` when available
- [x] Unauthenticated `GET /profile` → 302 to `/login/phone`
- [x] Phone displayed masked (only last 4 visible)
- [x] Logout clears `wa_phone` cookie

## Housekeeping done
- [x] `schema_wa_otp.sql` — run in Supabase before deploy
- [x] `schema_user_profiles.sql` — run in Supabase before deploy
- [x] `WA_OTP_SECRET` env var documented (must be set on VPS)
- [x] `scripts/` excluded from app (analysis-only, not served)

## Deploy steps
1. Run `schema_wa_otp.sql` in Supabase SQL editor
2. Run `schema_user_profiles.sql` in Supabase SQL editor
3. Add `WA_OTP_SECRET=<random-string>` to VPS `.env`
4. `git push && ssh agconnect "cd ~/aggieconnect-v3 && git pull && pm2 restart ecosystem.config.js"`

## Next: Sprint 8
Profile name editing + email↔phone linking. See ROADMAP.md.
