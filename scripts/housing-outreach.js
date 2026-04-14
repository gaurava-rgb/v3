/**
 * Generates housing-outreach.csv — deduplicated listings with wa.me links
 * Run: node scripts/housing-outreach.js
 */

require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const HOUSING_PATTERNS = [
    /subleas/i, /\bsublet\b/i, /\blease\b/i, /\bapartment\b/i, /\bapt\b/i,
    /\broom(mate)?\b/i, /\bbedroom\b/i, /\b\d\s*bd\b/i, /\b\d\s*br\b/i,
    /\brent\b/i, /\$\d{2,4}.{0,8}mo/i, /furnished/i, /unfurnished/i,
    /available\s+(may|june|july|aug|dec|jan|fall|spring|summer)/i, /moving out/i,
];

function extract(text) {
    const f = {};

    const price = text.match(/\$\s*(\d[\d,]+)\s*(?:\/\s*(?:mo(?:nth)?)|per\s+mo(?:nth)?)?/i);
    if (price) f.price = '$' + price[1].replace(',', '');

    const neg = /negotiable/i.test(text);
    if (neg) f.negotiable = true;

    const bed = text.match(/(\d)\s*(?:bed(?:room)?s?|br|bd)/i);
    if (bed) f.beds = bed[1];

    const bath = text.match(/(\d(?:\.\d)?)\s*(?:bath(?:room)?s?|ba)\b/i);
    if (bath) f.baths = bath[1];

    // Date range
    const dr = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{0,2}\s*[-–to]+\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{0,2}/i);
    if (dr) f.dates = dr[0].trim();

    if (!f.dates) {
        const av = text.match(/(?:available|starting|from|start)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:\s+\d{1,2})?/i);
        if (av) f.dates = av[0].replace(/^(available|starting|from|start)\s+/i,'').trim();
    }

    // Semester keywords
    if (!f.dates) {
        const sem = text.match(/\b(fall|spring|summer)\s*20\d\d\b/i);
        if (sem) f.dates = sem[0];
    }

    // Complex — no i-flag on name part so only properly-capitalised words match
    const SUFFIXES = 'Apartments?|Apts?|Place|Commons|Crossing|Landing|Village|Lofts?|Flats?|Pointe?|Park|Ranch|Islander|Preserve|Retreat|Reserve|Suites?|Residences?|Townhomes?|Villas?|Manor|Oaks?|Creek|Ridge|Bluff|Terrace|Court|Heights?|Gardens?|Square|Station';
    const BLOCKLIST = /^(College|Station|Bryan|Austin|Dallas|Houston|Texas|TAMU|The\s+apartment|The\s+lease|The\s+room|The\s+subleas)/i;
    const cxPatterns = [
        // "Z Islander", "Z Lofts" — capture whole name including Z prefix
        /\b(Z\s+[A-Z][a-z]+)\b/,
        // "The London Apartments" → "The London Apartments", "Reveille Ranch" → "Reveille Ranch"
        new RegExp(`((?:The\\s+)?[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?\\s+(?:${SUFFIXES}))\\b`),
        // "@ Reveille Ranch" or "at Reveille Ranch" followed by newline/comma
        /(?:@\s*|at\s+)((?:The\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})(?=\s*[\n,])/,
    ];
    for (const p of cxPatterns) {
        const m = text.match(p);
        const candidate = m && m[1];
        if (candidate && candidate.length > 4 && !BLOCKLIST.test(candidate)) {
            f.complex = candidate.trim();
            break;
        }
    }

    // Address
    const addr = text.match(/\d{3,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Rd|Road|St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place))?(?:,\s*(?:Bryan|College Station),?\s*TX(?:,?\s*\d{5})?)?/i);
    if (addr) f.address = addr[0].trim();

    if (/unfurnished/i.test(text)) f.furnished = 'No';
    else if (/furnished/i.test(text)) f.furnished = 'Yes';

    if (/utilities\s+included/i.test(text)) f.utilities = 'Included';
    else if (/\+\s*utilities|utilities\s+not/i.test(text)) f.utilities = 'Not included';

    if (/subleas|sublet/i.test(text)) f.type = 'Sublease';
    else if (/roommate/i.test(text)) f.type = 'Roommate';
    else if (/lease\s+transfer|lease\s+takeover/i.test(text)) f.type = 'Lease transfer';
    else f.type = 'Housing';

    // Phone — grab the most complete one
    const phones = [...text.matchAll(/(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g)];
    if (phones.length) {
        // prefer E.164 format
        const best = phones.map(m => m[0]).sort((a,b) => b.length - a.length)[0];
        f.phone = best.replace(/[^+\d]/g, '');
        if (f.phone.length === 10) f.phone = '1' + f.phone;
    }

    return f;
}

function contentHash(text) {
    // normalize: strip whitespace, lower, remove formatting chars
    const norm = text.replace(/[\s\*\_\~]+/g, ' ').toLowerCase().trim();
    return crypto.createHash('sha256').update(norm).digest('hex').slice(0, 12);
}

function wameLink(phone, name, fields) {
    if (!phone) return '';
    // Normalize to E.164-ish (no +, no dashes)
    const digits = phone.replace(/\D/g,'');

    const complex = fields.complex || 'your place';
    const details = [
        fields.beds ? fields.beds + 'bed' : '',
        fields.baths ? fields.baths + 'bath' : '',
        fields.price || '',
        fields.dates || '',
    ].filter(Boolean).join(', ');

    const msg = `Hey${name ? ' ' + name.split(' ')[0] : ''}! I saw your sublease post in the TAMU group. I'm building a free listing page for Aggies at ridesplit.app — your ${complex} post would look great as a proper listing with photos and a shareable link. The listing won't go live without your approval. Takes 2 min: sign in with your @tamu.edu email, verify with a code, add photos if you want. Want me to set it up?`;

    return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}

function escCsv(val) {
    if (val === null || val === undefined) return '';
    // Collapse all whitespace sequences (including newlines) to a single space
    const s = String(val).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (s.includes(',') || s.includes('"')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

async function main() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Load all wa_contacts into a map: lid/phone → phone
    const contactMap = new Map();
    {
        let off = 0;
        while (true) {
            const { data, error } = await supabase
                .from('wa_contacts')
                .select('lid, phone, name')
                .range(off, off + 999);
            if (error || !data || !data.length) break;
            for (const row of data) {
                if (row.lid)   contactMap.set(row.lid,   { phone: row.phone, name: row.name });
                if (row.phone) contactMap.set(row.phone, { phone: row.phone, name: row.name });
            }
            off += data.length;
            if (data.length < 1000) break;
        }
        console.log(`Loaded ${contactMap.size} contact entries`);
    }

    let offset = 0;
    const PAGE = 1000;
    const seen = new Map(); // hash → entry
    let total = 0;

    while (true) {
        const { data, error } = await supabase
            .from('v3_message_log')
            .select('id, message_text, sender_name, source_group, source_contact, created_at')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .range(offset, offset + PAGE - 1);

        if (error) { console.error(error.message); break; }
        if (!data || !data.length) break;
        total += data.length;

        for (const row of data) {
            const text = row.message_text || '';
            if (text.length < 20) continue;
            if (!HOUSING_PATTERNS.some(p => p.test(text))) continue;

            const hash = contentHash(text);
            if (seen.has(hash)) {
                // just add this group to existing entry if different
                const e = seen.get(hash);
                if (row.source_group && !e.groups.includes(row.source_group)) {
                    e.groups.push(row.source_group);
                }
                continue;
            }

            const fields = extract(text);

            // Resolve sender phone from wa_contacts if not in message text
            if (!fields.phone && row.source_contact) {
                const contact = contactMap.get(row.source_contact);
                if (contact?.phone) fields.phone = contact.phone;
            }
            // Resolve sender name from wa_contacts if missing
            const senderName = row.sender_name || contactMap.get(row.source_contact)?.name || '';

            seen.set(hash, {
                hash,
                text: text.slice(0, 300).replace(/\n/g, ' '),
                sender: senderName,
                groups: row.source_group ? [row.source_group] : [],
                date: row.created_at,
                fields,
            });
        }

        offset += data.length;
        if (data.length < PAGE) break;
    }

    // Secondary dedup: same phone number → keep the most field-complete entry
    const byPhone = new Map();
    for (const entry of seen.values()) {
        const phone = entry.fields.phone;
        if (!phone) continue;
        const existing = byPhone.get(phone);
        if (!existing) { byPhone.set(phone, entry); continue; }
        // Keep whichever has more extracted fields
        const score = e => Object.values(e.fields).filter(Boolean).length;
        if (score(entry) > score(existing)) byPhone.set(phone, entry);
    }
    // Merge: replace phone-duped entries with winners, keep no-phone entries
    const deduped = new Map();
    for (const entry of seen.values()) {
        const phone = entry.fields.phone;
        if (!phone) { deduped.set(entry.hash, entry); continue; }
        const winner = byPhone.get(phone);
        if (winner.hash === entry.hash) deduped.set(entry.hash, entry);
        // else: drop — it's a duplicate phone, the winner is already kept
    }

    const listings = [...deduped.values()].sort((a, b) => new Date(b.date) - new Date(a.date));

    // CSV
    const headers = ['#','Type','Complex','Address','Beds','Baths','Price','Negotiable','Furnished','Utilities','Dates','Sender','Phone','Groups','Posted','Raw (first 200 chars)','WhatsApp Link'];

    const rows = listings.map((l, i) => {
        const f = l.fields;
        return [
            i + 1,
            f.type || '',
            f.complex || '',
            f.address || '',
            f.beds || '',
            f.baths || '',
            f.price || '',
            f.negotiable ? 'Yes' : '',
            f.furnished || '',
            f.utilities || '',
            f.dates || '',
            l.sender,
            f.phone || '',
            l.groups.join(' | '),
            new Date(l.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' }),
            l.text.slice(0, 200),
            wameLink(f.phone, l.sender, f),
        ].map(escCsv).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const outPath = __dirname + '/housing-outreach.csv';
    fs.writeFileSync(outPath, csv, 'utf8');

    console.log(`\nScanned ${total} messages → ${listings.length} unique listings`);
    console.log(`CSV written to: ${outPath}`);
    console.log(`With phone (linkable): ${listings.filter(l => l.fields.phone).length}`);
    console.log(`Without phone:         ${listings.filter(l => !l.fields.phone).length}`);
    console.log(`\nTop complexes:`);
    const cx = {};
    for (const l of listings) if (l.fields.complex) cx[l.fields.complex] = (cx[l.fields.complex]||0)+1;
    Object.entries(cx).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([k,v]) => console.log(`  ${v}x  ${k}`));
}

main().catch(console.error);
