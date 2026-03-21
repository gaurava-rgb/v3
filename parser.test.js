const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

// We need to mock the OpenAI client before requiring parser.
// Strategy: mock the 'openai' module to return a fake client.

let parseMessage;
let mockCreate;

// Fresh mock for each test
beforeEach(() => {
    // Clear module cache so parser.js re-requires openai each time
    delete require.cache[require.resolve('./parser')];
    delete require.cache[require.resolve('openai')];

    // Create a mock create function
    mockCreate = mock.fn();

    // Replace the openai module with our mock
    require.cache[require.resolve('openai')] = {
        id: require.resolve('openai'),
        filename: require.resolve('openai'),
        loaded: true,
        exports: class MockOpenAI {
            constructor() {
                this.chat = { completions: { create: mockCreate } };
            }
        }
    };

    parseMessage = require('./parser').parseMessage;
});

afterEach(() => {
    delete require.cache[require.resolve('./parser')];
    delete require.cache[require.resolve('openai')];
});

// --- Skip patterns (no LLM call) ---

describe('parser skip patterns', () => {
    it('skips short messages (<5 chars)', async () => {
        const result = await parseMessage('hi');
        assert.equal(result.isRequest, false);
        assert.equal(mockCreate.mock.callCount(), 0);
    });

    it('skips empty/null message', async () => {
        const result = await parseMessage('');
        assert.equal(result.isRequest, false);
        assert.equal(mockCreate.mock.callCount(), 0);
    });

    it('skips null', async () => {
        const result = await parseMessage(null);
        assert.equal(result.isRequest, false);
    });

    it('skips greetings', async () => {
        const result = await parseMessage('hello!');
        assert.equal(result.isRequest, false);
        assert.equal(mockCreate.mock.callCount(), 0);
    });

    it('skips emoji-only messages', async () => {
        const result = await parseMessage('😂😂😂');
        assert.equal(result.isRequest, false);
        assert.equal(mockCreate.mock.callCount(), 0);
    });

    it('skips URLs', async () => {
        const result = await parseMessage('https://example.com/some-link');
        assert.equal(result.isRequest, false);
        assert.equal(mockCreate.mock.callCount(), 0);
    });
});

// --- Field extraction from mocked LLM response ---

describe('parser field extraction', () => {
    it('extracts all ride fields from valid LLM response', async () => {
        mockCreate.mock.mockImplementation(async () => ({
            choices: [{ message: { content: JSON.stringify({
                isRequest: true,
                type: 'need',
                category: 'ride',
                date: '2026-03-25',
                date_fuzzy: false,
                possible_dates: [],
                ride_plan_time: '15:00',
                time_fuzzy: false,
                origin: 'College Station',
                destination: 'Houston',
                details: { seats: 1, gasContribution: '$20', description: 'Need ride to Houston' }
            })}}]
        }));

        const result = await parseMessage('Need a ride to Houston on March 25 at 3pm');

        assert.equal(result.isRequest, true);
        assert.equal(result.type, 'need');
        assert.equal(result.category, 'ride');
        assert.equal(result.date, '2026-03-25');
        assert.equal(result.date_fuzzy, false);
        assert.deepEqual(result.possible_dates, []);
        assert.equal(result.ride_plan_time, '15:00');
        assert.equal(result.time_fuzzy, false);
        assert.equal(result.origin, 'College Station');
        assert.equal(result.destination, 'Houston');
        assert.equal(result.details.seats, 1);
        assert.equal(result.details.gasContribution, '$20');
    });

    it('extracts offer with fuzzy dates', async () => {
        mockCreate.mock.mockImplementation(async () => ({
            choices: [{ message: { content: JSON.stringify({
                isRequest: true,
                type: 'offer',
                category: 'ride',
                date: '2026-03-28',
                date_fuzzy: true,
                possible_dates: ['2026-03-28', '2026-03-29'],
                ride_plan_time: null,
                time_fuzzy: true,
                origin: 'College Station',
                destination: 'Dallas DFW',
                details: { seats: 3, description: 'Driving to DFW this weekend' }
            })}}]
        }));

        const result = await parseMessage('Driving to DFW this weekend, 3 spots open');

        assert.equal(result.type, 'offer');
        assert.equal(result.date_fuzzy, true);
        assert.deepEqual(result.possible_dates, ['2026-03-28', '2026-03-29']);
        assert.equal(result.ride_plan_time, null);
        assert.equal(result.time_fuzzy, true);
    });

    it('defaults origin to College Station for rides', async () => {
        mockCreate.mock.mockImplementation(async () => ({
            choices: [{ message: { content: JSON.stringify({
                isRequest: true,
                type: 'need',
                category: 'ride',
                date: '2026-03-25',
                destination: 'Houston'
                // no origin field
            })}}]
        }));

        const result = await parseMessage('Need ride to Houston on March 25');
        assert.equal(result.origin, 'College Station');
    });

    it('ensures fuzzy field defaults when LLM omits them', async () => {
        mockCreate.mock.mockImplementation(async () => ({
            choices: [{ message: { content: JSON.stringify({
                isRequest: true,
                type: 'need',
                category: 'ride',
                date: '2026-03-25',
                destination: 'Houston'
                // LLM omitted: date_fuzzy, possible_dates, ride_plan_time, time_fuzzy
            })}}]
        }));

        const result = await parseMessage('Need ride to Houston on March 25');
        assert.equal(result.date_fuzzy, false);
        assert.deepEqual(result.possible_dates, []);
        assert.equal(result.ride_plan_time, null);
        assert.equal(result.time_fuzzy, true);
    });

    it('returns isRequest false for casual messages', async () => {
        mockCreate.mock.mockImplementation(async () => ({
            choices: [{ message: { content: '{"isRequest": false}' } }]
        }));

        const result = await parseMessage('anyone know a good barber?');
        assert.equal(result.isRequest, false);
    });
});

// --- Error recovery ---

describe('parser error recovery', () => {
    it('handles empty LLM response content', async () => {
        mockCreate.mock.mockImplementation(async () => ({
            choices: [{ message: { content: '' } }]
        }));

        const result = await parseMessage('Need ride to Houston');
        assert.equal(result.isRequest, false);
    });

    it('handles null content in response', async () => {
        mockCreate.mock.mockImplementation(async () => ({
            choices: [{ message: { content: null } }]
        }));

        const result = await parseMessage('Need ride to Houston');
        assert.equal(result.isRequest, false);
    });

    it('handles malformed JSON from LLM', async () => {
        mockCreate.mock.mockImplementation(async () => ({
            choices: [{ message: { content: '{isRequest: true, broken json...' } }]
        }));

        const result = await parseMessage('Need ride to Houston');
        assert.equal(result.isRequest, false);
        assert.ok(result._error);
    });

    it('handles LLM returning markdown-wrapped JSON', async () => {
        mockCreate.mock.mockImplementation(async () => ({
            choices: [{ message: { content: '```json\n{"isRequest": true, "type": "need", "category": "ride", "destination": "Houston"}\n```' } }]
        }));

        const result = await parseMessage('Need ride to Houston');
        assert.equal(result.isRequest, true);
        assert.equal(result.type, 'need');
    });

    it('retries on first LLM failure then succeeds', async () => {
        let callCount = 0;
        mockCreate.mock.mockImplementation(async () => {
            callCount++;
            if (callCount === 1) throw new Error('rate limited');
            return { choices: [{ message: { content: '{"isRequest": false}' } }] };
        });

        const result = await parseMessage('Need ride to Houston');
        assert.equal(result.isRequest, false);
        assert.equal(callCount, 2);
    });

    it('returns error when both LLM attempts fail', async () => {
        mockCreate.mock.mockImplementation(async () => {
            throw new Error('service down');
        });

        const result = await parseMessage('Need ride to Houston');
        assert.equal(result.isRequest, false);
        assert.ok(result._error);
    });

    it('handles empty choices array', async () => {
        mockCreate.mock.mockImplementation(async () => ({
            choices: []
        }));

        const result = await parseMessage('Need ride to Houston');
        assert.equal(result.isRequest, false);
    });
});
