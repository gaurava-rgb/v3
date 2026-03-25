/**
 * GET /clusters — Cluster board with auth ladder
 * Level 0 (no login): headers + counts only
 * Level 1 (@tamu.edu login): expand clusters to see names, messages, timing
 * Level 2 (phone verified): see full phone numbers + WhatsApp links
 */

var express = require('express');
var router = express.Router();
var { fetchClusters } = require('../lib/clusters');
var { optionalAuth, loadAppUser } = require('../middleware/auth');
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

        // Check phone verification status
        var phoneVerified = false;
        if (req.user) {
            var appUser = await loadAppUser(req.user.email);
            if (appUser && appUser.phone_verified_at) phoneVerified = true;
        }

        var html = renderBoard(dayOrder, dayMap, totalClusters, totalPosts, req.user, phoneVerified);
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

function renderPost(post, phoneVerified) {
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
    if (phoneVerified && post.source_contact) {
        var phone = h.digestFormatPhone(post.source_contact);
        var digits = h.phoneDigitsOnly(post.source_contact);
        parts.push('            <span class="post-contact post-contact-revealed">' + h.escHtml(phone) + '</span>');
        if (digits) {
            parts.push('            <a class="wa-btn" href="https://wa.me/' + h.escHtml(digits) + '" target="_blank" rel="noopener">WhatsApp</a>');
        }
    } else {
        parts.push('            <a class="post-contact" href="/phone">Verify phone to see contact</a>');
    }
    parts.push('            <span class="post-posted">Posted ' + h.escHtml(posted) + '</span>');
    parts.push('          </div>');
    parts.push('        </div>');

    return parts.join('\n');
}

// ── Main render ─────────────────────────────────────────────────────────

function renderBoard(dayOrder, dayMap, totalClusters, totalPosts, user, phoneVerified) {
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
    if (loggedIn && phoneVerified) {
        parts.push('<div class="auth auth-loggedin">');
        parts.push('  <span>Signed in as <strong>' + h.escHtml(user.email) + '</strong> — phone verified. Contact details visible.</span>');
        parts.push('  <a href="/logout">Sign out</a>');
        parts.push('</div>');
    } else if (loggedIn) {
        parts.push('<div class="auth auth-loggedin">');
        parts.push('  <span>Signed in as <strong>' + h.escHtml(user.email) + '</strong> — <a href="/phone" style="color:inherit;font-weight:700;text-decoration:underline;">Verify your phone</a> to see contacts.</span>');
        parts.push('  <a href="/logout">Sign out</a>');
        parts.push('</div>');
    } else {
        parts.push('<div class="auth">');
        parts.push('  <span>Sign in with your @tamu.edu email to see who\'s in each cluster.</span>');
        parts.push('  <a href="/login?redirect=/clusters">Sign in &rarr;</a>');
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
    parts.push('    <div class="clock" id="clock">-- CT</div>');
    parts.push('  </div>');
    parts.push('</div>');

    // Filter bar
    parts.push('<div class="filter-bar">');
    parts.push('  <div class="filter-row">');
    parts.push('    <span class="filter-label">From</span>');
    parts.push('    <div class="filter-pills" role="radiogroup" aria-label="Filter by origin">');
    parts.push('      <button class="fpill active" data-filter="from" data-val="" role="radio" aria-checked="true">All</button>');
    parts.push('      <button class="fpill" data-filter="from" data-val="Dallas area" role="radio" aria-checked="false">Dallas</button>');
    parts.push('      <button class="fpill" data-filter="from" data-val="Houston area" role="radio" aria-checked="false">Houston</button>');
    parts.push('      <button class="fpill" data-filter="from" data-val="Austin area" role="radio" aria-checked="false">Austin</button>');
    parts.push('      <button class="fpill" data-filter="from" data-val="College Station" role="radio" aria-checked="false">College Stn</button>');
    parts.push('      <button class="fpill" data-filter="from" data-val="San Antonio" role="radio" aria-checked="false">San Antonio</button>');
    parts.push('    </div>');
    parts.push('  </div>');
    parts.push('  <div class="filter-row">');
    parts.push('    <span class="filter-label">To</span>');
    parts.push('    <div class="filter-pills" role="radiogroup" aria-label="Filter by destination">');
    parts.push('      <button class="fpill active" data-filter="to" data-val="" role="radio" aria-checked="true">All</button>');
    parts.push('      <button class="fpill" data-filter="to" data-val="Dallas area" role="radio" aria-checked="false">Dallas</button>');
    parts.push('      <button class="fpill" data-filter="to" data-val="Houston area" role="radio" aria-checked="false">Houston</button>');
    parts.push('      <button class="fpill" data-filter="to" data-val="Austin area" role="radio" aria-checked="false">Austin</button>');
    parts.push('      <button class="fpill" data-filter="to" data-val="College Station" role="radio" aria-checked="false">College Stn</button>');
    parts.push('      <button class="fpill" data-filter="to" data-val="San Antonio" role="radio" aria-checked="false">San Antonio</button>');
    parts.push('    </div>');
    parts.push('  </div>');
    parts.push('  <div class="filter-status" id="filter-status" style="display:none"></div>');
    parts.push('</div>');

    // Content
    parts.push('<main class="content">');

    // Filter empty state (hidden by default, shown by JS when no clusters match)
    parts.push('<div class="filter-empty" id="filter-empty" style="display:none">');
    parts.push('  <p class="filter-empty-title">No clusters match your filters</p>');
    parts.push('  <p class="filter-empty-sub">Try broadening your search or check back later &mdash; new posts come in from WhatsApp groups daily.</p>');
    parts.push('  <button class="btn" onclick="clearF()">Clear filters</button>');
    parts.push('</div>');

    if (dayOrder.length === 0) {
        parts.push('<div style="text-align:center;padding:40px 20px;color:var(--text-muted);">');
        parts.push('  <p style="font-size:16px;font-weight:600;">No upcoming ride clusters</p>');
        parts.push('  <p style="font-size:13px;margin-top:6px;">Check back later or <a href="/" style="color:var(--maroon)">view the full board</a>.</p>');
        parts.push('</div>');
    }

    var clusterIndex = 0;
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
        parts.push('    <span class="day-stats">' + dayClusters.length + ' cluster' + (dayClusters.length !== 1 ? 's' : '') + ', ' + dayPosts + ' post' + (dayPosts !== 1 ? 's' : '') + '</span>');
        if (!loggedIn) {
            parts.push('    <a class="day-signin" href="/login?redirect=/clusters">Sign in to see details &rarr;</a>');
        }
        parts.push('  </div>');

        for (var ci = 0; ci < dayClusters.length; ci++) {
            var cluster = dayClusters[ci];
            var total = cluster.needCount + cluster.offerCount;
            var hasNeeds = cluster.needCount > 0;
            var hasOffers = cluster.offerCount > 0;
            var waitingClass = (!hasNeeds || !hasOffers) ? ' waiting' : '';
            var clickableClass = loggedIn ? ' clickable' : '';

            // Build data attributes for contact view logging
            var dataAttrs = '';
            if (phoneVerified && cluster.posts) {
                var clusterKey = (dateKey || '') + '|' + (cluster.originCorridor || '') + '|' + (cluster.destCorridor || '');
                var contacts = [];
                for (var di = 0; di < cluster.posts.length; di++) {
                    if (cluster.posts[di].source_contact) contacts.push(cluster.posts[di].source_contact);
                }
                dataAttrs = ' data-ck="' + h.escHtml(clusterKey) + '" data-contacts="' + h.escHtml(JSON.stringify(contacts)) + '"';
            }

            parts.push('  <article class="cluster' + waitingClass + clickableClass + '" data-from="' + h.escHtml(cluster.originCorridor) + '" data-to="' + h.escHtml(cluster.destCorridor) + '"' + dataAttrs + ' style="animation-delay:' + (clusterIndex * 60) + 'ms">');
            clusterIndex++;
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
                parts.push('      <div class="cluster-body-inner">');

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
                        parts.push(renderPost(offers[oi], phoneVerified));
                    }
                    parts.push('      </div>');
                }

                if (needs.length > 0) {
                    parts.push('      <div class="post-section">');
                    parts.push('        <div class="post-section-label post-section-need">Looking for rides</div>');
                    for (var ni = 0; ni < needs.length; ni++) {
                        parts.push(renderPost(needs[ni], phoneVerified));
                    }
                    parts.push('      </div>');
                }

                // Phone verify CTA (only shown if not yet verified)
                if (!phoneVerified) {
                    parts.push('      <div class="verify-cta">');
                    parts.push('        <a href="/phone" style="color:inherit;font-weight:600;text-decoration:underline;">Verify your phone</a> to see contact details and connect with riders.');
                    parts.push('      </div>');
                }
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
        parts.push('var logged={};');
        parts.push('function toggleCluster(head){');
        parts.push('  var article=head.closest(".cluster");');
        parts.push('  if(!article)return;');
        parts.push('  var wasOpen=article.classList.contains("open");');
        parts.push('  article.classList.toggle("open");');
        if (phoneVerified) {
            // Log contact reveals when phone-verified user opens a cluster
            parts.push('  if(!wasOpen&&article.dataset.ck&&!logged[article.dataset.ck]){');
            parts.push('    logged[article.dataset.ck]=1;');
            parts.push('    var cc=JSON.parse(article.dataset.contacts||"[]");');
            parts.push('    if(cc.length)fetch("/log-view",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cluster_key:article.dataset.ck,contacts:cc})});');
            parts.push('  }');
        }
        parts.push('}');
    } else {
        // Non-logged-in click redirects to login
        parts.push('function toggleCluster(){');
        parts.push('  window.location.href="/login?redirect=/clusters";');
        parts.push('}');
    }

    // Filter logic
    parts.push('var fFrom="",fTo="";');
    parts.push('function fpClick(b){');
    parts.push('  var f=b.dataset.filter,v=b.dataset.val;');
    parts.push('  if(v!==""&&((f==="from"&&fFrom===v)||(f==="to"&&fTo===v)))v="";');
    parts.push('  if(f==="from")fFrom=v;else fTo=v;');
    parts.push('  var ps=document.querySelectorAll(\'.fpill[data-filter="\'+f+\'"]\');');
    parts.push('  for(var i=0;i<ps.length;i++){ps[i].classList.toggle("active",ps[i].dataset.val===v);ps[i].setAttribute("aria-checked",ps[i].dataset.val===v?"true":"false");}');
    parts.push('  runFilter();');
    parts.push('}');
    parts.push('function runFilter(){');
    parts.push('  var cs=document.querySelectorAll("article.cluster"),total=cs.length,shown=0;');
    parts.push('  for(var i=0;i<cs.length;i++){var mf=!fFrom||cs[i].dataset.from===fFrom;var mt=!fTo||cs[i].dataset.to===fTo;if(mf&&mt){cs[i].classList.remove("fhide");shown++;}else{cs[i].classList.add("fhide");}}');
    parts.push('  var ds=document.querySelectorAll("section.day");');
    parts.push('  for(var d=0;d<ds.length;d++){if(ds[d].querySelector("article.cluster:not(.fhide)"))ds[d].classList.remove("fhide");else ds[d].classList.add("fhide");}');
    parts.push('  var st=document.getElementById("filter-status"),em=document.getElementById("filter-empty");');
    parts.push('  if(fFrom||fTo){st.innerHTML=\'Showing \'+shown+\' of \'+total+\' clusters <a class="filter-clear" href="javascript:void(0)" onclick="clearF()">Clear filters</a>\';st.style.display="flex";em.style.display=shown===0?"":"none";}');
    parts.push('  else{st.style.display="none";em.style.display="none";}');
    parts.push('  var p=new URLSearchParams();if(fFrom)p.set("from",fFrom);if(fTo)p.set("to",fTo);');
    parts.push('  history.replaceState(null,"",location.pathname+(p.toString()?"?"+p:""));');
    parts.push('}');
    parts.push('function clearF(){');
    parts.push('  fFrom="";fTo="";');
    parts.push('  var ps=document.querySelectorAll(".fpill");for(var i=0;i<ps.length;i++){ps[i].classList.toggle("active",ps[i].dataset.val==="");ps[i].setAttribute("aria-checked",ps[i].dataset.val===""?"true":"false");}');
    parts.push('  runFilter();');
    parts.push('}');
    parts.push('(function(){');
    parts.push('  var ps=document.querySelectorAll(".fpill");for(var i=0;i<ps.length;i++)ps[i].addEventListener("click",function(){fpClick(this);});');
    parts.push('  var u=new URLSearchParams(location.search),pf=u.get("from")||"",pt=u.get("to")||"";');
    parts.push('  if(pf||pt){fFrom=pf;fTo=pt;for(var i=0;i<ps.length;i++){var f=ps[i].dataset.filter,v=ps[i].dataset.val;ps[i].classList.toggle("active",(f==="from"?v===pf:v===pt)||(f==="from"&&!pf&&v==="")||(f==="to"&&!pt&&v===""));};runFilter();}');
    parts.push('})();');

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
    '  --text-muted: #737370;',
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
    '.page { max-width: 1080px; margin: 0 auto; padding: 26px 20px 56px; overflow-x: hidden; }',
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
    '.day-head { position: sticky; top: 46px; z-index: 15; display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1.5px solid var(--border); background: var(--bg); }',
    '.day-head strong { font-size: 15px; letter-spacing: -0.02em; }',
    '.day-stats { margin-left: auto; }',
    '.day-signin { font-size: 12px; color: var(--maroon); font-weight: 600; text-decoration: none; white-space: nowrap; }',
    '.day-signin:hover { text-decoration: underline; }',
    '.today { padding: 2px 8px; border-radius: 999px; background: var(--need-bg); color: var(--need-text); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }',
    '.day-head span { font-size: 12px; color: var(--text-muted); }',

    // Cluster card
    '.cluster { border: 1px solid var(--border); border-radius: 16px; background: var(--surface); overflow: hidden; }',
    '.cluster-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; background: var(--surface-soft); border-bottom: 1px solid var(--border); }',
    '.clickable .cluster-head { cursor: pointer; user-select: none; transition: transform 0.15s ease, background 0.15s ease; }',
    '.clickable .cluster-head:hover { background: #f5f5f2; }',
    '.clickable .cluster-head:active { transform: scale(0.99); }',
    '.cluster-head h2 { margin: 0; font-size: 17px; letter-spacing: -0.03em; }',
    '.cluster-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: end; }',
    '.expand-arrow { font-size: 18px; color: var(--text-muted); transition: transform 0.2s; }',
    '.cluster.open .expand-arrow { transform: rotate(180deg); }',

    // Pills
    '.pill { padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); font-size: 12px; color: var(--text-soft); white-space: nowrap; font-weight: 600; }',
    '.pill-need { background: var(--need-bg); border-color: #c4e2cc; color: var(--need-text); }',
    '.pill-offer { background: var(--offer-bg); border-color: #c4d6ed; color: var(--offer-text); }',
    '.pill-signal { background: var(--signal-bg); border-color: #f1dfab; color: var(--signal-text); }',

    // Cluster body (Level 1 detail — hidden by default, shown when .open)
    '.cluster-body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 300ms cubic-bezier(0.16, 1, 0.3, 1); }',
    '.cluster-body > .cluster-body-inner { min-height: 0; overflow: hidden; }',
    '.cluster.open .cluster-body { grid-template-rows: 1fr; }',

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
    '.post-msg { font-size: 15px; color: var(--text-soft); margin-top: 8px; font-style: italic; line-height: 1.5; }',
    '.post-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 6px; }',
    '.post-contact { font-size: 12px; color: var(--signal-text); background: var(--signal-bg); padding: 3px 10px; border-radius: 6px; border: 1px solid #f1dfab; font-weight: 600; text-decoration: none; }',
    '.post-contact:hover { text-decoration: underline; }',
    '.post-contact-revealed { color: var(--text); background: var(--surface-soft); border-color: var(--border); font-size: 13px; font-weight: 700; letter-spacing: 0.01em; }',
    '.wa-btn { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 6px; background: #25D366; color: #fff; font-size: 12px; font-weight: 600; text-decoration: none; white-space: nowrap; }',
    '.wa-btn:hover { background: #1fb855; }',
    '.post-posted { font-size: 11px; color: var(--text-muted); }',

    // Verify CTA inside cluster body
    '.verify-cta { padding: 10px 16px 12px; border-top: 1px solid var(--border); background: var(--signal-bg); font-size: 12.5px; color: var(--signal-text); }',

    // Cluster footer
    '.cluster-foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 16px; background: var(--maroon-soft); }',
    '.cluster-foot p { margin: 0; font-size: 12.5px; color: var(--text-soft); }',
    '.foot-hint { font-size: 11px; color: #6b6b66; }',

    // Button
    '.btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border: none; border-radius: 8px; background: var(--maroon); color: #fff; font-family: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap; text-decoration: none; transition: transform 0.15s ease, background 0.15s ease; }',
    '.btn:hover { background: #6b0000; }',
    '.btn:active { transform: translateY(1px) scale(0.98); }',
    '.waiting .cluster-head { background: #fcfcfa; }',

    // Filter bar
    '.filter-bar { padding: 10px 14px; margin: -8px 0 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }',
    '.filter-row { display: flex; align-items: center; gap: 10px; }',
    '.filter-row + .filter-row { margin-top: 8px; }',
    '.filter-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; min-width: 34px; flex-shrink: 0; }',
    '.filter-pills { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; padding: 2px 0; min-width: 0; }',
    '.filter-pills::-webkit-scrollbar { display: none; }',
    '.fpill { padding: 7px 14px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); font-family: inherit; font-size: 13px; font-weight: 600; color: var(--text-soft); cursor: pointer; white-space: nowrap; transition: background 150ms ease, color 150ms ease, border-color 150ms ease, transform 100ms ease; touch-action: manipulation; outline: none; -webkit-tap-highlight-color: transparent; }',
    '.fpill:hover { background: #f0f0ec; border-color: #d4d4d0; }',
    '.fpill:active { transform: scale(0.96); }',
    '.fpill.active { background: var(--maroon); border-color: var(--maroon); color: #fff; }',
    '.fpill.active:hover { background: #6b0000; border-color: #6b0000; }',
    '.fpill:focus-visible { box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--maroon); }',
    '.filter-status { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); font-size: 12px; color: var(--text-muted); }',
    '.filter-clear { color: var(--maroon); font-weight: 600; text-decoration: none; cursor: pointer; font-size: 12px; }',
    '.filter-clear:hover { text-decoration: underline; }',
    '.fhide { display: none !important; }',
    '.filter-empty { text-align: center; padding: 40px 20px; }',
    '.filter-empty-title { font-size: 16px; font-weight: 600; color: var(--text-soft); margin: 0 0 6px; }',
    '.filter-empty-sub { font-size: 13px; color: var(--text-muted); margin: 0 0 16px; max-width: 360px; margin-left: auto; margin-right: auto; line-height: 1.5; }',

    // Animations
    '@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }',
    '.cluster { animation: fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }',
    '.day { animation: fadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }',
    '@media (prefers-reduced-motion: reduce) { .cluster, .day { animation: none; } }',

    // Responsive
    '@media (max-width: 860px) {',
    '  .hero { flex-direction: column; align-items: start; }',
    '  .stats { width: 100%; justify-content: flex-start; }',
    '  .cluster-head { flex-direction: column; align-items: start; }',
    '  .cluster-meta { justify-content: flex-start; }',
    '}',
    '@media (max-width: 640px) {',
    '  .page { padding: 16px 10px 36px; }',
    '  .filter-bar { margin: -4px 0 12px; padding: 8px 10px; }',
    '  .filter-row { gap: 8px; }',
    '  .filter-label { min-width: 30px; font-size: 10px; }',
    '  .fpill { padding: 6px 12px; font-size: 12px; }',
    '  .auth, .topbar, .cluster-foot { flex-direction: column; align-items: start; gap: 8px; }',
    '  .topbar { height: auto; padding: 10px 12px; }',
    '  .topbar-left, .topbar-right { flex-wrap: wrap; gap: 8px 12px; }',
    '  .cluster-head, .cluster-foot { padding-left: 12px; padding-right: 12px; }',
    '  .hero h1 { font-size: 24px; }',
    '  .post-section { padding-left: 12px; padding-right: 12px; }',
    '  .verify-cta { padding-left: 12px; padding-right: 12px; }',
    '  .day-head { top: 0; flex-wrap: wrap; }',
    '  .post-top { gap: 6px; }',
    '  .post-time { margin-left: 0; }',
    '}'
].join('\n');

module.exports = router;
