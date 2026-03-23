/**
 * GET /clusters — Public cluster board (Level 0: headers + counts only)
 */

var express = require('express');
var router = express.Router();
var { fetchClusters } = require('../lib/clusters');
var h = require('../lib/helpers');

router.get('/clusters', async function(req, res) {
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

        var html = renderLevel0(dayOrder, dayMap, totalClusters, totalPosts);
        res.send(html);
    } catch (err) {
        console.error('[Clusters] Error:', err.message);
        res.status(500).send('Something went wrong loading the cluster board.');
    }
});

function renderLevel0(dayOrder, dayMap, totalClusters, totalPosts) {
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

    // Auth banner
    parts.push('<div class="auth">');
    parts.push('  <span>Sign in with your @tamu.edu email to see who\'s in each cluster and their contact details.</span>');
    parts.push('  <a href="/login">Sign in with @tamu.edu &rarr;</a>');
    parts.push('</div>');

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

            parts.push('  <article class="cluster' + waitingClass + '">');
            parts.push('    <div class="cluster-head">');
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
            parts.push('      </div>');
            parts.push('    </div>');

            // Level 0: summary footer only, no post details
            parts.push('    <div class="cluster-foot">');
            parts.push('      <p>' + total + ' ' + (total === 1 ? 'person' : 'people') + ' on this route</p>');
            parts.push('      <a class="btn" href="/login">Sign in to see details</a>');
            parts.push('    </div>');

            parts.push('  </article>');
        }

        parts.push('</section>');
    }

    parts.push('</main>');
    parts.push('</div>');

    // Clock script
    parts.push('<script>');
    parts.push('function updateClock(){');
    parts.push('  var t=new Date().toLocaleTimeString("en-US",{timeZone:"America/Chicago",hour:"numeric",minute:"2-digit",hour12:true});');
    parts.push('  document.getElementById("clock").textContent=t+" CT";');
    parts.push('}');
    parts.push('updateClock();setInterval(updateClock,30000);');
    parts.push('</script>');

    parts.push('</body>');
    parts.push('</html>');

    return parts.join('\n');
}

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
    '.auth { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; padding: 11px 14px; border: 1px solid #e8d98a; border-radius: 10px; background: #fffbf0; font-size: 13px; color: #6b5800; }',
    '.auth a { color: var(--maroon); text-decoration: none; font-weight: 700; white-space: nowrap; }',
    '.topbar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 12px; height: 46px; padding: 0 14px; margin: 0 -4px 16px; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); background: rgba(247,247,245,0.95); backdrop-filter: blur(6px); }',
    '.topbar-left, .topbar-right { display: flex; align-items: center; gap: 14px; min-width: 0; }',
    '.legend { display: inline-flex; align-items: center; gap: 6px; color: var(--text-soft); font-size: 12.5px; font-weight: 600; white-space: nowrap; }',
    '.icon { width: 18px; height: 18px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }',
    '.icon-need { background: var(--need-bg); color: var(--need-text); }',
    '.icon-offer { background: var(--offer-bg); color: var(--offer-text); }',
    '.clock { font-size: 12px; color: var(--text-muted); white-space: nowrap; }',
    '.content { display: grid; gap: 24px; }',
    '.day { display: grid; gap: 10px; }',
    '.day-head { display: flex; align-items: center; gap: 10px; padding-bottom: 8px; border-bottom: 1.5px solid var(--border); }',
    '.day-head strong { font-size: 15px; letter-spacing: -0.02em; }',
    '.today { padding: 2px 8px; border-radius: 999px; background: var(--need-bg); color: var(--need-text); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }',
    '.day-head span { margin-left: auto; font-size: 12px; color: var(--text-muted); }',
    '.cluster { border: 1px solid var(--border); border-radius: 16px; background: var(--surface); overflow: hidden; }',
    '.cluster-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; background: var(--surface-soft); border-bottom: 1px solid var(--border); }',
    '.cluster-head h2 { margin: 0; font-size: 17px; letter-spacing: -0.03em; }',
    '.cluster-meta { display: flex; flex-wrap: wrap; gap: 8px; justify-content: end; }',
    '.pill { padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); font-size: 12px; color: var(--text-soft); white-space: nowrap; font-weight: 600; }',
    '.pill-need { background: var(--need-bg); border-color: #c4e2cc; color: var(--need-text); }',
    '.pill-offer { background: var(--offer-bg); border-color: #c4d6ed; color: var(--offer-text); }',
    '.pill-signal { background: var(--signal-bg); border-color: #f1dfab; color: var(--signal-text); }',
    '.cluster-foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 16px; background: var(--maroon-soft); }',
    '.cluster-foot p { margin: 0; font-size: 12.5px; color: var(--text-soft); }',
    '.btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border: none; border-radius: 8px; background: var(--maroon); color: #fff; font-family: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap; text-decoration: none; }',
    '.btn:hover { background: #6b0000; }',
    '.waiting .cluster-head { background: #fcfcfa; }',
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
    '}'
].join('\n');

module.exports = router;
