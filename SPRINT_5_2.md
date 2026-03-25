# Sprint 5.2 — Auth Ladder (Email + Phone)

**Status:** CODE COMPLETE — needs external setup (see below)

## Goal
Add @tamu.edu login and phone verification so the cluster board can gate information at each level. Email login reveals cluster details. Phone verification reveals contacts and enables post claiming.

## Depends on
Sprint 5.1 (cluster board with real data, corridor grouping, click tracking)

---

## Auth Ladder Recap

| Level | How they get here | What they see |
|-------|-------------------|---------------|
| No login | Visit /clusters | Cluster headers only: route, day, people count. No names, messages, timing |
| @tamu.edu login | Google OAuth with domain restriction | Click into clusters. See first names, messages, timing. No phone numbers |
| Phone verified | OTP via Twilio/similar | See full phone numbers. Claim own posts. Track clusters for updates |

---

## Tasks

### 1. Google OAuth with @tamu.edu domain restriction
- **What:**
  - Add Google OAuth login (passport.js or similar)
  - Restrict to @tamu.edu email addresses only
  - Session management (cookie-based, express-session)
  - Store user in new `users` table: `id, email, name, created_at, phone (nullable), phone_verified_at (nullable)`
  - Login/logout buttons on cluster board
- **Done when:**
  - Only @tamu.edu emails can log in
  - Session persists across page loads
  - Non-tamu emails get a clear rejection message

### 2. Gate cluster details behind login
- **What:**
  - `/clusters` public view: cluster headers with route + day + count only
  - `/clusters/:id` or click-to-expand: requires @tamu.edu session
  - Logged-in view: names, messages, timing, need/offer breakdown
  - Phone numbers still hidden (replaced with "Verify phone to see")
- **Done when:**
  - Public board is useful but teases details
  - Clicking into a cluster without login → redirect to sign-in
  - Logged-in users see full cluster contents minus phone numbers

### 3. Phone verification (OTP)
- **What:**
  - After @tamu.edu login, user can enter phone number
  - Send OTP via Twilio (or similar: Vonage, etc.)
  - On verification: update `users.phone` and `users.phone_verified_at`
  - Phone number is now linked to their account
- **Done when:**
  - User can enter phone, receive OTP, verify
  - Verified phone stored in users table
  - Rate limiting on OTP sends (prevent abuse)

### 4. Reveal contacts after phone verify
- **What:**
  - In cluster detail view, phone-verified users see full phone numbers of all posters
  - Non-verified users see "Verify your phone to see contact details" CTA
  - Log every contact reveal: who viewed whose number, when (new table `contact_views`)
- **Why:** This is the core value exchange — verify your identity to see others' identity
- **Done when:**
  - Phone-verified users see numbers
  - Non-verified see redacted numbers with verify CTA
  - Contact reveals are logged

---

## New Supabase tables

```sql
-- Users (email + optional phone)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  phone_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Contact reveal log
CREATE TABLE contact_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_user_id UUID REFERENCES users(id),
  viewed_contact TEXT,  -- phone number they viewed
  cluster_key TEXT,     -- which cluster context
  viewed_at TIMESTAMPTZ DEFAULT now()
);
```

---

## NOT in this sprint
- Post claiming and editing (Sprint 5.3)
- Cluster tracking / notifications (Sprint 5.3)
- Silent demand capture (Sprint 5.3)
- Outbound messaging (Sprint 5.4)

## Version
Target: v3.9.0
