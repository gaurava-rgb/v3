# RideSplit — Build Digest

**Project**: Aggie Connect Baileys v3 → **RideSplit** (ridesplit.app)
**Timeline**: Feb 24 – Mar 3, 2026 (8 days)
**Commits**: 42 across 3 major versions
**Codebase**: ~3,300 lines across 7 files
**Live**: ridesplit.app | VPS via PM2

---

## What We Built

A real-time ride-sharing board for Texas A&M students. A WhatsApp bot monitors 15+ ride-share groups, an LLM parses every message for ride intent, and a public website shows all active rides — searchable, color-coded, and mobile-friendly.

### Live Stats (as of Mar 3)
- **116 ride requests** parsed and stored
- **278 messages** processed
- **34 matches** found (need↔offer)
- **16 active WhatsApp groups** monitored
- **76 rides tracked** this week alone

---

## Version History

### v3.0 — Foundation (Feb 24–25)
The core pipeline: WhatsApp → LLM → Supabase → Dashboard.

- **bot.js** — Baileys linked-device WhatsApp client
- **parser.js** — OpenRouter LLM extracts ride intent, dates, times, locations
- **db.js** — Supabase CRUD with SHA256 dedup, contact resolution
- **matcher.js** — Matches needs↔offers, scores as strong/medium/low
- **normalize.js** — Location name normalization (Bryan↔College Station, airport codes)
- **monitor.js** — PM2 health dashboard on port 3005

### v3.1 — LID Resolution + Dashboard (Feb 25–27)
Solved the Baileys LID→phone mapping problem without upgrading packages. Three untapped data sources in Baileys 6.7.21 were already available.

- LID→phone resolution via `participantPn`, group metadata, `phoneNumberShare` events
- Retroactive backfill of old rows when new mappings arrive
- Public ride board (port 3004) with date clustering
- Admin digest page (/digest) with same-way clusters
- Strict date matching, timezone fix (America/Chicago), live clock
- Google Analytics integration
- Test group filtering via `is_test` column

### v3.2 — The Spreadsheet Redesign (Feb 28 – Mar 1)
Transformed the dashboard from basic cards into a live, color-coded spreadsheet.

- **Spreadsheet table layout** — rows with emoji indicators (✋ looking, 🚗 offering)
- **Color-coded direction bands** — green "LEAVING CS", red "COMING TO CS", gray "OTHER"
- **Sticky date headers** with leaving/arriving summary counts + `·` delimiter
- **Email OTP auth** — @tamu.edu login reveals full names/phone numbers
- **Separate auth Supabase client** to prevent query poisoning
- **Sticky legend bar** with live clock, emoji key, auth link
- **/terms** and **/faq** static pages

### v3.3 — Web Form + Polish (Mar 2–3)
The big one. Users can now post rides directly on the website, not just through WhatsApp.

- **Material Design FAB** (Floating Action Button) — maroon circle, bottom-right
- **Ride submission form** — slide-up modal with:
  - Type toggle (Looking / Offering) as segmented control
  - Origin/destination dropdowns (10 locations + "Other" free text)
  - Date, name, phone, preferred time, comments
  - Same `saveRequest()` → `processRequest()` pipeline as WhatsApp messages
  - `source: 'web-form'` tag for attribution
- **Auth gate** — only @tamu.edu authenticated users can submit
- **Sign-in tooltip** for unauthenticated users on FAB click
- **Field-level error highlighting** — red borders on invalid fields, auto-scroll to top
- **Mandatory field asterisks** — red `*` on required fields
- **Auth banner** — yellow bar for logged-out users explaining redacted data
- **Value prop tagline** — "Find someone going your way. Updated in real time from WhatsApp groups."
- **Dynamic FAQ** — groups list queried live from `monitored_groups` table
- **FAQ #8** — "Is this made by AI?" with Jeremiah Johnson nod meme
- **Mobile responsive** — stacked legend, scrollable tables, smaller FAB, bottom-sheet form
- **www.ridesplit.app** redirect via Cloudflare edge rule
- **Google Analytics** (G-MC6FDBQ4MZ) on all 5 pages

---

## Architecture

```
WhatsApp Groups (15+)
        │
        ▼
    bot.js (Baileys linked device)
        │
        ▼
    parser.js (OpenRouter LLM)
        │
        ▼
    db.js → Supabase (v3_requests, v3_matches, v3_message_log)
        │
        ▼
    matcher.js (need↔offer scoring)
        │
        ▼
    dashboard.js (Express, port 3004)
        │
        ├── GET  /         → public ride board (spreadsheet)
        ├── GET  /login    → @tamu.edu OTP
        ├── POST /verify   → OTP verification
        ├── POST /submit   → ride form submission  ← NEW (v3.3)
        ├── GET  /digest   → admin match digest
        ├── GET  /terms    → terms of service
        └── GET  /faq      → FAQ (dynamic groups)

    monitor.js (PM2 health, port 3005)
```

**Dual data pipeline** (v3.3):
```
WhatsApp msg  → parser.js → saveRequest() → processRequest() → matches
Web form      → POST /submit → saveRequest() → processRequest() → matches
```
Same table, same dedup, same matching. Only `source` differs.

---

## Tech Stack

| Layer | Tech |
|---|---|
| WhatsApp | Baileys 6.7.21 (linked device) |
| LLM | OpenRouter (Claude) |
| Database | Supabase (PostgreSQL) |
| Backend | Express.js (inline HTML, no template engine) |
| Auth | Supabase email OTP, @tamu.edu gate |
| DNS/CDN | Cloudflare (proxy + redirect rules) |
| Hosting | VPS, PM2, Nginx reverse proxy |
| Analytics | Google Analytics 4 |

---

## Supabase Schema

| Table | Purpose |
|---|---|
| `v3_requests` | Parsed ride requests (need/offer, locations, dates) |
| `v3_matches` | Need↔offer matches with quality score |
| `v3_message_log` | Raw WhatsApp messages for audit |
| `outbound_queue` | Future: outbound notification queue |
| `wa_contacts` | LID→phone mappings from Baileys |
| `monitored_groups` | Active WhatsApp groups being tracked |

---

## Value Realization Analysis

### 1. Value Clarity 🟢

**Can students articulate why they'd use RideSplit?**

Yes — immediately. "I can see who's driving my route this weekend without scrolling through 15 WhatsApp groups." The value proposition is concrete, not abstract. It's not "ride-share optimization" — it's "find someone going your way."

The spreadsheet layout makes this visceral: open the site, see color-coded rows of real rides happening today and tomorrow. Green = leaving College Station, red = coming back. Emoji tells you if they're looking or offering. It takes 3 seconds to understand.

**Compared to the alternative** (manually checking WhatsApp groups): a student currently has to scroll through 15+ group chats, mentally parse unstructured messages ("hey anyone going to Houston Friday? can take 2"), and remember who said what. RideSplit does this automatically and shows it all in one place.

The @tamu.edu auth gate is also a value signal — "this is for us, by us." Campus identity creates instant trust.

### 2. Value Timeline 🟢

**Is the value immediate?**

Near-instant. Visit ridesplit.app → see active rides → find your route → contact the person. There's no onboarding, no account creation barrier (view is public), and no content cold-start problem because the bot is already monitoring 15 active groups with 76+ rides this week.

The web form (v3.3) further shortens the timeline: instead of joining a WhatsApp group and posting there, a student can post directly from the browser. Form → Supabase → visible on the board within seconds.

**Critical advantage**: The WhatsApp bot creates a passive content flywheel. Students don't need to "adopt" RideSplit for it to have content — the ride data comes from WhatsApp groups that already exist and are already active. Zero chicken-and-egg problem.

### 3. Value Perception 🟢

**Can students see/feel the value?**

Very tangible:
- The homepage counter: "Tracking **76 ride requests** across **15 WhatsApp groups** this week"
- Color-coded rows with real names, real routes, real dates
- Sticky date headers with counts: "Today, Mon, Mar 3 · 5 leaving · 3 arriving"
- Match notifications (future: outbound queue)

The spreadsheet layout was a deliberate design choice — it communicates density and activity. A page full of rides feels different from a page with 3 cards. It signals "this is alive, people are using this."

For authenticated users, seeing unredacted names and phone numbers is the "aha" — suddenly these aren't anonymous rows, they're classmates you can text right now.

### 4. Value Discovery 🟡

**Do students already know they want this?**

Partially. Students already know the pain (scrolling WhatsApp groups is annoying), but they may not know RideSplit exists or that it solves it. The main discovery challenge is distribution — getting the URL in front of students who need rides.

**What helps discovery:**
- The FAQ link and value prop tagline on the homepage
- The @tamu.edu auth gate signals legitimacy
- Word of mouth from WhatsApp group members who notice their messages appearing
- The FAB + web form creates a reason to return (not just view, but post)

**What could improve discovery:**
- Sharing/referral from the board (e.g., "share this ride" link)
- WhatsApp group announcements pointing to the website
- TAMU student org partnerships for distribution
- SEO for "TAMU rides" / "College Station rideshare"

### Summary

| Dimension | Status | Why |
|---|---|---|
| Value Clarity | 🟢 Strong | "Find someone going your way" — concrete, immediate |
| Value Timeline | 🟢 Strong | View rides instantly, no onboarding, passive content flywheel |
| Value Perception | 🟢 Strong | Live counters, color-coded rows, real names after auth |
| Value Discovery | 🟡 Medium | Pain is known, but distribution to students needs work |

**Biggest strength**: No cold-start problem. The WhatsApp bot generates content passively — students are already posting in those groups. RideSplit simply makes it visible and searchable.

**Biggest opportunity**: The web form (v3.3) transforms RideSplit from a read-only board into a two-way platform. Students who find rides through the site can also post rides through it, potentially reducing dependency on WhatsApp as the sole content source.

**Risk to watch**: If WhatsApp groups go quiet (end of semester, summer), the board thins out. The web form is the hedge — it creates a direct submission channel independent of WhatsApp activity.

---

## What's Next (Backlog)

1. **Outbound notifications** — `outbound_queue` table is ready; bot sends match alerts via WhatsApp
2. **Share a ride** — deep links from individual ride rows
3. **Match quality UI** — show strong/medium/low match badges on the board
4. **Ride expiry** — auto-archive rides after their date passes
5. **Bryan↔CS normalization** — edge case in location mapping
6. **SEO + distribution** — meta tags, OG images, student org partnerships
7. **Analytics dashboard** — route popularity, peak posting times, match rate

---

*Built Feb 24 – Mar 3, 2026. 42 commits. 3,300 lines. 1 WhatsApp bot. 0 frameworks.*
