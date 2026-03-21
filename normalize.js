/**
 * Shared location normalizer.
 * Maps common variants to a standard form so DB exact-match works.
 * Unknown locations pass through as lowercase/trimmed.
 */

const LOCATION_MAP = {
    'Houston IAH': [
        'iah', 'bush', 'george bush', 'houston airport', 'houston intl',
        'iah (houston airport)', 'iah (houston)', 'houston iah',
        'bush intercontinental'
    ],
    'Houston Hobby': ['hobby', 'hou airport'],
    'Houston': ['houston'],
    'Dallas DFW': [
        'dfw', 'dallas airport', 'dallas/fort worth', 'dallas fort worth',
        'dallas-fort worth'
    ],
    'Dallas': ['dallas', 'plano', 'richardson', 'frisco', 'irving'],
    'Austin': ['austin'],
    'Austin Airport': ['austin airport', 'austin-bergstrom', 'abia', 'aus airport'],
    'San Antonio': ['san antonio', 'sa'],
    'College Station': ['cs', 'cstat', 'c station', 'college station'],
    'Bryan': ['bryan', 'bcs']
};

function normalizeLocation(location) {
    if (!location) return null;
    const s = location.toLowerCase().trim();
    if (!s) return null;

    let bestMatch = null;
    let bestLen = 0;

    for (const [standard, variants] of Object.entries(LOCATION_MAP)) {
        for (const v of variants) {
            if (s.includes(v) && v.length > bestLen) {
                bestMatch = standard;
                bestLen = v.length;
            }
        }
        if (s === standard.toLowerCase() && standard.length > bestLen) {
            bestMatch = standard;
            bestLen = standard.length;
        }
    }

    return bestMatch || location.trim();
}

const KNOWN_LOCATIONS = new Set(Object.keys(LOCATION_MAP));

// Pairs of locations close enough to still be a useful match (with a small penalty)
const NEARBY_PAIRS = [
    new Set(['College Station', 'Bryan']),
    new Set(['Houston IAH', 'Houston Hobby']),
    new Set(['Houston IAH', 'Houston']),
    new Set(['Houston Hobby', 'Houston']),
    new Set(['Dallas DFW', 'Dallas']),
    new Set(['Austin Airport', 'Austin']),
];

function areNearby(a, b) {
    return NEARBY_PAIRS.some(pair => pair.has(a) && pair.has(b));
}

function isKnownLocation(location) {
    return KNOWN_LOCATIONS.has(normalizeLocation(location));
}

module.exports = { normalizeLocation, LOCATION_MAP, isKnownLocation, areNearby };
