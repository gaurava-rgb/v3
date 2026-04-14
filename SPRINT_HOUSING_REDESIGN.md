# Sprint: Housing Board Redesign → Deploy to ridesplit.app/housing

## Goal
Replace the current housing board UI (old grid card style) with the new clusters-style design from `mockup-housing.html`.

## What's Done
- `mockup-housing.html` — fully updated mockup, ready to use as the design reference. Open it in a browser to preview.

### Mockup features (all need to be ported to `lib/views.js`):
- System font, 640px max-width single column (same as /clusters)
- Collapsible listing cards with chevron (tap to expand, `max-height` animation)
- Left colored border: red for sublease, green for roommate, blue for lease transfer
- Collapsed state: property name + type pill + price pill + freshness pill + one-line summary
- Expanded state: detail rows (Available, Beds/Bath, Posted by + sent timestamp), amenity pills, italic WA snippet, then auth gate
- **Posted by** includes sent timestamp subscript: `Apr 14, 2026 · 9:32 AM CDT` in user's local time
- Two-row sticky filter bar:
  - Row 1 `Type`: All / Sublease / Roommate / Lease Transfer (exclusive, radio-style)
  - Row 2 `City`: Bryan / College Station (toggle, click again to deactivate)
  - AND logic: type filter AND city filter applied simultaneously
- Auth gate (inline inside card when expanded): single "Sign in with @tamu.edu" button only (no duplicate secondary button)
- Section labels (sticky, color-coded) between type groups

## What Needs to Be Done

### 1. Port `renderHousingBoard()` in `lib/views.js` (lines 712–858)
Replace the entire function with the new clusters-style HTML. Key things to wire up:

**Data fields available on each listing row:**
- `l.listing_type` — 'sublease', 'roommate', 'lease_transfer'
- `l.location` — property name/area string (e.g. "The Stack, Bryan")
- `l.price` — number (monthly)
- `l.bedrooms`, `l.bathrooms` — numbers or null
- `l.available_date`, `l.end_date` — date strings
- `l.sender_name` — poster display name
- `l.created_at` — ISO timestamp (use for freshness pill + sent-at display)
- `l.slug` — for detail page link (`/listing/:slug`)
- `l.amenities` — array of strings or null
- `l.message_text` — original WA message (show as italic snippet)
- `l.source_group` or `l.contact_info` — WA group name if available

**City filter:** No `city` column in DB. Derive from `l.location` string:
- If location contains "Bryan" (case-insensitive) → `data-city="bryan"`
- If location contains "College Station" or "CS" → `data-city="college-station"`
- Otherwise → no `data-city` (won't match either city filter, stays visible when no city filter active)

**Sent-at timestamp format:** Convert `l.created_at` to Central time:
```js
new Date(l.created_at).toLocaleString('en-US', {
  timeZone: 'America/Chicago',
  month: 'short', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true
})
// e.g. "Apr 14, 2026, 9:32 AM" — append CDT or CST based on offset
```

**Freshness pill logic** (same as existing `relTime`/`freshClass` helpers in views.js):
- < 2 days → `pill-fresh` ("today" / "1d ago")
- 2–5 days → neutral stale color
- older → `pill-stale`

**Grouping:** Listings come back newest-first from DB. Group them into three buckets — sublease, roommate, lease_transfer — and render each bucket with its section label. The type filter is now client-side JS (no page reload), so fetch all active listings regardless of type param.

**Section label sticky `top`:** Set to `75px` (two filter rows height).

### 2. Fix the detail page auth gate in `lib/views.js` (line 959)
Remove the duplicate "Already have an account? Sign in" button. Only keep:
```js
'    <a class="btn-primary" href="/login">Sign in with TAMU email</a>',
```
(Line ~959 has both buttons currently.)

### 3. Route change in `routes/housing.js`
The board now handles type filtering client-side, so the `?type=` query param is no longer needed for rendering. But keep it for now for backwards compat — just always fetch all listings:
```js
var listings = await getActiveListings({ listing_type: null }); // always fetch all
```

### 4. Deploy
```
git add lib/views.js routes/housing.js
git commit -m "Housing board: clusters-style redesign with collapsible cards, two-row filters"
ssh agconnect "cd ~/aggieconnect-v3 && git pull && pm2 restart ecosystem.config.js"
```

## Reference Files
- `mockup-housing.html` — the full working HTML mockup (open in browser to verify)
- `lib/views.js` — `renderHousingBoard()` starts at line 712, `renderListingPage()` at line 863
- `routes/housing.js` — thin route, calls `renderHousingBoard` and `renderListingPage`
- `lib/housing.js` — `getActiveListings()` and `getListingBySlug()`, data schema

## CSS to Copy Verbatim (from mockup-housing.html)
All CSS is self-contained in the mockup. When porting to `views.js`, inline it as a template string the same way `clusters.js` does with its `CSS` variable.
