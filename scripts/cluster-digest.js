/**
 * cluster-digest.js
 * Runs hourly via PM2 cron. Finds clusters with ≥2 members, queues
 * forward-ready WA messages to Gaurav's number. Bot polls outbound_queue
 * and delivers them via Baileys.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { buildClusters } = require('../lib/helpers');

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const GAURAV_PHONE = '919953477576'; // +91-9953477576
const BASE_URL     = 'https://ridesplit.app';
const DEDUP_HOURS  = 24; // skip contact if already notified within this window

function today() {
    return new Date().toISOString().slice(0, 10);
}

function buildWaLink(phone, name, from, to, date) {
    const deepLink = `${BASE_URL}/?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${date ? '&date=' + date : ''}`;
    const text = [
        `Hi ${name}, this is Gaurav MS MIS '26 I made ridesplit.app .`,
        `You're not a user currently. But I saw a lot of matches so I thought I should let you know.`,
        `you could login and check it out: ${deepLink}`,
        ``,
        `let me know if you have any questions.`
    ].join('\n');
    const digits = (phone || '').replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}

function formatDigestMessage(member, clusterFrom, clusterTo, clusterDate, totalCount) {
    const name    = member.sender_name || 'them';
    const phone   = member.source_contact || '';
    const msgText = member.raw_message || '(no message)';
    const type    = member.request_type === 'offer' ? 'OFFERING' : 'LOOKING';
    const waLink  = buildWaLink(phone, name, clusterFrom, clusterTo, clusterDate);

    const lines = [
        `📍 ${clusterFrom} → ${clusterTo}${clusterDate ? ' | ' + clusterDate : ''} (${totalCount} matched)`,
        ``,
        `${type}: ${name}`,
        `"${msgText}"`,
    ];
    if (waLink) {
        lines.push(``, `Tap to forward 👇`, waLink);
    } else {
        lines.push(``, `(no phone on file — check dashboard)`);
    }
    return lines.join('\n');
}

async function run() {
    const cutoff = new Date(Date.now() - DEDUP_HOURS * 60 * 60 * 1000).toISOString();

    // Load already-notified contacts in dedup window
    const { data: recentlySent } = await db
        .from('outbound_queue')
        .select('payload')
        .eq('message_type', 'digest')
        .in('status', ['pending', 'sent'])
        .gte('created_at', cutoff);

    const notifiedContacts = new Set(
        (recentlySent || []).map(r => r.payload?.about_contact).filter(Boolean)
    );

    // Fetch active requests from today onwards
    const { data: requests, error } = await db
        .from('v3_requests')
        .select('id,source_contact,sender_name,request_type,request_origin,request_destination,ride_plan_date,possible_dates,date_fuzzy,raw_message')
        .gte('ride_plan_date', today())
        .order('ride_plan_date', { ascending: true });

    if (error) { console.error('[Digest] DB error:', error.message); process.exit(1); }
    if (!requests || requests.length === 0) { console.log('[Digest] No active requests'); return; }

    const clusters = buildClusters(requests, true);
    const toQueue  = [];

    for (const cl of clusters) {
        const total = cl.offers.length + cl.needs.length;
        if (total < 2) continue;

        const allMembers = cl.offers.concat(cl.needs);
        for (const m of allMembers) {
            const contact = m.source_contact;
            if (!contact) continue;
            if (notifiedContacts.has(contact)) continue;

            toQueue.push({
                contact:          GAURAV_PHONE,
                channel:          'whatsapp',
                message_type:     'digest',
                status:           'pending',
                payload: {
                    message:       formatDigestMessage(m, cl.origin, cl.destination, cl.repDate, total),
                    about_contact: contact,
                    about_name:    m.sender_name,
                    route:         `${cl.origin}→${cl.destination}`,
                    ride_date:     cl.repDate,
                }
            });
            notifiedContacts.add(contact); // prevent double-queuing same person this run
        }
    }

    if (toQueue.length === 0) {
        console.log('[Digest] Nothing new to queue');
        return;
    }

    const { error: insertErr } = await db.from('outbound_queue').insert(toQueue);
    if (insertErr) {
        console.error('[Digest] Insert error:', insertErr.message);
        process.exit(1);
    }
    console.log(`[Digest] Queued ${toQueue.length} message(s) to ${GAURAV_PHONE}`);
}

run().catch(err => { console.error('[Digest] Fatal:', err.message); process.exit(1); });
