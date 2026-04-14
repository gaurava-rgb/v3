/**
 * Housing message analysis — scans v3_message_log for the past 30 days
 * looking for sublease/housing listings and categorizes what fields appear.
 *
 * Run: node scripts/analyze-housing.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Keywords that suggest a housing post
const HOUSING_PATTERNS = [
    /subleas/i,
    /\bsublet\b/i,
    /\blease\b/i,
    /\bapartment\b/i,
    /\bapt\b/i,
    /\broom(mate)?\b/i,
    /\bbedroom\b/i,
    /\b\d\s*bd\b/i,
    /\b\d\s*br\b/i,
    /\brent\b/i,
    /\bmonth.{0,5}\$\d/i,
    /\$\d{2,4}.{0,8}month/i,
    /\$\d{2,4}.{0,8}mo\b/i,
    /furnished/i,
    /unfurnished/i,
    /utilities/i,
    /available\s+(may|june|july|aug|dec|jan|fall|spring|summer)/i,
    /moving out/i,
];

// Fields we can attempt to extract
function extractHousingFields(text) {
    const fields = {};

    // Price: $XXX or $X,XXX per month
    const priceMatch = text.match(/\$\s*(\d[\d,]+)\s*(?:\/\s*(?:mo(?:nth)?)|per\s+(?:mo(?:nth)?))?/i);
    if (priceMatch) fields.price = '$' + priceMatch[1].replace(',', '');

    // Beds/baths: "2bed/2bath", "2br/1ba", "2bd 2ba", etc.
    const bedMatch = text.match(/(\d)\s*(?:bed(?:room)?s?|br|bd)/i);
    if (bedMatch) fields.beds = parseInt(bedMatch[1]);

    const bathMatch = text.match(/(\d(?:\.\d)?)\s*(?:bath(?:room)?s?|ba)\b/i);
    if (bathMatch) fields.baths = parseFloat(bathMatch[1]);

    // Dates: "May 1", "available June", "June 1 - July 31", etc.
    const dateRangeMatch = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{0,2}\s*[-–to]+\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{0,2}/i);
    if (dateRangeMatch) fields.dateRange = dateRangeMatch[0].trim();

    const availMatch = text.match(/(?:available|starting|from|start)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:\s+\d{1,2})?/i);
    if (availMatch && !fields.dateRange) fields.availableFrom = availMatch[0].replace(/^(?:available|starting|from|start)\s+/i, '').trim();

    // Apartment complex name: often all-caps or title-case followed by "apartments" or known complexes
    const complexPatterns = [
        /\b(The\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:Apartments?|Apts?|Place|Commons|Crossing|Landing|Village|Lofts?|Flats?|Pointe?|Park|Station|Square|Heights?|Gardens?|Court)\b/i,
        /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+Apartments?\b/i,
        /\bat\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i,
    ];
    for (const p of complexPatterns) {
        const m = text.match(p);
        if (m) { fields.complex = m[1].trim(); break; }
    }

    // Type: sublease vs roommate search vs full lease
    if (/subleas|sublet/i.test(text)) fields.listingType = 'sublease';
    else if (/roommate|room(?:mate)?\s+search/i.test(text)) fields.listingType = 'roommate';
    else if (/lease\s+takeover/i.test(text)) fields.listingType = 'lease-takeover';
    else fields.listingType = 'unknown';

    // Furnished?
    if (/unfurnished/i.test(text)) fields.furnished = false;
    else if (/furnished/i.test(text)) fields.furnished = true;

    // Contact: phone number
    const phoneMatch = text.match(/(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
    if (phoneMatch) fields.contactPhone = phoneMatch[0].trim();

    return fields;
}

async function main() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    console.log(`\n=== Housing Message Analysis (past 30 days) ===\n`);
    console.log(`Fetching v3_message_log since ${since.split('T')[0]}...\n`);

    let offset = 0;
    const PAGE = 1000;
    const housingMessages = [];
    let totalScanned = 0;

    while (true) {
        const { data, error } = await supabase
            .from('v3_message_log')
            .select('id, message_text, sender_name, source_group, created_at, is_request, parsed_data')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .range(offset, offset + PAGE - 1);

        if (error) { console.error('Error:', error.message); break; }
        if (!data || data.length === 0) break;

        totalScanned += data.length;

        for (const row of data) {
            const text = row.message_text || '';
            if (!text || text.length < 20) continue;

            const isHousing = HOUSING_PATTERNS.some(p => p.test(text));
            if (isHousing) {
                housingMessages.push({
                    id: row.id,
                    text,
                    sender: row.sender_name,
                    group: row.source_group,
                    date: row.created_at,
                    wasExtracted: row.is_request,
                    fields: extractHousingFields(text)
                });
            }
        }

        offset += data.length;
        if (data.length < PAGE) break;
    }

    console.log(`Scanned: ${totalScanned} messages`);
    console.log(`Housing-related: ${housingMessages.length}\n`);

    // Summary stats
    const fieldCounts = {};
    const listingTypes = {};
    for (const m of housingMessages) {
        for (const k of Object.keys(m.fields)) {
            fieldCounts[k] = (fieldCounts[k] || 0) + 1;
        }
        const t = m.fields.listingType || 'unknown';
        listingTypes[t] = (listingTypes[t] || 0) + 1;
    }

    console.log('--- Listing Type Breakdown ---');
    for (const [t, c] of Object.entries(listingTypes)) {
        console.log(`  ${t}: ${c}`);
    }

    console.log('\n--- Field Extraction Hit Rate ---');
    for (const [f, c] of Object.entries(fieldCounts).sort((a,b) => b[1]-a[1])) {
        const pct = Math.round((c / housingMessages.length) * 100);
        console.log(`  ${f}: ${c}/${housingMessages.length} (${pct}%)`);
    }

    // Show first 10 messages with extracted fields
    console.log(`\n--- Sample Messages (first 10) ---`);
    for (const m of housingMessages.slice(0, 10)) {
        console.log(`\n[${new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' })}] ${m.sender || 'Unknown'}`);
        console.log(`Text: ${m.text.substring(0, 200).replace(/\n/g, ' ')}${m.text.length > 200 ? '...' : ''}`);
        console.log(`Fields: ${JSON.stringify(m.fields)}`);
        console.log(`Was parsed as ride request: ${m.wasExtracted}`);
    }

    console.log('\n=== Done ===\n');
}

main().catch(console.error);
