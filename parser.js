/**
 * LLM Parser - Uses OpenRouter to extract structured data from messages.
 * v3: adds fuzzy date/time fields (date_fuzzy, possible_dates, ride_plan_time, time_fuzzy).
 */

const OpenAI = require('openai');

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY
});

const MODEL = process.env.LLM_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';

function buildSystemPrompt(receivedAt = new Date()) {
    const today = receivedAt.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
    const dayName = receivedAt.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
    const hhmm = receivedAt.toLocaleTimeString('en-GB', {
        timeZone: 'America/Chicago',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    // Extract short TZ name (CDT vs CST) via formatToParts
    const tzParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        timeZoneName: 'short'
    }).formatToParts(receivedAt);
    const tzShort = tzParts.find(p => p.type === 'timeZoneName')?.value || 'CT';

    return `You are a message parser for a university community platform at Texas A&M.
Analyze WhatsApp messages and extract structured information.

IMPORTANT: Most messages are casual chat. Only extract data when someone is clearly:
- Looking for a ride or offering a ride
- Asking for help or offering help
- Posting about housing (sublease, roommate, lease transfer)

For casual messages (greetings, jokes, replies, reactions, thank yous), return:
{"isRequest": false}

--- RIDE MESSAGES ---

When you detect a ride need or offer, return:
{
  "isRequest": true,
  "type": "need" or "offer",
  "category": "ride",
  "date": "YYYY-MM-DD" or null,
  "date_fuzzy": boolean,
  "possible_dates": ["YYYY-MM-DD", ...],
  "ride_plan_time": "HH:MM" or null,
  "time_fuzzy": boolean,
  "origin": "location" or null,
  "destination": "location" or null,
  "details": {
    "seats": number or null,
    "gasContribution": string or null,
    "description": string
  },
  "tags": ["airport"|"uscis"|"dps"|"ssn", ...],
  "return_leg": { "date": "YYYY-MM-DD" or null, "ride_plan_time": "HH:MM" or null, "origin": "location" or null, "destination": "location" or null, "date_fuzzy": boolean, "time_fuzzy": boolean } or null
}

ROUND-TRIP DETECTION:
If the message describes a round-trip (mentions "and back", "return ride", "return trip",
"coming back", "both ways", or "↔"), populate return_leg with the reverse trip.
- return_leg.origin = outbound destination
- return_leg.destination = outbound origin
- If only outbound details are given (e.g. "and back" with no return date), set the
  inner return_leg fields to null but still populate the return_leg OBJECT (so we know
  it's a round-trip).
- For single-leg (one-way) messages, set return_leg to null EXPLICITLY (not undefined).

Round-trip examples:
- "Ride available from cstat to Dallas Friday And back from Dallas to cstat Sunday"
  -> offer ride, origin=College Station, destination=Dallas, date=Friday,
     return_leg: {date: Sunday, origin: "Dallas", destination: "College Station",
                  date_fuzzy: false, time_fuzzy: true, ride_plan_time: null}
- "Ride to Houston tomorrow morning and back same day"
  -> offer ride, origin=College Station, destination=Houston, date=tomorrow,
     return_leg: {date: <same as outbound>, origin: "Houston", destination: "College Station",
                  date_fuzzy: false, time_fuzzy: true, ride_plan_time: null}
- "Looking for ride to Houston Apr 23 and back Apr 25"
  -> need ride, origin=College Station, destination=Houston, date=2026-04-23,
     return_leg: {date: 2026-04-25, origin: "Houston", destination: "College Station",
                  date_fuzzy: false, time_fuzzy: true, ride_plan_time: null}

isRequest = true for BOTH needs (looking for a ride) AND offers (providing a ride).
isRequest = false ONLY for casual chat (greetings, reactions, replies, thank yous).

Common ride patterns (all return isRequest: true):
- "anyone going to Houston?" -> need, ride
- "can drop 2 people to DFW" -> offer, ride
- "need ride to IAH Friday" -> need, ride
- "driving to Dallas, 3 spots" -> offer, ride
- "Ride available from CS to Dallas" -> offer, ride
- "Ride available tomorrow to Houston" -> offer, ride
- "giving ride to Houston Friday" -> offer, ride
- "offering ride to DFW this weekend" -> offer, ride
- "need help moving" -> need, help
- "can help with groceries" -> offer, help
- "if anyone going from Dallas to CS plz dm" -> need, ride, origin="Dallas", destination="College Station"
- "anyone driving from Houston to cstat tomorrow" -> need, ride, origin="Houston", destination="College Station"

CRITICAL: when message contains "from X to Y" pattern, ALWAYS set origin=X, destination=Y. Never default origin to College Station if "from <city>" is explicit.

--- HOUSING MESSAGES ---

When you detect a housing listing (sublease, roommate search, lease transfer), return:
{
  "isRequest": true,
  "type": "offer",
  "category": "housing",
  "housing": {
    "listing_type": "sublease" | "roommate" | "lease_transfer" | "other",
    "location": "string or null",
    "price": integer dollars per month or null,
    "available_date": "YYYY-MM-DD" or null,
    "end_date": "YYYY-MM-DD" or null,
    "bedrooms": integer or null,
    "bathrooms": number or null,
    "contact_info": "raw contact string or null",
    "amenities": ["pool", "gym", "utilities_included", ...]
  }
}

Housing trigger keywords: sublease, sublet, roommate, bedroom, lease, rent, furnished,
utilities, /mo, $/month, apartment, available, 1br, 2br, 1bd, 2bd, bath, sqft.

Common housing patterns:
- "subletting my apartment May-Aug, $900/mo" -> housing, sublease
- "looking for roommate for 2br/2ba near campus" -> housing, roommate
- "need someone to take over my lease" -> housing, lease_transfer
- "furnished room available June 1st, $650/mo, utilities included" -> housing, sublease

Today is ${dayName}, ${today}. Current time: ${hhmm} ${tzShort}. Resolve relative dates:
- "tomorrow" -> next day
- "Friday" -> the upcoming Friday
- "this weekend" -> upcoming Saturday

If the message contains BOTH a relative date AND an explicit date, ALWAYS use the explicit date.
- "tomorrow (feb 22)" -> 2026-02-22 (use the explicit date, NOT "tomorrow")
- "this friday (feb 28)" -> 2026-02-28 (use the explicit date)
- "next week monday" -> resolve normally (no explicit date given)

DATE FUZZINESS:
- Single confirmed date -> date_fuzzy: false, possible_dates: []
- Flexible ("today or tomorrow", "Friday or Saturday", "sometime next week") ->
    date_fuzzy: true, possible_dates: ["YYYY-MM-DD", "YYYY-MM-DD", ...]
- No date at all -> date: null, date_fuzzy: false, possible_dates: []

TIME:
- Clearly stated -> ride_plan_time as 24h "HH:MM" (e.g. "3pm" -> "15:00", "10am" -> "10:00")
- Approximate ("around 3", "afternoon", "morning") -> time_fuzzy: true, ride_plan_time: best guess or null
- Not mentioned at all -> ride_plan_time: null, time_fuzzy: true

CITIES (use exactly these names — single bucket per metro):
- "College Station" — for: CS, cstat, c station, college station
- "Bryan" — for: bryan, BCS (when context is Bryan side)
- "Houston" — for ALL Houston-area destinations (IAH, Bush, Hobby, downtown). Do NOT split.
- "Dallas" — for Dallas, Plano, Richardson, Frisco, Irving, Arlington, McKinney, Denton (Dallas metro). Do NOT split into "Dallas DFW".
- "Fort Worth" — separate city, NOT Dallas
- "Austin" — for: austin, ATX, Round Rock. Do NOT split into "Austin Airport".
- "San Antonio"

TAGS (apply only when message explicitly mentions these tokens):
- "airport" — IAH, Bush, Hobby, DFW, "<city> airport", flight, fly out, pickup at airport
- "uscis" — USCIS, biometrics, immigration appointment, OPT biometrics
- "dps" — DPS, "driver license", "license test", "road test", "Texas DPS"
- "ssn" — SSN, SSA, Social Security, social security office

TAG RULES:
- Bare city name with no tag-token in message → tags=[]
- DPS office is in Bryan, TX → if "DPS" mentioned and no other city given, destination="Bryan", tags=["dps"]
- SSA office is in Bryan, TX → if "SSN"/"SSA"/"social security" mentioned and no other city given, destination="Bryan", tags=["ssn"]
- Multiple tags allowed when both tokens present (rare)
- Apply tags symmetrically: "from IAH to CS" → origin="Houston", destination="College Station", tags=["airport"]
- For one-way messages with no tag-tokens, return tags=[] (NOT null)

Default origin is "College Station" if not specified and category is ride.

ONLY return valid JSON. No explanation, no markdown.`;
}

async function parseMessage(message, senderName = '', receivedAt = new Date()) {
    if (!message || message.length < 5) {
        return { isRequest: false };
    }

    const skipPatterns = [
        /^(hi|hey|hello|thanks|thank you|ok|okay|lol|haha|yes|no|sure|nice|cool|great|good|bye|gm|gn|sup|yo|bruh|bro)[\s!.?]*$/i,
        /^[\p{Emoji}\s]+$/u,
        /^https?:\/\//i
    ];

    if (skipPatterns.some(p => p.test(message.trim()))) {
        return { isRequest: false };
    }

    try {
        const llmMessages = [
            { role: 'system', content: buildSystemPrompt(receivedAt) },
            { role: 'user', content: `Message from ${senderName || 'user'}:\n"${message}"` }
        ];

        let response;
        try {
            response = await openai.chat.completions.create({
                model: MODEL, messages: llmMessages, temperature: 0.1, max_tokens: 350
            });
        } catch (firstErr) {
            console.warn(`[Parser] LLM call failed (attempt 1/2): ${firstErr.message?.substring(0, 100)}`);
            await new Promise(r => setTimeout(r, 2000));
            response = await openai.chat.completions.create({
                model: MODEL, messages: llmMessages, temperature: 0.1, max_tokens: 350
            });
            console.log('[Parser] LLM retry succeeded (attempt 2/2)');
        }

        const content = response.choices[0]?.message?.content?.trim();
        if (!content) return { isRequest: false };

        let jsonStr = content;
        const codeBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlock) jsonStr = codeBlock[1].trim();

        const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (objectMatch) jsonStr = objectMatch[0];

        const parsed = JSON.parse(jsonStr);

        if (parsed.isRequest) {
            if (parsed.category === 'ride') {
                // Backstop: explicit "from <city>" overrides LLM origin only.
                // Don't touch destination — LLM normalizes airports better than regex.
                const fromMatch = message.match(/\bfrom\s+([A-Za-z][A-Za-z\s]{1,30}?)\s+to\b/i);
                if (fromMatch) {
                    const city = fromMatch[1].trim();
                    if (city.toLowerCase() !== 'to' && city.length >= 2) {
                        parsed.origin = city;
                    }
                }
                if (!parsed.origin) parsed.origin = 'College Station';
            }

            if (parsed.category === 'ride') {
                // Ensure v3 fuzzy fields always have defaults
                parsed.date_fuzzy     = parsed.date_fuzzy     ?? false;
                parsed.possible_dates = parsed.possible_dates ?? [];
                parsed.ride_plan_time = parsed.ride_plan_time ?? null;
                parsed.time_fuzzy     = parsed.time_fuzzy     ?? true;
                parsed.tags           = Array.isArray(parsed.tags) ? parsed.tags.filter(t => ['airport','uscis','dps','ssn','flexible'].includes(t)) : [];

                // Round-trip: normalize return_leg if present, else explicit null
                if (parsed.return_leg && typeof parsed.return_leg === 'object') {
                    const rl = parsed.return_leg;
                    parsed.return_leg = {
                        date:           rl.date           ?? null,
                        ride_plan_time: rl.ride_plan_time ?? null,
                        origin:         rl.origin         ?? null,
                        destination:    rl.destination    ?? null,
                        date_fuzzy:     rl.date_fuzzy     ?? (rl.date == null),
                        time_fuzzy:     rl.time_fuzzy     ?? (rl.ride_plan_time == null)
                    };
                } else {
                    parsed.return_leg = null;
                }

                console.log(`[Parser] Extracted: ${parsed.type} ${parsed.category} -> ${parsed.destination || 'N/A'} on ${parsed.date || 'N/A'} (date_fuzzy=${parsed.date_fuzzy}, time_fuzzy=${parsed.time_fuzzy}${parsed.return_leg ? ', round-trip' : ''})`);
            } else if (parsed.category === 'housing') {
                // Ensure housing sub-object always exists with null defaults
                const h = parsed.housing || {};
                parsed.housing = {
                    listing_type:   h.listing_type   ?? null,
                    location:       h.location       ?? null,
                    price:          h.price          ?? null,
                    available_date: h.available_date ?? null,
                    end_date:       h.end_date       ?? null,
                    bedrooms:       h.bedrooms       ?? null,
                    bathrooms:      h.bathrooms      ?? null,
                    contact_info:   h.contact_info   ?? null,
                    amenities:      h.amenities      ?? []
                };

                console.log(`[Parser] Housing: ${parsed.housing.listing_type} in ${parsed.housing.location} @ $${parsed.housing.price}/mo`);
            }
        }

        return parsed;

    } catch (error) {
        console.error('[Parser] Error:', error.message?.substring(0, 100));
        return { isRequest: false, _error: error.message };
    }
}

module.exports = { parseMessage };
