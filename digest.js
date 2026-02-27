/**
 * Aggie Connect — Daily Digest Bot (v3.1.3)
 * Sends daily match digest to admin via WhatsApp.
 * Persistent process: Baileys connection + Express on port 3010.
 * Takes over the v2 bot's auth session.
 */

require('dotenv').config();

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const qrcode = require('qrcode-terminal');

// ── Config ───────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.DIGEST_PORT || '3010', 10);
const ADMIN_NUMBER = process.env.ADMIN_WA_NUMBER;
const ADMIN_JID = ADMIN_NUMBER ? ADMIN_NUMBER + '@s.whatsapp.net' : null;
const AUTH_DIR = process.env.DIGEST_AUTH_DIR || '.v3_auth';
const MAX_RECONNECT = 10;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const silentLogger = pino({ level: 'silent' });

let sock = null;
let isReady = false;
let reconnectAttempts = 0;

// ── Formatting Helpers ───────────────────────────────────────────────────

function formatPhone(contact) {
    if (!contact) return 'Unknown';
    var digits = String(contact).replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
        return '+1 ' + digits.slice(1, 4) + '-' + digits.slice(4, 7) + '-' + digits.slice(7);
    }
    if (digits.length === 10) {
        return '+1 ' + digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6);
    }
    return '+' + digits;
}

function formatDate(dateStr) {
    if (!dateStr) return 'Flexible date';
    var d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
        weekday: 'long', month: 'short', day: 'numeric'
    });
}

function formatTime(timeStr) {
    if (!timeStr) return null;
    var parts = timeStr.split(':').map(Number);
    var h = parts[0], m = parts[1];
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 || 12;
    return h12 + ':' + String(m).padStart(2, '0') + ' ' + ampm;
}

function firstName(name) {
    if (!name) return 'there';
    return String(name).trim().split(/\s+/)[0];
}

// ── Message Templates ────────────────────────────────────────────────────

function generateRiderMessage(need, offer) {
    var dest = need.request_destination || offer.request_destination || 'your destination';
    var dateStr = offer.ride_plan_date ? formatDate(offer.ride_plan_date) : 'soon';
    var timeStr = offer.ride_plan_time ? ' around ' + formatTime(offer.ride_plan_time) : '';
    return 'Hey! Someone\u2019s offering a ride to ' + dest + ' ' + dateStr + timeStr +
        '. Interested? Let me know and I\u2019ll connect you both \uD83D\uDE42';
}

function generateDriverMessage(need, offer) {
    var dest = offer.request_destination || need.request_destination || 'your destination';
    var dateStr = need.ride_plan_date ? formatDate(need.ride_plan_date) : 'soon';
    var timeStr = need.ride_plan_time ? ' around ' + formatTime(need.ride_plan_time) : '';
    return 'Hey! Someone needs a ride to ' + dest + ' ' + dateStr + timeStr +
        ' \u2014 same as you. Want me to connect you both? \uD83D\uDE42';
}

// ── Supabase Queries ─────────────────────────────────────────────────────

async function fetchOpenMatches() {
    // Step 1: all unnotified matches
    var matchResult = await supabase
        .from('v3_matches')
        .select('id, need_id, offer_id, score, match_quality, created_at')
        .eq('notified', false)
        .order('created_at', { ascending: true });

    if (matchResult.error) throw new Error('Failed to fetch matches: ' + matchResult.error.message);
    var matches = matchResult.data || [];
    if (matches.length === 0) return [];

    // Step 2: fetch all involved requests
    var idSet = new Set();
    for (var i = 0; i < matches.length; i++) {
        idSet.add(matches[i].need_id);
        idSet.add(matches[i].offer_id);
    }
    var requestIds = Array.from(idSet);

    var reqResult = await supabase
        .from('v3_requests')
        .select('id, source_group, source_contact, sender_name, request_type, ride_plan_date, ride_plan_time, request_origin, request_destination, raw_message')
        .in('id', requestIds);

    if (reqResult.error) throw new Error('Failed to fetch requests: ' + reqResult.error.message);

    // Step 3: fetch group names (exclude test groups)
    var groupResult = await supabase
        .from('monitored_groups')
        .select('group_id, group_name, is_test');

    var groupMap = new Map();
    var testGroups = new Set();
    var groups = (groupResult.data || []);
    for (var gi = 0; gi < groups.length; gi++) {
        groupMap.set(groups[gi].group_id, groups[gi].group_name);
        if (groups[gi].is_test) {
            testGroups.add(groups[gi].group_id);
            if (groups[gi].group_name) testGroups.add(groups[gi].group_name);
        }
    }

    // Build request lookup
    var requestMap = new Map();
    var requests = reqResult.data || [];
    for (var ri = 0; ri < requests.length; ri++) {
        requestMap.set(requests[ri].id, requests[ri]);
    }

    // Step 4: assemble enriched matches, filtering out test group data
    var enriched = [];
    for (var mi = 0; mi < matches.length; mi++) {
        var m = matches[mi];
        var need = requestMap.get(m.need_id);
        var offer = requestMap.get(m.offer_id);
        if (!need || !offer) continue;

        // Skip if either request is from a test group
        if (need.source_group && testGroups.has(need.source_group)) continue;
        if (offer.source_group && testGroups.has(offer.source_group)) continue;

        var resolveGroup = function(sg) {
            if (!sg) return 'Unknown Group';
            return groupMap.get(sg) || sg;
        };

        enriched.push({
            matchId: m.id,
            matchQuality: m.match_quality,
            score: m.score,
            createdAt: m.created_at,
            need: Object.assign({}, need, { groupName: resolveGroup(need.source_group) }),
            offer: Object.assign({}, offer, { groupName: resolveGroup(offer.source_group) })
        });
    }

    return enriched;
}

async function markNotified(matchIds) {
    if (!matchIds || matchIds.length === 0) return;
    var result = await supabase
        .from('v3_matches')
        .update({ notified: true })
        .in('id', matchIds);
    if (result.error) {
        console.error('[Digest] Failed to mark notified:', result.error.message);
    } else {
        console.log('[Digest] Marked ' + matchIds.length + ' match(es) as notified');
    }
}

// ── Format Match Block ───────────────────────────────────────────────────

function formatMatchBlock(match) {
    var need = match.need;
    var offer = match.offer;

    var needName = need.sender_name || need.source_contact || 'Unknown';
    var offerName = offer.sender_name || offer.source_contact || 'Unknown';
    var needPhone = formatPhone(need.source_contact);
    var offerPhone = formatPhone(offer.source_contact);

    var date = need.ride_plan_date || offer.ride_plan_date;
    var dateLabel = formatDate(date);
    var origin = need.request_origin || offer.request_origin || '?';
    var dest = need.request_destination || offer.request_destination || '?';

    var qualityEmoji = { strong: '\uD83D\uDFE2', medium: '\uD83D\uDFE1', low: '\uD83D\uDD34' }[match.matchQuality] || '\u26AA';

    var groupLine;
    if (need.groupName === offer.groupName) {
        groupLine = qualityEmoji + ' Same group: ' + need.groupName;
    } else {
        groupLine = qualityEmoji + ' Groups: ' + need.groupName + ' / ' + offer.groupName;
    }

    var needTimeNote = need.ride_plan_time ? ' (' + formatTime(need.ride_plan_time) + ')' : '';
    var offerTimeNote = offer.ride_plan_time ? ' (' + formatTime(offer.ride_plan_time) + ')' : '';

    var riderMsg = generateRiderMessage(need, offer);
    var driverMsg = generateDriverMessage(need, offer);

    var needFirstName = firstName(need.sender_name);
    var offerFirstName = firstName(offer.sender_name);

    return [
        '\uD83D\uDCC5 ' + dateLabel,
        origin + ' \u2192 ' + dest,
        groupLine,
        '',
        '\uD83D\uDC4B ' + needName + ' (' + needPhone + ')' + needTimeNote,
        '"' + (need.raw_message || 'No message') + '"',
        '',
        '\uD83D\uDE97 ' + offerName + ' (' + offerPhone + ')' + offerTimeNote,
        '"' + (offer.raw_message || 'No message') + '"',
        '',
        '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
        '\uD83D\uDCE8 Message to send ' + needFirstName + ':',
        '"' + riderMsg + '"',
        '',
        '\uD83D\uDCE8 Message to send ' + offerFirstName + ':',
        '"' + driverMsg + '"',
        '',
        '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
        '\uD83D\uDD35 Reply INTERESTED / NOT NEEDED to track'
    ].join('\n');
}

// ── Build + Send Digest ──────────────────────────────────────────────────

async function buildDigestMessage() {
    var matches = await fetchOpenMatches();
    if (matches.length === 0) return { text: null, matchIds: [] };

    var now = new Date().toLocaleString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
    });

    var header = '\uD83C\uDFAF Aggie Connect Digest \u2014 ' +
        matches.length + ' open match' + (matches.length !== 1 ? 'es' : '') +
        '\n' + now + ' CST\n';

    var divider = '\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n';

    var blocks = matches.map(formatMatchBlock);
    var body = blocks.join('\n' + divider + '\n');

    return {
        text: header + divider + body,
        matchIds: matches.map(function(m) { return m.matchId; })
    };
}

async function sendDigest() {
    console.log('[Digest] Building digest...');

    if (!ADMIN_JID) {
        console.error('[Digest] ADMIN_WA_NUMBER not set in .env');
        return { sent: false, reason: 'no_admin_number' };
    }

    if (!isReady || !sock) {
        console.error('[Digest] Baileys not connected');
        return { sent: false, reason: 'not_connected' };
    }

    var digestData;
    try {
        digestData = await buildDigestMessage();
    } catch (err) {
        console.error('[Digest] Error building digest:', err.message);
        return { sent: false, reason: 'build_error', error: err.message };
    }

    if (!digestData.text) {
        console.log('[Digest] No open matches');
        try {
            await sock.sendMessage(ADMIN_JID, {
                text: '\u2705 Aggie Connect Digest: No new matches right now. All clear!'
            });
        } catch (err) {
            console.error('[Digest] Failed to send all-clear:', err.message);
        }
        return { sent: true, matches: 0 };
    }

    try {
        await sock.sendMessage(ADMIN_JID, { text: digestData.text });
        console.log('[Digest] Sent digest with ' + digestData.matchIds.length + ' match(es)');
        await markNotified(digestData.matchIds);
        return { sent: true, matches: digestData.matchIds.length };
    } catch (err) {
        console.error('[Digest] Failed to send:', err.message);
        return { sent: false, reason: 'send_error', error: err.message };
    }
}

// ── Scheduler (native setTimeout, no node-cron needed) ───────────────────

function scheduleNextDigest() {
    var now = new Date();
    var target = new Date(now);
    target.setHours(9, 0, 0, 0);
    if (target <= now) {
        target.setDate(target.getDate() + 1);
    }

    var msUntil = target - now;
    var hoursUntil = (msUntil / 3600000).toFixed(1);
    console.log('[Digest] Next digest in ' + hoursUntil + 'h (' +
        target.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) +
        ' CST)');

    setTimeout(async function() {
        await sendDigest();
        scheduleNextDigest();
    }, msUntil);
}

// ── Baileys Connection ───────────────────────────────────────────────────

async function connect() {
    var authResult = await useMultiFileAuthState(AUTH_DIR);
    var state = authResult.state;
    var saveCreds = authResult.saveCreds;
    var versionResult = await fetchLatestBaileysVersion();
    var version = versionResult.version;

    sock = makeWASocket({
        version: version,
        auth: state,
        logger: silentLogger,
        // printQRInTerminal deprecated in latest Baileys; QR handled via connection.update
        syncFullHistory: false,
        markOnlineOnConnect: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', function(update) {
        var connection = update.connection;
        var lastDisconnect = update.lastDisconnect;

        if (update.qr) {
            console.log('\n=== Scan this QR code with WhatsApp ===\n');
            qrcode.generate(update.qr, { small: true });
            console.log('Open WhatsApp > Settings > Linked Devices > Link a Device\n');
        }

        if (connection === 'open') {
            reconnectAttempts = 0;
            isReady = true;
            console.log('[Digest] Connected to WhatsApp');
        }

        if (connection === 'close') {
            isReady = false;
            var reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            console.log('[Digest] Disconnected (reason: ' + reason + ')');

            if (reason === DisconnectReason.loggedOut) {
                console.error('[Digest] Logged out \u2014 auth expired. Re-scan QR on next start.');
                fs.rmSync(AUTH_DIR, { recursive: true, force: true });
                process.exit(1);
            }

            if (reason === DisconnectReason.connectionReplaced) {
                console.error('[Digest] Connection replaced \u2014 another instance using this auth. Exiting.');
                process.exit(1);
            }

            if (reconnectAttempts < MAX_RECONNECT) {
                reconnectAttempts++;
                var delay = Math.min(reconnectAttempts * 10, 60);
                console.log('[Digest] Reconnecting in ' + delay + 's (attempt ' + reconnectAttempts + '/' + MAX_RECONNECT + ')...');
                setTimeout(connect, delay * 1000);
            } else {
                console.error('[Digest] Max reconnect attempts reached. Exiting.');
                process.exit(1);
            }
        }
    });
}

// ── Express Server ───────────────────────────────────────────────────────

var app = express();

app.get('/health', function(req, res) {
    res.json({
        status: isReady ? 'connected' : 'disconnected',
        adminJid: ADMIN_JID || 'NOT SET',
        authDir: AUTH_DIR,
        uptime: Math.round(process.uptime()) + 's'
    });
});

app.get('/send-digest', async function(req, res) {
    console.log('[Digest] Manual trigger via /send-digest');
    try {
        var result = await sendDigest();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', function() {
    console.log('[Digest] Express server on port ' + PORT);
});

// ── Watchdog ─────────────────────────────────────────────────────────────

setInterval(function() {
    if (!isReady) return;
    if (!sock?.user) {
        console.error('[Digest] Watchdog: connection lost, exiting for PM2 restart');
        process.exit(1);
    }
}, 5 * 60 * 1000);

// ── Signals ──────────────────────────────────────────────────────────────

process.on('SIGINT', function() { console.log('[Digest] Shutting down...'); process.exit(0); });
process.on('SIGTERM', function() { console.log('[Digest] SIGTERM, shutting down...'); process.exit(0); });
process.on('uncaughtException', function(err) { console.error('[Digest] Uncaught:', err.message); });
process.on('unhandledRejection', function(err) { console.error('[Digest] Unhandled:', err?.message || err); });

// ── Start ────────────────────────────────────────────────────────────────

console.log('\n=== Aggie Connect Digest (v3) ===\n');
console.log('Admin: ' + (ADMIN_JID || 'NOT SET'));
console.log('Auth:  ' + AUTH_DIR);
console.log('Port:  ' + PORT);
console.log('');

connect();
scheduleNextDigest();
