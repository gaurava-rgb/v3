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
        'dfw', 'dfw airport', 'dallas airport', 'dallas/fort worth',
        'dallas fort worth', 'dallas-fort worth'
    ],
    'Dallas': ['dallas', 'plano', 'richardson', 'frisco', 'irving',
        'lewisville', 'mckinney', 'garland', 'arlington', 'fort worth'],
    'Austin': ['austin'],
    'Austin Airport': ['austin airport', 'austin-bergstrom', 'abia', 'aus airport'],
    'San Antonio': ['san antonio', 'sa'],
    'College Station': ['cs', 'cstat', 'c-stat', 'c station', 'college station'],
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

// Corridor grouping: nearby normalized locations → corridor label for clustering
var CORRIDOR_MAP = {
    'Dallas area': ['Dallas', 'Dallas DFW'],
    'Houston area': ['Houston', 'Houston IAH', 'Houston Hobby'],
    'Austin area': ['Austin', 'Austin Airport'],
    'College Station': ['College Station', 'Bryan'],
    'San Antonio': ['San Antonio']
};

// Build reverse lookup: normalized name → corridor
var _corridorLookup = {};
var _corridorKeys = Object.keys(CORRIDOR_MAP);
for (var _ci = 0; _ci < _corridorKeys.length; _ci++) {
    var _cName = _corridorKeys[_ci];
    var _cLocs = CORRIDOR_MAP[_cName];
    for (var _li = 0; _li < _cLocs.length; _li++) {
        _corridorLookup[_cLocs[_li]] = _cName;
    }
}

function getClusterCorridor(normalizedLocation) {
    if (!normalizedLocation) return 'Other';
    return _corridorLookup[normalizedLocation] || normalizedLocation;
}

module.exports = { normalizeLocation, LOCATION_MAP, isKnownLocation, areNearby, CORRIDOR_MAP, getClusterCorridor };
