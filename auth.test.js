const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');

function load(file, mocks) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(require.resolve(file), 'utf8'), {
        module, exports: module.exports, process: { env: {} }, console,
        require(name) {
            assert.ok(Object.hasOwn(mocks, name), 'Unexpected dependency: ' + name);
            return mocks[name];
        }
    }, { filename: file });
    return module.exports;
}
function response() {
    return {
        cleared: [], cookies: [],
        clearCookie(name) { this.cleared.push(name); },
        cookie(name, value) { this.cookies.push([name, value]); },
        redirect(url) { this.redirected = url; },
        send(body) { this.sent = body; }
    };
}
function harness({ verified = false, refresh = false } = {}) {
    const calls = [];
    const user = () => ({ id: 'synthetic-user', email: 'fictional@tamu.edu' });
    const authClient = { auth: {
        async getUser(token) { calls.push(['getUser', token]); return { data: { user: refresh ? null : user() } }; },
        async refreshSession() { calls.push(['refresh']); return { data: { user: user(), session: { access_token: 'new-access', refresh_token: 'new-refresh' } } }; },
        async verifyOtp(args) { calls.push(['verifyOtp', args]); return { data: { user: user(), session: { access_token: 'email-access', refresh_token: 'email-refresh' } } }; }
    } };
    const auth = load('./middleware/auth.js', {
        '../lib/supabase': { authClient },
        '../lib/profiles': {
            async isEmailWaVerified() { return verified; },
            async getPhoneForEmail() { return '15555550100'; }
        }
    });
    return { auth, authClient, calls };
}
const payload = Buffer.from(JSON.stringify({ phone: '15555550199', exp: Date.now() + 86400000 })).toString('base64url');
const forged = payload + '.' + crypto.createHmac('sha256', 'change-me-in-production').update(payload).digest('base64url');

for (const token of [forged, 'abc.x', '', 'invalid', 'abc.']) {
    test('legacy cookie never authenticates: ' + (token === forged ? 'fallback-signed' : JSON.stringify(token)), async () => {
        const { auth, calls } = harness();
        const req = { cookies: { wa_phone: token } }, res = response();
        let next = 0;
        await auth.optionalAuth(req, res, () => next++);
        assert.equal(req.user, null);
        assert.equal(next, 1);
        assert.deepEqual(res.cleared, ['wa_phone']);
        assert.deepEqual(calls, []);
    });
}
for (const verified of [false, true]) {
    for (const refresh of [false, true]) {
        test(`email authentication survives legacy cookie (verified=${verified}, refresh=${refresh})`, async () => {
            const { auth, calls } = harness({ verified, refresh });
            const req = { cookies: { wa_phone: forged, access_token: 'email-access', refresh_token: 'email-refresh' } }, res = response();
            let next = 0;
            await auth.optionalAuth(req, res, () => next++);
            assert.equal(next, 1);
            assert.equal(req.user.email, 'fictional@tamu.edu');
            assert.equal(req.user.tier, verified ? 2 : 1);
            assert.equal(req.user.phone, verified ? '15555550100' : undefined);
            assert.ok(res.cleared.includes('wa_phone'));
            assert.equal(calls.some(call => call[0] === 'refresh'), refresh);
            if (refresh) assert.deepEqual(res.cookies, [['access_token', 'new-access'], ['refresh_token', 'new-refresh']]);
        });
    }
}
function routes() {
    const { auth, authClient } = harness();
    const handlers = {};
    const router = {};
    for (const method of ['get', 'post']) router[method] = (path, ...functions) => { handlers[method + ' ' + path] = functions; };
    load('./routes/auth.js', {
        express: { Router: () => router },
        '../middleware/auth': auth,
        '../lib/supabase': { writeClient: {} },
        '../lib/views': { renderLoginPage() {}, renderVerifyPage() {}, renderCheckEmailPage() {} }
    });
    return handlers;
}
for (const token of [forged, 'abc.x']) {
    for (const path of ['get /auth/callback', 'post /verify']) {
        test(`${path} ignores ${token === forged ? 'forged' : 'malformed'} phone identity`, async () => {
            const handlers = routes(), res = response();
            await handlers[path][0]({ cookies: { wa_phone: token }, query: { token_hash: 'synthetic-token' }, body: { email: 'fictional@tamu.edu', token: '123456' } }, res);
            assert.equal(res.redirected, '/');
            assert.deepEqual(res.cookies, [['access_token', 'email-access'], ['refresh_token', 'email-refresh']]);
            assert.deepEqual(res.cleared, ['wa_phone']);
            // The route loader rejects any profile dependency: cookie-based linking cannot run.
        });
    }
}
test('logout clears email and retired phone cookies', () => {
    const res = response();
    routes()['get /logout'][0]({}, res);
    assert.deepEqual(res.cleared, ['access_token', 'refresh_token', 'wa_phone']);
    assert.equal(res.redirected, '/');
});
