/**
 * Twilio credential diagnostic for SportsVault.
 * Run on your Mac:  node scripts/test-twilio.mjs [+91XXXXXXXXXX]
 * Optionally pass a phone number to send a real test SMS code.
 *
 * Reads TWILIO_* vars from .env.local — does NOT print secrets.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// ── Load .env.local manually (no next runtime) ──────────────────────────────
function loadEnv() {
    const env = {};
    try {
        const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
        for (const line of raw.split('\n')) {
            const t = line.trim();
            if (!t || t.startsWith('#')) continue;
            const eq = t.indexOf('=');
            if (eq === -1) continue;
            const k = t.slice(0, eq).trim();
            let v = t.slice(eq + 1).trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                v = v.slice(1, -1);
            }
            env[k] = v;
        }
    } catch (e) {
        console.error('❌ Could not read .env.local —', e.message);
        process.exit(1);
    }
    return env;
}

const mask = (s) => (s ? `${s.slice(0, 6)}…${s.slice(-4)} (len ${s.length})` : '(missing)');

const env = loadEnv();
const sid = env.TWILIO_ACCOUNT_SID;
const token = env.TWILIO_AUTH_TOKEN;
const service = env.TWILIO_VERIFY_SERVICE_SID;
const testTo = process.argv[2];

console.log('\n🔍  Twilio Credential Check\n' + '─'.repeat(46));

// 1. Format checks
let formatOk = true;
console.log(`ACCOUNT_SID         : ${mask(sid)}`);
if (!sid) { console.log('   ❌ missing'); formatOk = false; }
else if (!sid.startsWith('AC')) { console.log('   ❌ should start with "AC"'); formatOk = false; }
else if (sid.length !== 34) { console.log('   ⚠️  expected 34 chars'); }

console.log(`AUTH_TOKEN          : ${mask(token)}`);
if (!token) { console.log('   ❌ missing'); formatOk = false; }
else if (token.length !== 32) { console.log('   ⚠️  Twilio auth tokens are normally 32 chars — yours is ' + token.length); }

console.log(`VERIFY_SERVICE_SID  : ${mask(service)}`);
if (!service) { console.log('   ❌ missing'); formatOk = false; }
else if (!service.startsWith('VA')) { console.log('   ❌ should start with "VA" (this is the Verify Service SID, not the Account SID)'); formatOk = false; }
else if (service.length !== 34) { console.log('   ⚠️  expected 34 chars'); }

// Detect leftover placeholder values from .env.example
const looksLikePlaceholder =
    /^AC?x+$/i.test(sid) || sid.includes('xxxx') ||
    /here$/i.test(token) || token.includes('xxxx') ||
    service.includes('xxxx');
if (looksLikePlaceholder) {
    console.log('\n❌ These are PLACEHOLDER values from .env.example, not real credentials.');
    console.log('   Replace them in .env.local with your real Twilio values:');
    console.log('   • Account SID + Auth Token → https://console.twilio.com (Account Info panel)');
    console.log('   • Verify Service SID → https://console.twilio.com/us1/develop/verify/services');
    process.exit(1);
}

if (!formatOk) {
    console.log('\n❌ Fix the format issues above first. Get the correct values from:');
    console.log('   • Account SID + Auth Token → https://console.twilio.com (Account Info panel)');
    console.log('   • Verify Service SID → https://console.twilio.com/us1/develop/verify/services');
    process.exit(1);
}

const client = require('twilio')(sid, token);

// 2. Validate auth + Verify service in one call (fetching the service requires valid auth)
console.log('\n→ Authenticating with Twilio + checking Verify service…');
try {
    const svc = await client.verify.v2.services(service).fetch();
    console.log(`   ✅ Auth OK and Verify service found — "${svc.friendlyName}"`);
} catch (e) {
    console.log(`   ❌ FAILED — ${e.message} (Twilio code ${e.code || '?'})`);
    if (e.code === 20003) {
        console.log('      → Account SID or Auth Token is wrong. Re-copy both from the Twilio console.');
        console.log('      → Use the LIVE Auth Token, no stray spaces or newlines.');
    } else if (e.code === 20404) {
        console.log('      → Auth worked but the VERIFY_SERVICE_SID does not exist on this account.');
        console.log('      → Create one at https://console.twilio.com/us1/develop/verify/services');
    }
    process.exit(1);
}

// 4. Optionally send a real code
if (testTo) {
    console.log(`\n→ Sending a REAL verification SMS to ${testTo}…`);
    try {
        const v = await client.verify.v2.services(service).verifications.create({ to: testTo, channel: 'sms' });
        console.log(`   ✅ Sent! status: ${v.status}. Check that phone for the code.`);
        console.log('   If it never arrives on a trial account, verify the number first at:');
        console.log('   https://console.twilio.com/us1/develop/phone-numbers/manage/verified');
    } catch (e) {
        console.log(`   ❌ Send FAILED — ${e.message} (code ${e.code || '?'})`);
        if (e.code === 21608) console.log('      → Trial account: this number is not verified. Add it in the console.');
        if (e.code === 60200) console.log('      → Invalid phone format. Use E.164, e.g. +919867006108');
        process.exit(1);
    }
} else {
    console.log('\nℹ️  Credentials look valid. To send yourself a real test code, run:');
    console.log('   node scripts/test-twilio.mjs +919867006108');
}

console.log('\n✅ Done.\n');
