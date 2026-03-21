const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { computeMatchQuality, calculateScore, getMatchThreshold } = require('./matcher');

// --- computeMatchQuality ---

describe('computeMatchQuality', () => {
    it('returns strong when dates exact, not fuzzy, times not fuzzy', () => {
        const need = { ride_plan_date: '2026-03-25', date_fuzzy: false, time_fuzzy: false };
        const offer = { ride_plan_date: '2026-03-25', date_fuzzy: false, time_fuzzy: false };
        assert.equal(computeMatchQuality(need, offer), 'strong');
    });

    it('returns medium when dates exact, not fuzzy, but time is fuzzy', () => {
        const need = { ride_plan_date: '2026-03-25', date_fuzzy: false, time_fuzzy: true };
        const offer = { ride_plan_date: '2026-03-25', date_fuzzy: false, time_fuzzy: false };
        assert.equal(computeMatchQuality(need, offer), 'medium');
    });

    it('returns medium when both times fuzzy but dates confirmed', () => {
        const need = { ride_plan_date: '2026-03-25', date_fuzzy: false, time_fuzzy: true };
        const offer = { ride_plan_date: '2026-03-25', date_fuzzy: false, time_fuzzy: true };
        assert.equal(computeMatchQuality(need, offer), 'medium');
    });

    it('returns low when dates are 1 day apart', () => {
        const need = { ride_plan_date: '2026-03-25', date_fuzzy: false, time_fuzzy: false };
        const offer = { ride_plan_date: '2026-03-26', date_fuzzy: false, time_fuzzy: false };
        assert.equal(computeMatchQuality(need, offer), 'low');
    });

    it('returns low when dates are far apart', () => {
        const need = { ride_plan_date: '2026-03-25', date_fuzzy: false, time_fuzzy: false };
        const offer = { ride_plan_date: '2026-03-30', date_fuzzy: false, time_fuzzy: false };
        assert.equal(computeMatchQuality(need, offer), 'low');
    });

    it('returns low when need date is fuzzy even if dates match', () => {
        const need = { ride_plan_date: '2026-03-25', date_fuzzy: true, possible_dates: ['2026-03-25'], time_fuzzy: false };
        const offer = { ride_plan_date: '2026-03-25', date_fuzzy: false, time_fuzzy: false };
        assert.equal(computeMatchQuality(need, offer), 'low');
    });

    it('handles fuzzy overlap via possible_dates', () => {
        const need = { ride_plan_date: '2026-03-25', date_fuzzy: true, possible_dates: ['2026-03-25', '2026-03-26'], time_fuzzy: false };
        const offer = { ride_plan_date: '2026-03-25', date_fuzzy: false, time_fuzzy: false };
        // dateClose is true (fuzzyOverlap), but dateConfirmed is false (need is fuzzy) → low
        assert.equal(computeMatchQuality(need, offer), 'low');
    });

    it('handles null/missing dates gracefully (null===null is dateExact)', () => {
        const need = { ride_plan_date: null };
        const offer = { ride_plan_date: null };
        // null===null → dateExact, date_fuzzy defaults false → dateConfirmed, times fuzzy → medium
        assert.equal(computeMatchQuality(need, offer), 'medium');
    });

    it('handles missing fields without crashing', () => {
        // undefined===undefined → dateExact, same logic → medium
        assert.equal(computeMatchQuality({}, {}), 'medium');
    });

    it('handles undefined possible_dates', () => {
        const need = { ride_plan_date: '2026-03-25', date_fuzzy: true };
        const offer = { ride_plan_date: '2026-03-25', date_fuzzy: false };
        // Should not throw — possible_dates defaults to []
        assert.equal(computeMatchQuality(need, offer), 'low');
    });
});

// --- calculateScore ---

describe('calculateScore', () => {
    it('returns 1.0 for same date, same known destination', () => {
        const req = { ride_plan_date: '2026-03-25', request_category: 'ride', request_destination: 'Houston', request_origin: 'College Station' };
        const match = { ride_plan_date: '2026-03-25', request_destination: 'Houston', request_origin: 'College Station' };
        assert.equal(calculateScore(req, match), 1.0);
    });

    it('penalizes 1-day date difference (0.8)', () => {
        const req = { ride_plan_date: '2026-03-25', request_category: 'ride', request_destination: 'Houston' };
        const match = { ride_plan_date: '2026-03-26', request_destination: 'Houston' };
        assert.equal(calculateScore(req, match), 0.8);
    });

    it('penalizes 2+ day date difference (0.5)', () => {
        const req = { ride_plan_date: '2026-03-25', request_category: 'ride', request_destination: 'Houston' };
        const match = { ride_plan_date: '2026-03-28', request_destination: 'Houston' };
        assert.equal(calculateScore(req, match), 0.5);
    });

    it('returns 0 when destination is unknown (local errand gate)', () => {
        const req = { ride_plan_date: '2026-03-25', request_category: 'ride', request_destination: 'Walmart on Texas Ave' };
        const match = { ride_plan_date: '2026-03-25', request_destination: 'Houston' };
        assert.equal(calculateScore(req, match), 0);
    });

    it('returns 0 when match destination is unknown', () => {
        const req = { ride_plan_date: '2026-03-25', request_category: 'ride', request_destination: 'Houston' };
        const match = { ride_plan_date: '2026-03-25', request_destination: 'my apartment' };
        assert.equal(calculateScore(req, match), 0);
    });

    it('applies nearby penalty (0.9) for Bryan ↔ College Station', () => {
        const req = { ride_plan_date: '2026-03-25', request_category: 'ride', request_destination: 'Bryan' };
        const match = { ride_plan_date: '2026-03-25', request_destination: 'College Station' };
        const score = calculateScore(req, match);
        assert.equal(score, 0.9);
    });

    it('applies nearby penalty for Houston IAH ↔ Houston', () => {
        const req = { ride_plan_date: '2026-03-25', request_category: 'ride', request_destination: 'IAH' };
        const match = { ride_plan_date: '2026-03-25', request_destination: 'Houston' };
        assert.equal(calculateScore(req, match), 0.9);
    });

    it('penalizes different known destinations (0.6)', () => {
        const req = { ride_plan_date: '2026-03-25', request_category: 'ride', request_destination: 'Houston' };
        const match = { ride_plan_date: '2026-03-25', request_destination: 'Dallas' };
        assert.equal(calculateScore(req, match), 0.6);
    });

    it('gives origin match bonus capped at 1.0', () => {
        const req = { ride_plan_date: '2026-03-25', request_category: 'ride', request_destination: 'Houston', request_origin: 'College Station' };
        const match = { ride_plan_date: '2026-03-25', request_destination: 'Houston', request_origin: 'CS' };
        // dest match = 1.0, origin match = min(1.0 * 1.1, 1.0) = 1.0
        assert.equal(calculateScore(req, match), 1.0);
    });

    it('handles no dates gracefully (score stays 1.0 from date portion)', () => {
        const req = { request_category: 'ride', request_destination: 'Houston' };
        const match = { request_destination: 'Houston' };
        assert.equal(calculateScore(req, match), 1.0);
    });

    it('handles non-ride category (skips destination logic)', () => {
        const req = { ride_plan_date: '2026-03-25', request_category: 'help', request_destination: 'somewhere' };
        const match = { ride_plan_date: '2026-03-25', request_destination: 'elsewhere' };
        assert.equal(calculateScore(req, match), 1.0);
    });

    it('handles null destinations without crashing', () => {
        const req = { ride_plan_date: '2026-03-25', request_category: 'ride', request_destination: null };
        const match = { ride_plan_date: '2026-03-25', request_destination: null };
        assert.equal(calculateScore(req, match), 1.0);
    });
});

// --- Time proximity scoring ---

describe('calculateScore time proximity', () => {
    const base = { ride_plan_date: '2026-03-25', request_category: 'ride', request_destination: 'Houston' };

    it('no penalty for same time (within 30 min)', () => {
        const req = { ...base, ride_plan_time: '10:00' };
        const match = { ...base, ride_plan_time: '10:30' };
        assert.equal(calculateScore(req, match), 1.0);
    });

    it('small penalty for times 1-2 hours apart (0.95)', () => {
        const req = { ...base, ride_plan_time: '10:00' };
        const match = { ...base, ride_plan_time: '11:30' };
        assert.equal(calculateScore(req, match), 0.95);
    });

    it('larger penalty for times >2 hours apart (0.8)', () => {
        const req = { ...base, ride_plan_time: '06:00' };
        const match = { ...base, ride_plan_time: '23:00' };
        assert.equal(calculateScore(req, match), 0.8);
    });

    it('no time penalty when only one side has time', () => {
        const req = { ...base, ride_plan_time: '10:00' };
        const match = { ...base };
        assert.equal(calculateScore(req, match), 1.0);
    });

    it('no time penalty when neither side has time', () => {
        const req = { ...base };
        const match = { ...base };
        assert.equal(calculateScore(req, match), 1.0);
    });

    it('time penalty stacks with date penalty', () => {
        const req = { ...base, ride_plan_date: '2026-03-25', ride_plan_time: '06:00' };
        const match = { ...base, ride_plan_date: '2026-03-26', ride_plan_time: '18:00' };
        // date 1 day off = 0.8, time >2h = 0.8 → 0.8 * 0.8 = 0.64
        const score = calculateScore(req, match);
        assert.ok(Math.abs(score - 0.64) < 0.001, `expected ~0.64, got ${score}`);
    });

    it('10:00 vs 18:00 scores lower than 10:00 vs 10:30 (sprint requirement)', () => {
        const req = { ...base, ride_plan_time: '10:00' };
        const closeMatch = { ...base, ride_plan_time: '10:30' };
        const farMatch = { ...base, ride_plan_time: '18:00' };
        assert.ok(calculateScore(req, closeMatch) > calculateScore(req, farMatch));
    });
});

// --- Configurable score threshold ---

describe('getMatchThreshold', () => {
    const originalEnv = process.env.MATCH_THRESHOLD;

    afterEach(() => {
        if (originalEnv === undefined) delete process.env.MATCH_THRESHOLD;
        else process.env.MATCH_THRESHOLD = originalEnv;
    });

    it('defaults to 0.5 when env var is not set', () => {
        delete process.env.MATCH_THRESHOLD;
        assert.equal(getMatchThreshold(), 0.5);
    });

    it('reads MATCH_THRESHOLD from env var', () => {
        process.env.MATCH_THRESHOLD = '0.3';
        assert.equal(getMatchThreshold(), 0.3);
    });

    it('falls back to 0.5 for invalid env var', () => {
        process.env.MATCH_THRESHOLD = 'not-a-number';
        assert.equal(getMatchThreshold(), 0.5);
    });

    it('reads higher threshold', () => {
        process.env.MATCH_THRESHOLD = '0.8';
        assert.equal(getMatchThreshold(), 0.8);
    });
});
