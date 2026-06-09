/**
 * SportsVault API Flow Tester
 * Run: node scripts/test-flows.mjs [base_url]
 * Default base: http://localhost:3001
 */

const BASE = process.argv[2] || 'http://localhost:3001';
const TEST_EMAIL = `test+${Date.now()}@mailinator.com`;

let passed = 0;
let failed = 0;
const results = [];

function log(emoji, label, detail = '') {
    const line = `${emoji}  ${label}${detail ? '  ' + detail : ''}`;
    console.log(line);
    results.push(line);
}

async function req(method, path, body, cookieJar = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (cookieJar?.cookie) headers['Cookie'] = cookieJar.cookie;

    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (cookieJar !== null) {
        const setCookie = res.headers.get('set-cookie');
        if (setCookie) {
            const match = setCookie.match(/([^;]+)/);
            if (match) cookieJar.cookie = match[1];
        }
    }

    let json;
    try { json = await res.json(); } catch { json = null; }
    return { status: res.status, json };
}

function assert(label, cond, detail = '') {
    if (cond) {
        passed++;
        log('✅', label, detail);
    } else {
        failed++;
        log('❌', label, detail);
    }
}

// ── Main test suite ──────────────────────────────────────────────────────────

async function run() {
    console.log(`\n🧪  SportsVault API Tests  →  ${BASE}\n${'─'.repeat(50)}`);
    const jar = { cookie: '' };

    // 1. Health / session (unauthenticated)
    {
        const { status, json } = await req('GET', '/api/auth/session', null, jar);
        assert('GET /api/auth/session → 200', status === 200);
        assert('Session returns no user for guest', json?.user === null || json?.isAuthenticated === false);
    }

    // 2. OTP send (email)
    {
        const { status, json } = await req('POST', '/api/auth/otp/send', { email: TEST_EMAIL }, jar);
        assert('POST /api/auth/otp/send → 200', status === 200, `(${json?.message || json?.error || ''})`);
    }

    // 3. OTP verify with wrong code (should 400 or 401)
    {
        const { status } = await req('POST', '/api/auth/otp/verify', { email: TEST_EMAIL, code: '000000' }, jar);
        assert('POST /api/auth/otp/verify wrong code → 4xx', status >= 400 && status < 500, `(got ${status})`);
    }

    // 4. Rate limit on OTP send (send 3 more times — 4th should 429)
    {
        await req('POST', '/api/auth/otp/send', { email: TEST_EMAIL }, jar);
        await req('POST', '/api/auth/otp/send', { email: TEST_EMAIL }, jar);
        const { status: s3 } = await req('POST', '/api/auth/otp/send', { email: TEST_EMAIL }, jar);
        assert('OTP rate limit kicks in after 3 sends → 429', s3 === 429, `(got ${s3})`);
    }

    // 5. Games list (public endpoint — 200 or 503 if DB unavailable)
    {
        const { status, json } = await req('GET', '/api/games', null, null);
        assert('GET /api/games → 200 or 503', status === 200 || status === 503, `(got ${status})`);
        if (status === 200) {
            assert('Games response is array', Array.isArray(json));
            log('ℹ️', `  Found ${json?.length ?? 0} game(s)`);
        } else {
            log('⚠️', '  DB unavailable (expected in local dev without Supabase)');
        }
    }

    // 6. Init endpoint (200 or 503 if DB unavailable)
    {
        const { status, json } = await req('GET', '/api/init', null, null);
        assert('GET /api/init → 200 or 503', status === 200 || status === 503, `(got ${status})`);
        if (status === 200) assert('/api/init returns games array', Array.isArray(json?.games));
    }

    // 7. Create game (unauthenticated → should 401)
    {
        const { status } = await req('POST', '/api/games', {
            title: 'Test Game', sport: 'football', format: '5v5',
            date: '2026-06-01', time: '18:00', location: 'Test Ground',
            maxPlayers: 10, skillLevel: 'Intermediate',
        }, null);
        assert('POST /api/games unauthenticated → 401', status === 401, `(got ${status})`);
    }

    // 8. RSVP without auth → 401
    {
        const { status } = await req('POST', '/api/games/rsvp', { gameId: 'any', status: 'yes' }, null);
        assert('POST /api/games/rsvp unauthenticated → 401', status === 401, `(got ${status})`);
    }

    // 9. Notifications (guest gets 200 with empty list — soft auth)
    {
        const { status, json } = await req('GET', '/api/notifications', null, null);
        assert('GET /api/notifications → 200 (guest gets empty list)', status === 200, `(got ${status})`);
        assert('Notifications returns array', Array.isArray(json?.notifications), `(got ${JSON.stringify(json)})`);
    }

    // 10. Friends list (guest gets 200 with empty arrays — soft auth)
    {
        const { status, json } = await req('GET', '/api/friends', null, null);
        assert('GET /api/friends → 200 (guest gets empty list)', status === 200, `(got ${status})`);
        assert('Friends response has friends array', Array.isArray(json?.friends), `(got ${JSON.stringify(json)})`);
    }

    // 11. User search
    {
        const { status, json } = await req('GET', '/api/users/search?q=a', null, null);
        assert('GET /api/users/search → 200 or 401', status === 200 || status === 401, `(got ${status})`);
        if (status === 200) assert('User search returns array', Array.isArray(json));
    }

    // 12. Game score endpoint structure
    {
        const { status } = await req('POST', '/api/games/score', { gameId: 'nonexistent', teamAScore: 3, teamBScore: 2 }, null);
        assert('POST /api/games/score unauthenticated → 401', status === 401, `(got ${status})`);
    }

    // 13. Invite link
    {
        const { status } = await req('GET', '/invite', null, null);
        assert('GET /invite page → 200', status === 200, `(got ${status})`);
    }

    // 14. Cron endpoint (no secret → error response expected)
    {
        const { status } = await req('GET', '/api/cron/reminders', null, null);
        assert('GET /api/cron/reminders without secret → non-200', status !== 200, `(got ${status})`);
    }

    // 15. Phone OTP send (no Twilio creds in test env — expect 200/500/429)
    {
        const { status } = await req('POST', '/api/auth/phone/send', { phone: '+919999999999' }, jar);
        assert('POST /api/auth/phone/send → 200 or 500 or 429', status === 200 || status === 500 || status === 429, `(got ${status})`);
    }

    // Summary
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📊  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
    if (failed > 0) {
        console.log('\n❌ Failed tests:');
        results.filter(r => r.startsWith('❌')).forEach(r => console.log('  ' + r));
        process.exit(1);
    } else {
        console.log('\n🎉  All tests passed!');
    }
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
