# Sprint 5.1 — Cluster Board + Auth Ladder

**Status:** IN PROGRESS — Level 0 + Level 1 deployed

## Goal
Replace the flat request table with a cluster-based board that groups rides by day + origin + destination. Layer access controls so each step gives the user something before asking for the next thing. Capture silent demand from people who never posted in WhatsApp.

## Prior sprint
Sprint 5 (lifecycle/dedup) — parked. Dedup analysis showed no real data loss in 15 days. Sprint 5 items remain valid but not urgent until outbound messaging is live.

## Context (from product discussion)

### What is a cluster?
A cluster = same day + same origin corridor + same destination corridor. NOT just destination — Dallas→CS and Austin→CS are different clusters because those people can't share a ride.

### Corridor grouping
Nearby locations cluster together under a corridor label:
- Dallas area: Dallas, Dallas DFW, Plano, Frisco, Richardson, Irving, Lewisville, Fort Worth
- Houston area: Houston, Houston IAH, Houston Hobby
- Austin area: Austin, Austin Airport
- College Station: College Station, Bryan
- San Antonio: San Antonio

Individual post still shows specific origin (e.g., "from Plano") but the cluster header says "Dallas area → College Station".

### Real data validation (Mar 7–22, 2026)
- 193 requests in 15 days
- 33 clusters with 2+ posts (77% of all posts land in multi-person clusters)
- 22 clusters had both a need AND an offer
- Best example: Mar 21, CS→Houston IAH — 1 offer at 10 AM, 3 needs all at 11 AM

---

## Auth Ladder (what each level sees)

### Level 0: No login (public board)
- Cluster headers only: "Dallas area → College Station · Sat, Mar 21 · 4 people"
- Need/offer counts per cluster
- No names, no messages, no timing
- CTA: "Sign in with @tamu.edu to see details"

### Level 1: @tamu.edu login
- Everything from Level 0, plus:
- Can click into a cluster to see inside
- Inside cluster: first names, original messages, timing info, need vs offer
- Phone numbers still hidden
- CTA: "Verify your phone to see contact details"

### Level 2: Phone verified
- Everything from Level 1, plus:
- Full phone numbers visible in any cluster
- If their phone matches a scraped WhatsApp post → "This looks like your post" → can claim and edit it (add time, update details)
- Can track a cluster for updates (even if they have no post in it — this captures silent demand)
- CTA on claimed post: "Edit your listing"
- CTA on cluster with no own post: "Track this route for updates"

### Key principle
Each step gives before it asks. Email gives cluster details. Clicking in gives context. Phone gives contacts. Tracking gives notifications. Nobody does work for free.

---

## Tasks

### 1. Normalize.js — Add corridor grouping + missing aliases
- **File:** `normalize.js`
- **What:**
  - Add missing aliases: `lewisville`, `fort worth` (standalone), `dfw airport`, `c-stat`, `mckinney`, `garland`, `arlington`
  - Add `CORRIDOR_MAP` grouping nearby normalized locations into corridors
  - Add `getClusterCorridor(normalizedLocation)` function → returns corridor name
  - Keep specific normalized name for display, corridor name for grouping
- **Done when:**
  - `getClusterCorridor('Plano')` returns `'Dallas area'`
  - `getClusterCorridor('Houston IAH')` returns `'Houston area'`
  - `getClusterCorridor('College Station')` returns `'College Station'`
  - Existing `normalizeLocation()` behavior unchanged
  - `areNearby()` still works

### 2. Cluster grouping query
- **File:** new `lib/clusters.js`
- **What:**
  - Query `v3_requests` where `request_status = 'open'`
  - Group by: `ride_plan_date` + `getClusterCorridor(request_origin)` + `getClusterCorridor(request_destination)`
  - Return structure: `{ date, originCorridor, destCorridor, posts: [...], needCount, offerCount }`
  - Sort: soonest date first, largest cluster first within a day
  - Filter: only future dates (or today)
- **Done when:**
  - Returns real clusters from Supabase data
  - Clusters use corridor grouping (Plano + Dallas + DFW in same cluster)
  - Origin is included in grouping (Dallas→CS and Austin→CS are separate)
  - Each post retains its specific origin/destination for display

### 3. Cluster board route (no auth, gated by sharing link)
- **File:** `routes/clusters.js`, new template or EJS view
- **What:**
  - New GET `/clusters` route on the dashboard
  - Renders cluster board using real data from task 2
  - For v1: no auth — but designed so info can be layered (right now show everything, gate later)
  - Show: day headers → cluster cards → need/offer sections inside
  - Each cluster card: origin→dest header, need/offer count pills, posts with name + message + timing
  - Log cluster page views (which clusters exist, total views)
- **Why:** Get the UI in front of real users to validate that cluster grouping makes sense with live data
- **Done when:**
  - `/clusters` renders a live cluster board from Supabase
  - Layout matches the compact mockup style (day → cluster → posts)
  - Mobile responsive
  - Works on ridesplit.app after deploy

### 4. Cluster click-through tracking
- **File:** `routes/clusters.js`
- **What:**
  - Each cluster has a "View details" link/button
  - Clicking logs: cluster route, cluster date, timestamp, session/IP (no auth needed yet)
  - Store in new Supabase table `cluster_views` (cluster_key, viewed_at, viewer_ip or session_id)
  - This gives signal on which routes have real interest even before auth exists
- **Why:** When you share the board link with specific people, you can see what they clicked on. Interest data without auth.
- **Done when:**
  - Clicking a cluster logs the view
  - Can query: "which clusters got the most views this week?"

---

## NOT in this sprint (parked for later)

- Phone verification / OTP (Sprint 5.2)
- Post claiming and editing (Sprint 5.3)
- Cluster tracking / notifications (Sprint 5.3)
- "We'll send you updates" outbound messaging (Sprint 5.4)
- Silent demand capture (needs phone verify first)
- Sprint 5 items (request expiry, dedup hash, don't-close-on-match) — not urgent until outbound is live

## Version
Target: v3.8.0

## Verification checklist
- [x] `getClusterCorridor()` correctly groups Dallas suburbs, Houston airports, etc.
- [x] Clusters group by day + origin corridor + dest corridor (not just destination)
- [x] `/clusters` renders real data from Supabase
- [x] Cluster board is mobile responsive
- [ ] Click-through logging captures which clusters get viewed (Task 4 — next)
- [x] Existing dashboard, bot, and parser are unaffected
- [x] `npm test` passes
- [x] Level 1: logged-in users can expand clusters to see names, messages, timing
- [x] Level 1: phone numbers hidden behind "verify phone" CTA
- [x] Auth banner updates based on login state
- [x] Login flow redirects back to /clusters after verification
