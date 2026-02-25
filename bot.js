/**
 * Aggie Connect — Baileys Bot v3
 * Runs alongside v2 (aggieconnect-baileys) on same VPS.
 * Uses v3_ prefixed tables, port 3004/3005/3006, PM2 names aggie-v3-*.
 */

require('dotenv').config();

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    isJidGroup,
    isLidUser
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

const { parseMessage } = require('./parser');
const {
    saveRequest, logMessage, messageAlreadyProcessed,
    getStats, loadMonitoredGroups, getGroupUpdates, seedGroups,
    upsertContact, resolveContactPhone
} = require('./db');
const { processRequest, formatMatch } = require('./matcher');

// ── config ─────────────────────────────────────────────────────────────────
const BACKFILL_HOURS  = parseInt(process.env.BACKFILL_HOURS  || '24', 10);
const BACKFILL_LIMIT  = parseInt(process.env.BACKFILL_LIMIT  || '50', 10);
const GROUP_POLL_INTERVAL = 60 * 1000;
const WATCHDOG_INTERVAL   = 5 * 60 * 1000;
const MAX_RECONNECT = 5;

// ── state ──────────────────────────────────────────────────────────────────
const monitoredGroupIds = new Set();
const processedMessages = new Set();
const groupNameCache    = new Map();
const lidToPhone        = new Map();    // maps @lid user IDs to real phone numbers
let lastGroupCheck      = new Date();
let lastGroupFetch      = 0;       // timestamp of last groupFetchAllParticipating call
let reconnectAttempts   = 0;
let isReady             = false;
let sock                = null;
let groupsLoaded        = false;
let pendingHistory      = [];   // buffer history that arrives before groups are loaded

// Suppress Baileys' verbose pino output
const silentLogger = pino({ level: 'silent' });

// ── helpers ────────────────────────────────────────────────────────────────

async function refreshMonitoredGroups() {
    const groups = await loadMonitoredGroups();
    monitoredGroupIds.clear();
    groups.forEach(g => monitoredGroupIds.add(g.group_id));
    return groups.length;
}

function extractBody(msg) {
    if (!msg.message) return null;
    const m = msg.message;
    return m.conversation
        || m.extendedTextMessage?.text
        || m.imageMessage?.caption
        || m.videoMessage?.caption
        || null;
}

async function getGroupName(jid) {
    if (groupNameCache.has(jid)) return groupNameCache.get(jid);
    try {
        const meta = await sock.groupMetadata(jid);
        groupNameCache.set(jid, meta.subject);
        return meta.subject;
    } catch {
        return jid;
    }
}

async function resolveSenderNumber(jid) {
    const raw = jid.split('@')[0];
    if (!isLidUser(jid)) return raw;              // already a real phone number
    if (lidToPhone.has(raw)) return lidToPhone.get(raw);  // in-memory cache hit
    const fromDb = await resolveContactPhone(raw); // DB fallback
    if (fromDb) {
        lidToPhone.set(raw, fromDb);              // warm the cache
        return fromDb;
    }
    return raw;                                   // still a LID — best we can do
}

// ── core message handler ───────────────────────────────────────────────────

async function processOneMessage(msg, groupName, isBackfill = false) {
    const msgId = msg.key.id;
    if (!msgId || processedMessages.has(msgId)) return;
    processedMessages.add(msgId);

    const body = extractBody(msg);
    if (!body || body.length < 3) return;

    const senderJid    = msg.key.participant || msg.key.remoteJid;
    const senderNumber = await resolveSenderNumber(senderJid);
    const senderName   = msg.pushName || 'Unknown';

    const parsed = await parseMessage(body, senderName);

    await logMessage({
        waMessageId:  msgId,
        sourceGroup:  groupName,
        sourceContact: senderNumber,
        senderName,
        messageText:  body,
        isRequest:    parsed.isRequest || false,
        parsedData:   parsed,
        error:        parsed._error || null
    });

    if (!parsed.isRequest) return;

    const request = await saveRequest({
        source:        'whatsapp-baileys-v3',
        sourceGroup:   groupName,
        sourceContact: senderNumber,
        senderName,
        type:          parsed.type,
        category:      parsed.category,
        date:          parsed.date,
        ridePlanTime:  parsed.ride_plan_time,
        dateFuzzy:     parsed.date_fuzzy,
        possibleDates: parsed.possible_dates,
        timeFuzzy:     parsed.time_fuzzy,
        origin:        parsed.origin,
        destination:   parsed.destination,
        details:       parsed.details || {},
        rawMessage:    body
    });

    if (!request) return;

    const matches = await processRequest(request);
    if (matches.length > 0) {
        console.log(`[Bot] ${matches.length} match(es)!`);
        matches.forEach(m => console.log('\n' + formatMatch(m)));
    }
}

// ── backfill (via messaging-history.set) ──────────────────────────────────

async function processHistoryMessages(messages) {
    if (!messages || messages.length === 0) return;

    const since = Date.now() - BACKFILL_HOURS * 60 * 60 * 1000;
    let processed = 0;

    console.log(`\n[Bot] Backfill: processing ${messages.length} history message(s)...`);

    for (const msg of messages) {
        const jid = msg.key?.remoteJid;
        if (!jid || !isJidGroup(jid)) continue;
        if (monitoredGroupIds.size > 0 && !monitoredGroupIds.has(jid)) continue;

        const ts = (msg.messageTimestamp || 0) * 1000;
        if (ts < since) continue;

        const body = extractBody(msg);
        if (!body || body.length < 3) continue;

        const alreadyDone = await messageAlreadyProcessed(msg.key.id);
        if (alreadyDone) continue;

        const groupName = await getGroupName(jid);

        try {
            await processOneMessage(msg, groupName, true);
            processed++;
        } catch (err) {
            console.error('[Bot] Backfill error:', err.message);
        }
    }

    if (processed > 0) {
        console.log(`[Bot] Backfill done: ${processed} new message(s) processed\n`);
    }
}

// ── startup ────────────────────────────────────────────────────────────────

async function onConnected() {
    reconnectAttempts = 0;
    isReady = true;
    console.log('\n[Bot] Connected to WhatsApp! (Baileys v3)');

    // Fetch all groups and seed monitored_groups table (max once per 5 min)
    let allGroups = {};
    const now = Date.now();
    if (now - lastGroupFetch > 5 * 60 * 1000) {
        try {
            allGroups = await sock.groupFetchAllParticipating();
            lastGroupFetch = now;
        } catch (err) {
            console.error('[Bot] Could not fetch groups:', err.message);
        }
    } else {
        console.log('[Bot] Skipping group fetch (cooldown — reconnected too soon)');
    }

    // Populate name cache
    for (const [jid, meta] of Object.entries(allGroups)) {
        groupNameCache.set(jid, meta.subject);
    }

    // Extract LID→phone mappings from group participants.
    // WA sends both id (@s.whatsapp.net) and lid (@lid) for participants in some groups.
    let mappingsExtracted = 0;
    for (const [, meta] of Object.entries(allGroups)) {
        for (const participant of (meta.participants || [])) {
            const pid  = participant.id  || '';
            const plid = participant.lid || '';
            if (pid.endsWith('@s.whatsapp.net') && plid.endsWith('@lid')) {
                const phone = pid.split('@')[0];
                const lid   = plid.split('@')[0];
                if (!lidToPhone.has(lid)) {
                    lidToPhone.set(lid, phone);
                    mappingsExtracted++;
                    upsertContact(lid, phone, participant.notify || participant.name || null)
                        .catch(err => console.error('[Bot] Failed to persist participant mapping:', err.message));
                }
            }
        }
    }
    if (mappingsExtracted > 0) {
        console.log(`[Bot] Extracted ${mappingsExtracted} LID→phone mapping(s) from group participants`);
    }

    const waGroups = Object.entries(allGroups).map(([id, meta]) => ({
        id,
        name: meta.subject
    }));

    await seedGroups(waGroups);

    const count = await refreshMonitoredGroups();
    lastGroupCheck = new Date();

    console.log(`\n[Bot] Available groups (${waGroups.length}):\n`);
    waGroups.forEach(g => {
        const monitored = monitoredGroupIds.has(g.id);
        console.log(`  ${monitored ? '[monitoring] ' : ''}${g.name}`);
        console.log(`    ID: ${g.id}\n`);
    });

    if (count === 0) {
        console.log('[Bot] No active groups in DB — activate groups in Supabase.\n');
    } else {
        console.log(`[Bot] Monitoring ${count} group(s) (from DB)\n`);
    }

    const stats = await getStats();
    console.log(`[Bot] DB: ${stats.total} requests (${stats.open} open, ${stats.matched} matched)\n`);

    // Flush any history that arrived before groups were loaded
    groupsLoaded = true;
    if (pendingHistory.length > 0) {
        console.log(`[Bot] Flushing ${pendingHistory.length} buffered history message(s)...`);
        const toProcess = pendingHistory.splice(0);
        await processHistoryMessages(toProcess);
    }
}

// ── connect ────────────────────────────────────────────────────────────────

async function connect() {
    const { state, saveCreds } = await useMultiFileAuthState('.v3_auth');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger: silentLogger,
        printQRInTerminal: false,   // we handle QR ourselves
        syncFullHistory: false,     // true = 401 on linked devices (WA policy); real-time only
        markOnlineOnConnect: false  // don't show online status
    });

    sock.ev.on('creds.update', saveCreds);

    // Build lid→phone mapping from contact updates sent by WhatsApp.
    // c.phoneNumber is the @s.whatsapp.net JID (docs v7+); c.lid is the @lid JID.
    // contacts.upsert: fires for personal contacts when WA sends app-state patches.
    // Provides both c.id (phone JID) and c.lid (LID JID) when available.
    // Does NOT fire for group-only participants — those are handled via group metadata above.
    sock.ev.on('contacts.upsert', async (contacts) => {
        let newMappings = 0;
        for (const c of contacts) {
            const phoneRaw = c.id?.endsWith('@s.whatsapp.net') ? c.id : null;
            const lidRaw   = c.lid || (c.id?.endsWith('@lid') ? c.id : null);
            const phone    = phoneRaw?.split('@')[0];
            const lid      = lidRaw?.split('@')[0];
            const name     = c.notify || c.name || null;

            if (phone && lid) {
                lidToPhone.set(lid, phone);
                newMappings++;
                upsertContact(lid, phone, name).catch(err =>
                    console.error('[Bot] Failed to persist contact mapping:', err.message)
                );
            }
        }
        if (newMappings > 0) {
            console.log(`[Bot] contacts.upsert: ${newMappings} new LID→phone mapping(s)`);
        }
    });

    // lid-mapping.update: explicit LID↔PN pairs from WA protocol (rare but handled)
    sock.ev.on('lid-mapping.update', async (mappings) => {
        let newMappings = 0;
        for (const { lid, pn } of (mappings || [])) {
            const lidNum = lid?.split('@')[0];
            const phone  = pn?.split('@')[0];
            if (lidNum && phone) {
                lidToPhone.set(lidNum, phone);
                newMappings++;
                upsertContact(lidNum, phone, null).catch(err =>
                    console.error('[Bot] Failed to persist lid-mapping:', err.message)
                );
            }
        }
        if (newMappings > 0) {
            console.log(`[Bot] lid-mapping.update: ${newMappings} mapping(s) received`);
        }
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n=== Scan this QR code with WhatsApp ===\n');
            qrcode.generate(qr, { small: true });
            console.log('Open WhatsApp > Settings > Linked Devices > Link a Device\n');
        }

        if (connection === 'open') {
            await onConnected();
        }

        if (connection === 'close') {
            isReady = false;
            groupsLoaded = false;
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            const loggedOut = reason === DisconnectReason.loggedOut;

            console.log(`\n[Bot] Disconnected (reason: ${reason})`);

            if (loggedOut) {
                console.error('[Bot] Logged out — clearing stale auth for fresh QR on next start.');
                fs.rmSync('.v3_auth', { recursive: true, force: true });
                process.exit(1);
            }

            if (reason === DisconnectReason.connectionReplaced) {
                console.error('[Bot] Connection replaced — another instance is running with this auth. Exiting.');
                process.exit(1);
            }

            if (reconnectAttempts < MAX_RECONNECT) {
                reconnectAttempts++;
                const delay = Math.min(reconnectAttempts * 10, 60);
                console.log(`[Bot] Reconnecting in ${delay}s (attempt ${reconnectAttempts}/${MAX_RECONNECT})...`);
                setTimeout(connect, delay * 1000);
            } else {
                console.error('[Bot] Max reconnect attempts reached. Exiting.');
                process.exit(1);
            }
        }
    });

    // History backfill: fires when WhatsApp sends message history on connect.
    // May arrive before onConnected() finishes loading groups — buffer if so.
    sock.ev.on('messaging-history.set', async ({ messages }) => {
        const msgs = messages || [];
        console.log(`[Bot] messaging-history.set: ${msgs.length} message(s) received`);
        if (!groupsLoaded) {
            pendingHistory.push(...msgs);
            console.log(`[Bot] Groups not loaded yet — buffered ${pendingHistory.length} total`);
        } else {
            await processHistoryMessages(msgs);
        }
    });

    // Real-time incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            try {
                const jid = msg.key?.remoteJid;
                if (!jid || !isJidGroup(jid)) continue;
                if (monitoredGroupIds.size > 0 && !monitoredGroupIds.has(jid)) continue;
                if (msg.key.fromMe) continue;

                const body = extractBody(msg);
                if (!body || body.length < 3) continue;

                const groupName = await getGroupName(jid);
                console.log(`\n[${groupName}] ${msg.pushName || 'Unknown'}: ${body.substring(0, 60)}${body.length > 60 ? '...' : ''}`);

                await processOneMessage(msg, groupName);
            } catch (err) {
                console.error('[Bot] Error processing message:', err.message);
            }
        }
    });
}

// ── group poll ─────────────────────────────────────────────────────────────

setInterval(async () => {
    try {
        const hasChanges = await getGroupUpdates(lastGroupCheck);
        if (hasChanges) {
            const count = await refreshMonitoredGroups();
            console.log(`[Bot] Group list updated: now monitoring ${count} group(s)`);
        }
        lastGroupCheck = new Date();
    } catch (err) {
        console.error('[Bot] Group poll error:', err.message);
    }
}, GROUP_POLL_INTERVAL);

// ── watchdog ───────────────────────────────────────────────────────────────

setInterval(() => {
    if (!isReady) return;
    if (!sock?.user) {
        console.error('[Bot] Watchdog: sock.user is null — connection lost, exiting for pm2 restart');
        process.exit(1);
    }
}, WATCHDOG_INTERVAL);

// ── memory cleanup ─────────────────────────────────────────────────────────

setInterval(() => {
    if (processedMessages.size > 10000) processedMessages.clear();
    if (groupNameCache.size > 500) groupNameCache.clear();
}, 60 * 60 * 1000);

// ── signals ────────────────────────────────────────────────────────────────

process.on('SIGINT', () => {
    console.log('\n[Bot] Shutting down...');
    process.exit(0);
});

process.on('uncaughtException',    err => console.error('[Bot] Uncaught exception:', err.message));
process.on('unhandledRejection',   err => console.error('[Bot] Unhandled rejection:', err?.message || err));

// ── start ──────────────────────────────────────────────────────────────────

console.log('\n=== Aggie Connect Bot (Baileys v3) ===\n');
console.log('Initializing...\n');
connect();
