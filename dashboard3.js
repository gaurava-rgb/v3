/**
 * Aggie Connect — Trip Cluster Dashboard (Dashboard 3) v3
 * Groups ride requests into clusters by route + date overlap.
 * Displays match quality tiers (Strong / Medium / Low) and conversion gap banners.
 * Port: 3006
 */

require('dotenv').config();

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.DASH3_PORT || 3006;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ── helpers ────────────────────────────────────────────────────────────────

function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function redactPhone(phone) {
    if (!phone) return '';
    const s = String(phone).trim();
    const digits = s.replace(/\D/g, '');
    if (digits.length <= 3) return s;
    const prefix = s.startsWith('+') ? '+' : '';
    const shown = digits.slice(0, 2) + '*'.repeat(digits.length - 3) + digits.slice(-1);
    return prefix + shown;
}

function redactName(name) {
    if (!name) return '';
    const s = String(name).trim();
    if (s.length <= 2) return s;
    return s[0] + '*'.repeat(s.length - 2) + s[s.length - 1];
}

function redactContact(contact) {
    if (!contact) return '';
    const s = String(contact).trim();
    if (/^\+?\d[\d\s\-]{5,}/.test(s)) return redactPhone(s);
    return redactName(s);
}

function formatDate(d, fuzzy = false) {
    if (!d) return fuzzy ? 'Flexible date' : 'Flexible';
    const date = new Date(d + 'T00:00:00');
    const base = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return fuzzy ? `~${base}` : base;
}

function formatTime(t, fuzzy = false) {
    if (!t) return fuzzy ? 'time TBD' : '';
    // Convert HH:MM to 12h display
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── cluster computation ────────────────────────────────────────────────────

/**
 * Compute cluster quality from a set of requests.
 * Strong: all confirmed dates (exact) + all confirmed times
 * Medium: all confirmed dates (exact), but ≥1 time is fuzzy/missing
 * Low: any fuzzy date, or dates spread by ≥1 day
 */
function computeClusterQuality(members) {
    const anyDateFuzzy = members.some(m => m.date_fuzzy);
    if (anyDateFuzzy) return 'low';

    const dates = members.map(m => m.ride_plan_date).filter(Boolean);
    if (dates.length === 0) return 'low';

    const uniqueDates = new Set(dates);
    if (uniqueDates.size > 1) {
        // Check if all dates are within 1 day of each other
        const sorted = [...uniqueDates].sort();
        const first = new Date(sorted[0]);
        const last  = new Date(sorted[sorted.length - 1]);
        const diff = (last - first) / 86400000;
        return diff <= 1 ? 'low' : 'low'; // ±1 day apart is still low (per spec)
    }

    // All dates identical and confirmed
    const anyTimeFuzzy = members.some(m => m.time_fuzzy !== false || !m.ride_plan_time);
    return anyTimeFuzzy ? 'medium' : 'strong';
}

/**
 * Determine the conversion gap banner message for a cluster.
 * Returns the highest-priority gap, or null if none.
 */
function getConversionGap(members, driver) {
    const anyDateFuzzy = members.some(m => m.date_fuzzy);
    const dates = members.map(m => m.ride_plan_date).filter(Boolean);
    const uniqueDates = new Set(dates);

    if (!driver) {
        return "No driver yet — someone could offer this route";
    }
    if (anyDateFuzzy) {
        return "Someone's date is flexible — confirm to lock in";
    }
    if (uniqueDates.size > 1) {
        const sorted = [...uniqueDates].sort();
        const first = new Date(sorted[0]);
        const last  = new Date(sorted[sorted.length - 1]);
        const diff = Math.round((last - first) / 86400000);
        if (diff === 1) return "Dates are 1 day apart — one person can flex";
    }

    const riders = members.filter(m => m.request_type === 'need');
    const driverTimeFuzzy = driver.time_fuzzy !== false || !driver.ride_plan_time;
    const riderTimeFuzzy  = riders.some(m => m.time_fuzzy !== false || !m.ride_plan_time);

    if (driverTimeFuzzy && riderTimeFuzzy) return "Neither side has confirmed time yet";
    if (driverTimeFuzzy) return "Driver hasn't shared departure time";
    if (riderTimeFuzzy)  return "Rider(s) haven't shared their time";

    return null;
}

/**
 * Check if two requests' dates overlap (considering fuzzy ranges).
 */
function datesOverlap(a, b) {
    if (!a.ride_plan_date && !b.ride_plan_date) return true;
    if (!a.ride_plan_date || !b.ride_plan_date) return true; // one has no date — assume overlap

    if (a.ride_plan_date === b.ride_plan_date) return true;

    // Fuzzy overlap: a's possible_dates includes b's date, or vice versa
    if (a.date_fuzzy && (a.possible_dates || []).includes(b.ride_plan_date)) return true;
    if (b.date_fuzzy && (b.possible_dates || []).includes(a.ride_plan_date)) return true;

    // ±1 day proximity counts as a cluster candidate
    const da = new Date(a.ride_plan_date);
    const db = new Date(b.ride_plan_date);
    const diff = Math.abs((da - db) / 86400000);
    return diff <= 1;
}

/**
 * Build trip clusters from a flat list of requests.
 * Groups by (origin, destination) then by date overlap within each route.
 */
function buildClusters(requests) {
    // Group by route
    const byRoute = {};
    for (const r of requests) {
        const key = (r.request_origin || '?') + '|' + (r.request_destination || '?');
        if (!byRoute[key]) byRoute[key] = { origin: r.request_origin || '?', destination: r.request_destination || '?', members: [] };
        byRoute[key].members.push(r);
    }

    const clusters = [];

    for (const route of Object.values(byRoute)) {
        // Sub-group by date overlap within the route (union-find style grouping)
        const members = route.members;
        const assigned = new Array(members.length).fill(-1);
        let clusterIdx = 0;

        for (let i = 0; i < members.length; i++) {
            if (assigned[i] !== -1) continue;
            assigned[i] = clusterIdx;
            for (let j = i + 1; j < members.length; j++) {
                if (assigned[j] !== -1) continue;
                if (datesOverlap(members[i], members[j])) {
                    assigned[j] = clusterIdx;
                }
            }
            clusterIdx++;
        }

        // Build cluster objects
        const clusterMap = {};
        for (let i = 0; i < members.length; i++) {
            const ci = assigned[i];
            if (!clusterMap[ci]) clusterMap[ci] = [];
            clusterMap[ci].push(members[i]);
        }

        for (const clusterMembers of Object.values(clusterMap)) {
            const driver = clusterMembers.find(m => m.request_type === 'offer') || null;
            const quality = computeClusterQuality(clusterMembers);
            const gap = getConversionGap(clusterMembers, driver);

            // Representative date: driver's date, or earliest member date
            const dates = clusterMembers.map(m => m.ride_plan_date).filter(Boolean).sort();
            const repDate = driver?.ride_plan_date || dates[0] || null;
            const repTime = driver?.ride_plan_time || null;
            const repTimeFuzzy = driver ? (driver.time_fuzzy !== false || !driver.ride_plan_time) : null;

            clusters.push({
                origin: route.origin,
                destination: route.destination,
                members: clusterMembers,
                driver,
                riders: clusterMembers.filter(m => m.request_type === 'need'),
                quality,
                gap,
                repDate,
                repTime,
                repTimeFuzzy
            });
        }
    }

    // Sort within quality groups by date
    clusters.sort((a, b) => {
        const qOrder = { strong: 0, medium: 1, low: 2 };
        const qDiff = (qOrder[a.quality] || 0) - (qOrder[b.quality] || 0);
        if (qDiff !== 0) return qDiff;
        return (a.repDate || '9999') < (b.repDate || '9999') ? -1 : 1;
    });

    return clusters;
}

// ── data fetchers ──────────────────────────────────────────────────────────

async function getData() {
    const today = new Date().toISOString().split('T')[0];

    const [{ data: requests }, { data: groups }] = await Promise.all([
        supabase
            .from('v3_requests')
            .select('*')
            .eq('request_category', 'ride')
            .or(`ride_plan_date.gte.${today},date_fuzzy.eq.true,ride_plan_date.is.null`)
            .order('created_at', { ascending: false }),
        supabase
            .from('monitored_groups')
            .select('group_id')
            .eq('active', true)
    ]);

    const reqs = requests || [];
    const clusters = buildClusters(reqs);

    const strong = clusters.filter(c => c.quality === 'strong');
    const medium = clusters.filter(c => c.quality === 'medium');
    const low    = clusters.filter(c => c.quality === 'low');

    return {
        clusters, strong, medium, low,
        totalRequests: reqs.length,
        totalGroups: (groups || []).length,
        openNeeds:  reqs.filter(r => r.request_type === 'need'  && r.request_status === 'open'),
        openOffers: reqs.filter(r => r.request_type === 'offer' && r.request_status === 'open')
    };
}

// ── HTML rendering ─────────────────────────────────────────────────────────

function renderMemberRow(m, isDriver = false) {
    const dateStr = formatDate(m.ride_plan_date, m.date_fuzzy);
    const timeStr = formatTime(m.ride_plan_time, m.time_fuzzy);
    const timeFuzzy = m.time_fuzzy !== false || !m.ride_plan_time;

    if (isDriver) {
        return `<div class="member-row driver-row">
          <span class="driver-icon">🚗</span>
          <span class="member-contact">${escHtml(redactContact(m.source_contact))}</span>
          <span class="member-meta">
            ${dateStr}
            ${timeStr ? `· ${escHtml(timeStr)}` : ''}
            ${timeFuzzy ? '<span class="fuzzy-tag">time TBD</span>' : ''}
            ${m.date_fuzzy ? '<span class="fuzzy-tag">date flex</span>' : ''}
          </span>
        </div>`;
    }

    return `<div class="member-row">
      <span class="member-dot">●</span>
      <span class="member-contact">${escHtml(redactContact(m.source_contact))}</span>
      <span class="member-meta">
        ${dateStr}
        ${timeStr ? `· ${escHtml(timeStr)}` : ''}
        ${timeFuzzy ? '<span class="fuzzy-tag">time TBD</span>' : ''}
        ${m.date_fuzzy ? '<span class="fuzzy-tag">date flex</span>' : ''}
      </span>
    </div>`;
}

function renderCluster(c) {
    const qConfig = {
        strong: { dot: '🟢', label: 'STRONG', border: '#22c55e', bg: '#f0fdf4' },
        medium: { dot: '🟡', label: 'MEDIUM', border: '#f59e0b', bg: '#fffbeb' },
        low:    { dot: '🔴', label: 'LOW',    border: '#ef4444', bg: '#fef2f2' }
    };
    const q = qConfig[c.quality] || qConfig.medium;
    const noDriver = !c.driver;
    const borderStyle = noDriver
        ? `border: 1px dashed #ccc; border-left: 3px dashed ${q.border}`
        : `border: 1px solid #e5e5e5; border-left: 3px solid ${q.border}`;

    const repDateStr = formatDate(c.repDate, c.members.some(m => m.date_fuzzy));
    const repTimeStr = c.repTime ? formatTime(c.repTime) : (c.repTimeFuzzy === true ? 'time TBD' : '');

    return `<div class="cluster-card" style="${borderStyle}">
      <div class="cluster-header">
        <div class="cluster-title">
          <strong>${escHtml(c.origin)} → ${escHtml(c.destination)}</strong>
          <span class="cluster-date">${repDateStr}${repTimeStr ? ' · ' + escHtml(repTimeStr) : ''}</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          ${noDriver ? '<span class="no-driver-badge">No driver yet</span>' : ''}
        </div>
      </div>

      <div class="cluster-members">
        ${c.driver ? renderMemberRow(c.driver, true) : ''}
        ${c.riders.map(r => renderMemberRow(r, false)).join('')}
      </div>

      ${c.gap ? `<div class="gap-banner">${escHtml(c.gap)}</div>` : ''}
    </div>`;
}

function renderOpenRow(r) {
    const timeFuzzy = r.time_fuzzy !== false || !r.ride_plan_time;
    const dateStr = r.ride_plan_date
        ? (r.date_fuzzy ? `~${formatDate(r.ride_plan_date)}` : formatDate(r.ride_plan_date))
        : 'Flexible';

    return `<div class="open-row">
      <div class="open-route">${escHtml(r.request_origin || '?')} → ${escHtml(r.request_destination || '?')}</div>
      <div class="open-meta">
        ${escHtml(redactContact(r.source_contact))}
        · ${escHtml(r.source_group || '')}
      </div>
      <div class="open-tags">
        <span class="open-date">${dateStr}</span>
        ${r.date_fuzzy ? '<span class="fuzzy-tag">🗓 flex</span>' : ''}
        ${timeFuzzy ? '<span class="fuzzy-tag">🕐 TBD</span>' : ''}
      </div>
    </div>`;
}

// ── route ──────────────────────────────────────────────────────────────────

app.get('/', async (req, res) => {
    try {
        const { clusters, strong, medium, low, totalRequests, totalGroups, openNeeds, openOffers } = await getData();

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Aggie Connect v3 — Trip Clusters</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f8f8; color: #1a1a1a; line-height: 1.5; }
  .container { max-width: 960px; margin: 0 auto; padding: 24px 16px; }
  h1 { font-size: 20px; font-weight: 600; letter-spacing: -0.3px; }
  h1 span { color: #888; font-weight: 400; }
  .nav-links { font-size: 12px; color: #888; margin-top: 4px; }
  .nav-links a { color: #3b82f6; text-decoration: none; margin-right: 12px; }
  .stats { display: flex; gap: 12px; margin: 20px 0; flex-wrap: wrap; }
  .stat { background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px 16px; min-width: 90px; }
  .stat-val { font-size: 22px; font-weight: 600; }
  .stat-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-strong .stat-val { color: #16a34a; }
  .stat-medium .stat-val { color: #d97706; }
  .stat-low    .stat-val { color: #dc2626; }
  .section { margin-top: 32px; }
  .section-title { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 12px; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px; display: flex; align-items: center; gap: 8px; }
  .cluster-card { background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
  .cluster-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
  .cluster-title { display: flex; flex-direction: column; gap: 2px; }
  .cluster-title strong { font-size: 15px; }
  .cluster-date { font-size: 12px; color: #666; }
  .no-driver-badge { font-size: 11px; color: #6b7280; background: #f3f4f6; border: 1px dashed #d1d5db; padding: 2px 8px; border-radius: 4px; white-space: nowrap; }
  .cluster-members { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
  .member-row { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 3px 0; }
  .driver-row { font-weight: 500; }
  .driver-icon { font-size: 14px; }
  .member-dot { color: #9ca3af; font-size: 10px; width: 14px; text-align: center; }
  .member-contact { color: #1a1a1a; min-width: 80px; }
  .member-meta { color: #6b7280; font-size: 12px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .fuzzy-tag { font-size: 10px; color: #9333ea; background: #f3e8ff; padding: 1px 5px; border-radius: 3px; }
  .gap-banner { margin-top: 8px; padding: 6px 10px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; font-size: 12px; color: #92400e; }
  .quality-group { margin-bottom: 24px; }
  .quality-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
  .empty { color: #aaa; font-size: 14px; padding: 20px; text-align: center; background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .open-row { background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; }
  .open-route { font-size: 14px; font-weight: 500; }
  .open-meta { font-size: 12px; color: #888; margin-top: 2px; }
  .open-tags { display: flex; gap: 6px; align-items: center; margin-top: 4px; flex-wrap: wrap; }
  .open-date { font-size: 12px; color: #555; background: #f0f0f0; padding: 1px 7px; border-radius: 3px; }
  .refresh { float: right; font-size: 12px; color: #888; text-decoration: none; border: 1px solid #ddd; padding: 4px 12px; border-radius: 4px; }
  .refresh:hover { background: #f0f0f0; }
  @media (max-width: 640px) { .two-col { grid-template-columns: 1fr; } .stats { gap: 8px; } .stat { min-width: 70px; padding: 8px 12px; } }
</style>
</head>
<body>
<div class="container">
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <h1>Aggie Connect <span>v3 — Trip Clusters</span></h1>
      <div class="nav-links">
        <a href="http://localhost:3004">Dashboard</a>
        <a href="http://localhost:3005">Monitor</a>
      </div>
    </div>
    <a href="/" class="refresh">Refresh</a>
  </div>

  <div class="stats">
    <div class="stat"><div class="stat-val">${totalRequests}</div><div class="stat-label">Requests</div></div>
    <div class="stat"><div class="stat-val">${clusters.length}</div><div class="stat-label">Clusters</div></div>
    <div class="stat stat-strong"><div class="stat-val">${strong.length}</div><div class="stat-label">Strong</div></div>
    <div class="stat stat-medium"><div class="stat-val">${medium.length}</div><div class="stat-label">Medium</div></div>
    <div class="stat stat-low"><div class="stat-val">${low.length}</div><div class="stat-label">Low</div></div>
    <div class="stat"><div class="stat-val">${totalGroups}</div><div class="stat-label">Groups</div></div>
  </div>

  <div class="section">
    <div class="section-title">Trip Clusters</div>

    ${clusters.length === 0 ? '<div class="empty">No active trip clusters right now</div>' : ''}

    ${strong.length > 0 ? `
    <div class="quality-group">
      <div class="quality-label"><span>🟢</span> Strong (${strong.length})</div>
      ${strong.map(renderCluster).join('')}
    </div>` : ''}

    ${medium.length > 0 ? `
    <div class="quality-group">
      <div class="quality-label"><span>🟡</span> Medium (${medium.length})</div>
      ${medium.map(renderCluster).join('')}
    </div>` : ''}

    ${low.length > 0 ? `
    <div class="quality-group">
      <div class="quality-label"><span>🔴</span> Low (${low.length})</div>
      ${low.map(renderCluster).join('')}
    </div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">Open Requests</div>
    <div class="two-col">
      <div>
        <div style="font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Needs (${openNeeds.length})</div>
        ${openNeeds.length === 0 ? '<div class="empty">None</div>' : openNeeds.map(renderOpenRow).join('')}
      </div>
      <div>
        <div style="font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Offers (${openOffers.length})</div>
        ${openOffers.length === 0 ? '<div class="empty">None</div>' : openOffers.map(renderOpenRow).join('')}
      </div>
    </div>
  </div>

  <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:11px;color:#aaa;text-align:center">
    Aggie Connect v3 · Trip Cluster Dashboard · Auto-refreshes on page load
  </div>
</div>
</body>
</html>`;

        res.send(html);
    } catch (err) {
        console.error('[Dash3] Error:', err.message);
        res.status(500).send('Error loading dashboard: ' + err.message);
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Dash3] Trip cluster dashboard running at http://localhost:${PORT}`);
});
