/**
 * GET /clusters — Cluster board with auth ladder
 * Level 0 (no login): headers + counts only
 * Level 1 (@tamu.edu login): expand clusters to see names, messages, timing
 */

var express = require('express');
var router = express.Router();
var { fetchClusters } = require('../lib/clusters');
var { optionalAuth } = require('../middleware/auth');
var h = require('../lib/helpers');

router.get('/clusters', optionalAuth, async function(req, res) {
    try {
        var clusters = await fetchClusters();

        // Group clusters by date for day sections
        var dayMap = {};
        var dayOrder = [];
        for (var i = 0; i < clusters.length; i++) {
            var c = clusters[i];
            if (!dayMap[c.date]) {
                dayMap[c.date] = [];
                dayOrder.push(c.date);
            }
            dayMap[c.date].push(c);
        }

        // Compute stats
        var totalClusters = clusters.length;
        var totalPosts = 0;
        for (var si = 0; si < clusters.length; si++) {
            totalPosts += clusters[si].needCount + clusters[si].offerCount;
        }

        var html = renderBoard(dayOrder, dayMap, totalClusters, totalPosts, req.user);
        res.send(html);
    } catch (err) {
        console.error('[Clusters] Error:', err.message);
        res.status(500).send('Something went wrong loading the cluster board.');
    }
});

// ── Render helpers ──────────────────────────────────────────────────────

function firstName(name) {
    if (!name) return '';
    return String(name).trim().split(/\s+/)[0];
}

function renderPost(post) {
    var isOffer = post.request_type === 'offer';
    var typeClass = isOffer ? 'post-offer' : 'post-need';
    var typeLabel = isOffer ? 'Offering a ride' : 'Looking for a ride';
    var typeIcon = isOffer ? 'O' : 'N';
    var iconClass = isOffer ? 'icon-offer' : 'icon-need';

    var name = firstName(post.sender_name) || 'Someone';
    var time = post.ride_plan_time ? h.formatTime(post.ride_plan_time) : '';
    var timeFuzzy = post.time_fuzzy ? '~' : '';
    var origin = post.request_origin || '?';
    var dest = post.request_destination || '?';
    var msg = post.raw_message || '';
    var posted = h.formatMsgTime(post.created_at);

    var parts = [];
    parts.push('        <div class="post ' + typeClass + '">');
    parts.push('          <div class="post-top">');
    parts.push('            <span class="icon ' + iconClass + '">' + typeIcon + '</span>');
    parts.push('            <strong class="post-name">' + h.escHtml(name) + '</strong>');
    parts.push('            <span class="post-type">' + typeLabel + '</span>');
    if (time) {
        parts.push('            <span class="post-time">' + timeFuzzy + h.escHtml(time) + '</span>');
    }
    parts.push('          </div>');

    // Specific origin/dest (may differ from corridor header)
    parts.push('          <div class="post-route">' + h.escHtml(origin) + ' &rarr; ' + h.escHtml(dest) + '</div>');

    if (msg) {
        parts.push('          <div class="post-msg">&ldquo;' + h.escHtml(msg) + '&rdquo;</div>');
    }

    parts.push('          <div class="post-meta">');
    parts.push('            <span class="post-contact">Verify phone to see contact</span>');
    parts.push('            <span class="post-posted">Posted ' + h.escHtml(posted) + '</span>');
    parts.push('          </div>');
    parts.push('        </div>');

    return parts.join('\n');
}

// ── Main render ─────────────────────────────────────────────────────────

function renderBoard(dayOrder, dayMap, totalClusters, totalPosts, user) {
    var loggedIn = !!user;
    var parts = [];

    parts.push('<!DOCTYPE html>');
    parts.push('<html lang="en">');
    parts.push('<head>');
    parts.push(h.GA_TAG);
    parts.push('<meta charset="utf-8">');
    parts.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
    parts.push('<title>Ride Clusters — RideSplit</title>');
    parts.push('<link rel="preconnect" href="https://fonts.googleapis.com">');
    parts.push('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
    parts.push('<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">');
    parts.push('<style>');
    parts.push(CSS);
    parts.push('</style>');
    parts.push('</head>');
    parts.push('<body>');
    parts.push('<div class="page">');

    // Hero
    parts.push('<header class="hero">');
    parts.push('  <div>');
    parts.push('    <h1>Aggie <span>RideSplit</span></h1>');
    parts.push('    <p>Ride posts from TAMU WhatsApp groups, grouped by day and route.</p>');
    parts.push('  </div>');
    parts.push('  <div class="stats">');
    parts.push('    <div class="stat"><strong>' + totalClusters + '</strong><span>Clusters</span></div>');
    parts.push('    <div class="stat"><strong>' + totalPosts + '</strong><span>Posts</span></div>');
    parts.push('  </div>');
    parts.push('</header>');

    // Auth banner — changes based on login state
    if (loggedIn) {
        parts.push('<div class="auth auth-loggedin">');
        parts.push('  <span>Signed in as <strong>' + h.escHtml(user.email) + '</strong> — click any cluster to see details.</span>');
        parts.push('  <a href="/logout">Sign out</a>');
        parts.push('</div>');
    } else {
        parts.push('<div class="auth">');
        parts.push('  <span>Sign in with your @tamu.edu email to see who\'s in each cluster and their contact details.</span>');
        parts.push('  <a href="/login?redirect=/clusters">Sign in with @tamu.edu &rarr;</a>');
        parts.push('</div>');
    }

    // Topbar
    parts.push('<div class="topbar">');
    parts.push('  <div class="topbar-left">');
    parts.push('    <div class="legend"><span class="icon icon-need">N</span> Need</div>');
    parts.push('    <div class="legend"><span class="icon icon-offer">O</span> Offer</div>');
    parts.push('    <div class="legend" style="color:var(--text-muted)">Grouped by same day + route</div>');
    parts.push('  </div>');
    parts.push('  <div class="topbar-right">');
    parts.push('    <a href="/" style="font-size:12.5px;color:var(--maroon);text-decoration:none;font-weight:600;">View table board &rarr;</a>');
    parts.push('    <div class="clock" id="clock">-- CT</div>');
    parts.push('  </div>');
    parts.push('</div>');

    // Content
    parts.push('<main class="content">');

    if (dayOrder.length === 0) {
        parts.push('<div style="text-align:center;padding:40px 20px;color:var(--text-muted);">');
        parts.push('  <p style="font-size:16px;font-weight:600;">No upcoming ride clusters</p>');
        parts.push('  <p style="font-size:13px;margin-top:6px;">Check back later or <a href="/" style="color:var(--maroon)">view the full board</a>.</p>');
        parts.push('</div>');
    }

    for (var di = 0; di < dayOrder.length; di++) {
        var dateKey = dayOrder[di];
        var dayClusters = dayMap[dateKey];
        var dateLabel = dateKey === 'flexible' ? 'Flexible Dates' : h.formatDate(dateKey);
        var isToday = dateLabel.startsWith('Today');

        // Day totals
        var dayPosts = 0;
        for (var dci = 0; dci < dayClusters.length; dci++) {
            dayPosts += dayClusters[dci].needCount + dayClusters[dci].offerCount;
        }

        parts.push('<section class="day">');
        parts.push('  <div class="day-head">');
        parts.push('    <strong>' + h.escHtml(dateLabel) + '</strong>');
        if (isToday) parts.push('    <div class="today">Today</div>');
        parts.push('    <span>' + dayClusters.length + ' cluster' + (dayClusters.length !== 1 ? 's' : '') + ', ' + dayPosts + ' post' + (dayPosts !== 1 ? 's' : '') + '</span>');
        parts.push('  </div>');

        for (var ci = 0; ci < dayClusters.length; ci++) {
            var cluster = dayClusters[ci];
            var total = cluster.needCount + cluster.offerCount;
            var hasNeeds = cluster.needCount > 0;
            var hasOffers = cluster.offerCount > 0;
            var waitingClass = (!hasNeeds || !hasOffers) ? ' waiting' : '';
            var clickableClass = loggedIn ? ' clickable' : '';

            parts.push('  <article class="cluster' + waitingClass + clickableClass + '">');
            parts.push('    <div class="cluster-head" onclick="toggleCluster(this)">');
            parts.push('      <h2>' + h.escHtml(cluster.originCorridor) + ' &rarr; ' + h.escHtml(cluster.destCorridor) + '</h2>');
            parts.push('      <div class="cluster-meta">');
            if (hasOffers) {
                parts.push('        <div class="pill pill-offer">' + cluster.offerCount + ' offer' + (cluster.offerCount !== 1 ? 's' : '') + '</div>');
            }
            if (hasNeeds) {
                parts.push('        <div class="pill pill-need">' + cluster.needCount + ' need' + (cluster.needCount !== 1 ? 's' : '') + '</div>');
            }
            if (!hasOffers && hasNeeds) {
                parts.push('        <div class="pill pill-signal">No offer yet</div>');
            }
            if (!hasNeeds && hasOffers) {
                parts.push('        <div class="pill pill-signal">No demand yet</div>');
            }
            if (loggedIn) {
                parts.push('        <span class="expand-arrow">&#9662;</span>');
            }
            parts.push('      </div>');
            parts.push('    </div>');

            if (loggedIn) {
                // Level 1: expandable detail body with posts
                parts.push('    <div class="cluster-body">');

                // Render offers first, then needs
                var offers = [];
                var needs = [];
                for (var pi = 0; pi < cluster.posts.length; pi++) {
                    if (cluster.posts[pi].request_type === 'offer') {
                        offers.push(cluster.posts[pi]);
                    } else {
                        needs.push(cluster.posts[pi]);
                    }
                }

                if (offers.length > 0) {
                    parts.push('      <div class="post-section">');
                    parts.push('        <div class="post-section-label post-section-offer">Rides offered</div>');
                    for (var oi = 0; oi < offers.length; oi++) {
                        parts.push(renderPost(offers[oi]));
                    }
                    parts.push('      </div>');
                }

                if (needs.length > 0) {
                    parts.push('      <div class="post-section">');
                    parts.push('        <div class="post-section-label post-section-need">Looking for rides</div>');
                    for (var ni = 0; ni < needs.length; ni++) {
                        parts.push(renderPost(needs[ni]));
                    }
                    parts.push('      </div>');
                }

                // Phone verify CTA
                parts.push('      <div class="verify-cta">');
                parts.push('        <span>Verify your phone to see contact details and connect with riders.</span>');
                parts.push('      </div>');

                parts.push('    </div>');

                // Footer for logged-in
                parts.push('    <div class="cluster-foot">');
                parts.push('      <p>' + total + ' ' + (total === 1 ? 'person' : 'people') + ' on this route</p>');
                parts.push('      <span class="foot-hint">Click header to ' + (total > 1 ? 'collapse' : 'expand') + '</span>');
                parts.push('    </div>');
            } else {
                // Level 0: summary footer only
                parts.push('    <div class="cluster-foot">');
                parts.push('      <p>' + total + ' ' + (total === 1 ? 'person' : 'people') + ' on this route</p>');
                parts.push('      <a class="btn" href="/login?redirect=/clusters">Sign in to see details</a>');
                parts.push('    </div>');
            }

            parts.push('  </article>');
        }

        parts.push('</section>');
    }

    parts.push('</main>');
    parts.push('</div>');

    // Scripts
    parts.push('<script>');
    // Clock
    parts.push('function updateClock(){');
    parts.push('  var t=new Date().toLocaleTimeString("en-US",{timeZone:"America/Chicago",hour:"numeric",minute:"2-digit",hour12:true});');
    parts.push('  document.getElementById("clock").textContent=t+" CT";');
    parts.push('}');
    parts.push('updateClock();setInterval(updateClock,30000);');

    if (loggedIn) {
        // Expand/collapse for logged-in users
        parts.push('function toggleCluster(head){');
        parts.push('  var article=head.closest(".cluster");');
        parts.push('  if(!article)return;');
        parts.push('  article.classList.toggle("open");');
        parts.push('}');
    } else {
        // Non-logged-in click redirects to login
        parts.push('function toggleCluster(){');
        parts.push('  window.location.href="/login?redirect=/clusters";');
        parts.push('}');
    }

    parts.push('</script>');

    parts.push('</body>');
    parts.push('</html>');

    return parts.join('\n');
}

// ── CSS ─────────────────────────────────────────────────────────────────

var CSS = [
    ':root {',
    '  --maroon: #500000;',
    '  --maroon-soft: #f8eeee;',
    '  --bg: #f7f7f5;',
    '  --surface: #ffffff;',
    '  --surface-soft: #fbfbf9;',
    '  --border: #e4e4e0;',
    '  --text: #1a1a18;',
    '  --text-soft: #575752;',
    '  --text-muted: #8c8c86;',
    '  --need-bg: #edf7ef;',
    '  --need-text: #257043;',
    '  --offer-bg: #eef4fc;',
    '  --offer-text: #2f63a6;',
    '  --signal-bg: #fff8e7;',
    '  --signal-text: #7a5b00;',
    '}',
    '* { box-sizing: border-box; }',
    'body {',
    '  margin: 0;',
    '  font-family: "Outfit", -apple-system, BlinkMacSystemFont, sans-serif;',
    '  background: var(--bg);',
    '  color: var(--text);',
    '  line-height: 1.45;',
    '}',
    '.page { max-width: 1080px; margin: 0 auto; padding: 26px 20px 56px; }',
    '.hero { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 14px; }',
    '.hero h1 { margin: 0; font-size: 28px; letter-spacing: -0.04em; }',
    '.hero h1 span { color: var(--maroon); }',
    '.hero p { margin: 6px 0 0; font-size: 14px; color: var(--text-soft); }',
    '.stats { display: flex; gap: 18px; flex-shrink: 0; }',
    '.stat { text-align: right; }',
    '.stat strong { display: block; font-size: 22px; line-height: 1; }',
    '.stat span { display: block; margin-top: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); font-weight: 600; }',

    // Auth banner
    '.auth { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; padding: 11px 14px; border: 1px solid #e8d98a; border-radius: 10px; background: #fffbf0; font-size: 13px; color: #6b5800; }',
    '.auth a { color: var(--maroon); text-decoration: none; font-weight: 700; white-space: nowrap; }',
    '.auth-loggedin { border-color: #c4e2cc; background: var(--need-bg); color: var(--need-text); }',

    // Topbar
    '.topbar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 12px; height: 46px; padding: 0 14px; margin: 0 -4px 16px; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); background: rgba(247,247,245,0.95); backdrop-filter: blur(6px); }',
    '.topbar-left, .topbar-right { display: flex; align-items: center; gap: 14px; min-width: 0; }',
    '.legend { display: inline-flex; align-items: center; gap: 6px; color: var(--text-soft); font-size: 12.5px; font-weight: 600; white-space: nowrap; }',
    '.icon { width: 18px; height: 18px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }',
    '.icon-need { background: var(--need-bg); color: var(--need-text); }',
    '.icon-offer { background: var(--offer-bg); color: var(--offer-text); }',
    '.clock { font-size: 12px; color: var(--text-muted); white-space: nowrap; }',

    // Content grid
    '.content { display: grid; gap: 24px; }',
    '.day { display: grid; gap: 10px; }',
    '.day-head { display: flex; align-items: center; gap: 10px; padding-bottom: 8px; border-bottom: 1.5px solid var(--border); }',
    '.day-head strong { font-size: 15px; letter-spacing: -0.02em; }',
    '.today { padding: 2px 8px; border-radius: 999px; background: var(--need-bg); color: var(--need-text); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }',
    '.day-head span { margin-left: auto; font-size: 12px; color: var(--text-muted); }',

    // Cluster card
    '.cluster { border: 1px solid var(--border); border-radius: 16px; background: var(--surface); overflow: hidden; }',
    '.cluster-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; background: var(--surface-soft); border-bottom: 1px solid var(--border); }',
    '.clickable .cluster-head { cursor: pointer; user-select: none; }',
    '.clickable .cluster-head:hover { background: #f5f5f2; }',
    '.cluster-head h2 { margin: 0; font-size: 17px; letter-spacing: -0.03em; }',
    '.cluster-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: end; }',
    '.expand-arrow { font-size: 14px; color: var(--text-muted); transition: transform 0.2s; }',
    '.cluster.open .expand-arrow { transform: rotate(180deg); }',

    // Pills
    '.pill { padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); font-size: 12px; color: var(--text-soft); white-space: nowrap; font-weight: 600; }',
    '.pill-need { background: var(--need-bg); border-color: #c4e2cc; color: var(--need-text); }',
    '.pill-offer { background: var(--offer-bg); border-color: #c4d6ed; color: var(--offer-text); }',
    '.pill-signal { background: var(--signal-bg); border-color: #f1dfab; color: var(--signal-text); }',

    // Cluster body (Level 1 detail — hidden by default, shown when .open)
    '.cluster-body { display: none; padding: 0; }',
    '.cluster.open .cluster-body { display: block; }',

    // Post sections
    '.post-section { padding: 6px 16px 10px; }',
    '.post-section + .post-section { border-top: 1px solid var(--border); }',
    '.post-section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 0 4px; }',
    '.post-section-offer { color: var(--offer-text); }',
    '.post-section-need { color: var(--need-text); }',

    // Individual post
    '.post { padding: 10px 0; border-top: 1px solid #f0f0ec; }',
    '.post:first-of-type { border-top: none; }',
    '.post-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }',
    '.post-name { font-size: 14px; letter-spacing: -0.01em; }',
    '.post-type { font-size: 12px; color: var(--text-muted); }',
    '.post-time { margin-left: auto; font-size: 13px; font-weight: 600; color: var(--text-soft); background: var(--surface-soft); padding: 2px 8px; border-radius: 6px; border: 1px solid var(--border); }',
    '.post-route { font-size: 12.5px; color: var(--text-soft); margin-top: 4px; }',
    '.post-msg { font-size: 13px; color: var(--text-soft); margin-top: 6px; font-style: italic; line-height: 1.5; }',
    '.post-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 6px; }',
    '.post-contact { font-size: 12px; color: var(--signal-text); background: var(--signal-bg); padding: 3px 10px; border-radius: 6px; border: 1px solid #f1dfab; font-weight: 600; }',
    '.post-posted { font-size: 11px; color: var(--text-muted); }',

    // Verify CTA inside cluster body
    '.verify-cta { padding: 10px 16px 12px; border-top: 1px solid var(--border); background: var(--signal-bg); font-size: 12.5px; color: var(--signal-text); }',

    // Cluster footer
    '.cluster-foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 16px; background: var(--maroon-soft); }',
    '.cluster-foot p { margin: 0; font-size: 12.5px; color: var(--text-soft); }',
    '.foot-hint { font-size: 11px; color: var(--text-muted); }',

    // Button
    '.btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border: none; border-radius: 8px; background: var(--maroon); color: #fff; font-family: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap; text-decoration: none; }',
    '.btn:hover { background: #6b0000; }',
    '.waiting .cluster-head { background: #fcfcfa; }',

    // Responsive
    '@media (max-width: 860px) {',
    '  .hero { flex-direction: column; align-items: start; }',
    '  .stats { width: 100%; justify-content: flex-start; }',
    '  .cluster-head { flex-direction: column; align-items: start; }',
    '  .cluster-meta { justify-content: flex-start; }',
    '}',
    '@media (max-width: 640px) {',
    '  .page { padding: 16px 10px 36px; }',
    '  .auth, .topbar, .cluster-foot { flex-direction: column; align-items: start; gap: 8px; }',
    '  .topbar { height: auto; padding: 10px 12px; }',
    '  .topbar-left, .topbar-right { flex-wrap: wrap; gap: 8px 12px; }',
    '  .cluster-head, .cluster-foot { padding-left: 12px; padding-right: 12px; }',
    '  .hero h1 { font-size: 24px; }',
    '  .post-section { padding-left: 12px; padding-right: 12px; }',
    '  .verify-cta { padding-left: 12px; padding-right: 12px; }',
    '  .post-top { gap: 6px; }',
    '  .post-time { margin-left: 0; }',
    '}'
].join('\n');

module.exports = router;
