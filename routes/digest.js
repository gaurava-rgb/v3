/**
 * Admin digest routes: /digest/*
 */

var express = require('express');
var router = express.Router();
var { digestAuth, DIGEST_KEY } = require('../middleware/auth');
var { escHtml, GA_TAG, formatDate } = require('../lib/helpers');
var { renderMatchCard, renderClusterCard } = require('../lib/views');
var { fetchOpenMatches, markNotified, fetchSameWayClusters } = require('../lib/data');

router.get('/digest/login', function(req, res) {
    var error = req.query.error ? '<p style="color:#e53e3e;margin-bottom:16px;">Invalid key. Try again.</p>' : '';
    res.send([
        '<!DOCTYPE html><html><head><meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<title>Digest Login</title>',
        '<style>body{font-family:-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#fafafa;margin:0}',
        '.box{background:#fff;padding:32px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1);max-width:360px;width:100%}',
        'h2{margin:0 0 16px;font-size:20px}input{width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:16px;margin-bottom:12px;box-sizing:border-box}',
        'button{width:100%;padding:10px;background:#500000;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer}button:hover{background:#6b0000}</style>',
        '</head><body><div class="box"><h2>Admin Digest</h2>',
        error,
        '<form method="POST" action="/digest/login"><input type="password" name="key" placeholder="Enter digest key" autofocus>',
        '<button type="submit">Sign In</button></form></div></body></html>'
    ].join('\n'));
});

router.post('/digest/login', function(req, res) {
    var key = (req.body.key || '').trim();
    if (!DIGEST_KEY || key !== DIGEST_KEY) {
        return res.redirect('/digest/login?error=1');
    }
    res.cookie('digest_key', key, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.redirect('/digest');
});

router.get('/digest/logout', function(req, res) {
    res.clearCookie('digest_key');
    res.redirect('/digest/login');
});

router.get('/digest', async function(req, res) {
    if (!digestAuth(req, res)) return;

    try {
        var showAll = req.query.show === 'all';
        var matchesPromise = fetchOpenMatches(showAll);
        var clustersPromise = fetchSameWayClusters();
        var matches = await matchesPromise;
        var clusters = await clustersPromise;
        var unhandledCount = matches.filter(function(m) { return !m.notified; }).length;

        var cardsHtml;
        if (matches.length === 0) {
            cardsHtml = '<div class="empty-state"><div class="check">&#x2705;</div>All clear! No unnotified matches.</div>';
        } else {
            cardsHtml = matches.map(function(m) { return renderMatchCard(m); }).join('\n');
        }

        var clustersHtml;
        if (clusters.length === 0) {
            clustersHtml = '<div class="empty-state" style="padding:24px;font-size:14px;color:#aaa;">No same-way clusters right now.</div>';
        } else {
            clustersHtml = clusters.map(function(c) { return renderClusterCard(c); }).join('\n');
        }

        var toggleHref = showAll ? '/digest' : '/digest?show=all';
        var toggleLabel = showAll ? 'Show Unhandled Only' : 'Show All';

        var markAllBtn = unhandledCount > 0
            ? '<button class="btn btn-mark-all" onclick="markAll()">Mark All Handled</button>'
            : '';

        var html = [
            '<!DOCTYPE html>',
            '<html lang="en">',
            '<head>',
            GA_TAG,
            '<meta charset="utf-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1">',
            '<title>Admin Digest</title>',
            '<style>',
            '  * { margin: 0; padding: 0; box-sizing: border-box; }',
            '  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fafafa; color: #1a1a1a; line-height: 1.6; }',
            '  .container { max-width: 720px; margin: 0 auto; padding: 32px 16px; }',
            '',
            '  .digest-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }',
            '  .digest-header h1 { font-size: 22px; font-weight: 700; }',
            '  .digest-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }',
            '',
            '  .match-card { background: #fff; border: 1px solid #e8e8e8; border-radius: 10px; padding: 18px; margin-bottom: 14px; }',
            '  .match-card.handled { opacity: 0.5; }',
            '  .match-date { font-size: 13px; color: #888; margin-bottom: 2px; }',
            '  .match-route { font-size: 17px; font-weight: 600; margin-bottom: 4px; }',
            '  .match-quality { font-size: 13px; margin-bottom: 4px; }',
            '  .match-group { font-size: 13px; color: #666; margin-bottom: 14px; }',
            '',
            '  .match-person { background: #f9f9f9; border-radius: 8px; padding: 14px; margin-bottom: 10px; }',
            '  .match-person-label { font-size: 12px; font-weight: 600; color: #888; margin-bottom: 6px; }',
            '  .match-person-name { font-size: 15px; font-weight: 600; }',
            '  .match-person-phone { font-size: 14px; color: #555; }',
            '  .match-person-msg { font-size: 13px; color: #888; font-style: italic; margin-top: 6px; word-break: break-word; }',
            '  .msg-time { font-style: normal; color: #bbb; font-size: 11px; margin-left: 4px; }',
            '',
            '  .pre-msg { background: #f0f0f0; border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px; font-size: 13px; margin-top: 8px; white-space: pre-wrap; word-break: break-word; color: #444; }',
            '',
            '  .wa-link { display: inline-block; background: #25D366; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-top: 8px; }',
            '  .wa-link:active { background: #1da851; }',
            '',
            '  .btn { display: inline-block; padding: 8px 16px; border-radius: 8px; border: 1px solid #ccc; background: #fff; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; color: #555; }',
            '  .btn-mark { color: #16a34a; border-color: #16a34a; background: #fff; }',
            '  .btn-mark:active { background: #f0fdf4; }',
            '  .btn-mark-all { color: #fff; background: #16a34a; border-color: #16a34a; }',
            '',
            '  .handled-badge { display: inline-block; background: #e8e8e8; color: #888; font-size: 11px; padding: 2px 8px; border-radius: 4px; margin-left: 8px; font-weight: 400; }',
            '',
            '  .section-divider { font-size: 18px; font-weight: 700; margin: 32px 0 16px; padding-top: 24px; border-top: 2px solid #e8e8e8; }',
            '  .section-subtitle { font-size: 13px; color: #888; margin-bottom: 16px; font-weight: 400; }',
            '  .cluster-card { background: #fff; border: 1px solid #e0d4f5; border-radius: 10px; padding: 18px; margin-bottom: 14px; }',
            '  .cluster-count { font-size: 14px; color: #555; margin-bottom: 4px; }',
            '  .cluster-has-offer { font-size: 12px; color: #16a34a; margin-bottom: 12px; }',
            '',
            '  .empty-state { text-align: center; padding: 48px 16px; color: #aaa; font-size: 16px; }',
            '  .empty-state .check { font-size: 48px; margin-bottom: 12px; }',
            '',
            '  .footer { text-align: center; font-size: 11px; color: #bbb; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e8e8e8; }',
            '',
            '  @media (max-width: 480px) {',
            '    .container { padding: 20px 12px; }',
            '    .digest-header { flex-direction: column; align-items: flex-start; }',
            '    .match-card { padding: 14px; }',
            '  }',
            '</style>',
            '</head>',
            '<body>',
            '<div class="container">',
            '',
            '  <div class="digest-header">',
            '    <h1>Admin Digest &mdash; ' + unhandledCount + ' open match' + (unhandledCount !== 1 ? 'es' : '') + '</h1>',
            '    <div class="digest-actions">',
            '      ' + markAllBtn,
            '      <a class="btn" href="' + escHtml(toggleHref) + '">' + toggleLabel + '</a>',
            '      <a class="btn" href="/digest/logout" style="font-size:12px;opacity:0.6;">Logout</a>',
            '    </div>',
            '  </div>',
            '',
            '  ' + cardsHtml,
            '',
            '  <div class="section-divider">\uD83D\uDE95 Going the Same Way &mdash; ' + clusters.length + ' cluster' + (clusters.length !== 1 ? 's' : '') + '</div>',
            '  <div class="section-subtitle">People heading the same direction who could share a cab or coordinate</div>',
            '  ' + clustersHtml,
            '',
            '  <div class="footer">Admin Digest &middot; v3.1</div>',
            '',
            '</div>',
            '<script>',
            '  async function markHandled(matchId) {',
            '    var btn = event.target;',
            '    btn.disabled = true;',
            '    btn.textContent = "Marking...";',
            '    try {',
            '      var resp = await fetch("/digest/mark", {',
            '        method: "POST",',
            '        headers: { "Content-Type": "application/json" },',
            '        body: JSON.stringify({ matchId: matchId })',
            '      });',
            '      if (!resp.ok) throw new Error("Failed");',
            '      var card = document.getElementById("match-" + matchId);',
            '      card.classList.add("handled");',
            '      btn.textContent = "Handled";',
            '      updateCount(-1);',
            '    } catch (e) {',
            '      btn.disabled = false;',
            '      btn.textContent = "Mark Handled";',
            '    }',
            '  }',
            '',
            '  async function markAll() {',
            '    var cards = document.querySelectorAll(".match-card:not(.handled)");',
            '    var ids = [];',
            '    cards.forEach(function(c) { ids.push(c.id.replace("match-", "")); });',
            '    if (ids.length === 0) return;',
            '    if (!confirm("Mark all " + ids.length + " matches as handled?")) return;',
            '    try {',
            '      var resp = await fetch("/digest/mark", {',
            '        method: "POST",',
            '        headers: { "Content-Type": "application/json" },',
            '        body: JSON.stringify({ matchIds: ids })',
            '      });',
            '      if (!resp.ok) throw new Error("Failed");',
            '      cards.forEach(function(c) { c.classList.add("handled"); });',
            '      document.querySelectorAll(".btn-mark").forEach(function(b) { b.textContent = "Handled"; b.disabled = true; });',
            '      updateCount(-ids.length);',
            '    } catch (e) {',
            '      alert("Failed to mark all as handled");',
            '    }',
            '  }',
            '',
            '  function updateCount(delta) {',
            '    var h1 = document.querySelector(".digest-header h1");',
            '    var match = h1.textContent.match(/(\\d+)/);',
            '    if (match) {',
            '      var n = Math.max(0, parseInt(match[1]) + delta);',
            '      h1.textContent = "Admin Digest \\u2014 " + n + " open match" + (n !== 1 ? "es" : "");',
            '    }',
            '  }',
            '',
            '  setTimeout(function() { location.reload(); }, 5 * 60 * 1000);',
            '</script>',
            '</body>',
            '</html>'
        ].join('\n');

        res.send(html);
    } catch (err) {
        console.error('[Dashboard/Digest] Error:', err.message);
        res.status(500).send('Error loading digest');
    }
});

router.post('/digest/mark', async function(req, res) {
    if (!digestAuth(req, res)) return;

    try {
        var matchIds = req.body.matchIds || (req.body.matchId ? [req.body.matchId] : []);
        if (matchIds.length === 0) {
            return res.status(400).json({ error: 'No matchIds provided' });
        }
        await markNotified(matchIds);
        res.json({ success: true, marked: matchIds.length });
    } catch (err) {
        console.error('[Dashboard/Digest] Mark error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
