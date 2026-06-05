/**
 * Resend (email OTP) diagnostic for SportsVault.
 * Run on your Mac:  node scripts/test-resend.mjs your@email.com
 * Pass the email you want to send a real test code to.
 *
 * Reads RESEND_API_KEY from .env.local — does NOT print the secret.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

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
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
            env[k] = v;
        }
    } catch (e) {
        console.error('❌ Could not read .env.local —', e.message);
        process.exit(1);
    }
    return env;
}

const mask = (s) => (s ? `${s.slice(0, 5)}…${s.slice(-3)} (len ${s.length})` : '(missing)');

const env = loadEnv();
const key = env.RESEND_API_KEY;
const fromAddr = env.RESEND_FROM || 'SportsVault <onboarding@resend.dev>';
const to = process.argv[2];

console.log('\n📧  Resend Email OTP Check\n' + '─'.repeat(46));
console.log(`RESEND_API_KEY : ${mask(key)}`);
console.log(`FROM           : ${fromAddr}`);

if (!key) {
    console.log('\n❌ RESEND_API_KEY is missing from .env.local.');
    console.log('   Get one at https://resend.com/api-keys and add:');
    console.log('   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx');
    process.exit(1);
}
if (key.includes('xxxx') || !key.startsWith('re_')) {
    console.log('\n❌ That looks like a placeholder, not a real key.');
    console.log('   Real Resend keys start with "re_". Get one at https://resend.com/api-keys');
    process.exit(1);
}
if (!to) {
    console.log('\nℹ️  Key format looks valid. To send a real test email, run:');
    console.log('   node scripts/test-resend.mjs your@email.com');
    console.log('\n   NOTE: with the default onboarding@resend.dev sender, Resend only');
    console.log('   delivers to the email that owns your Resend account until you verify');
    console.log('   a domain. Use that same email as the test recipient.');
    process.exit(0);
}

const { Resend } = require('resend');
const resend = new Resend(key);
const code = Math.floor(100000 + Math.random() * 900000).toString();

console.log(`\n→ Sending a test code (${code}) to ${to}…`);
const { data, error } = await resend.emails.send({
    from: fromAddr,
    to: [to],
    subject: 'SportsVault — Resend test code',
    html: `<div style="font-family:sans-serif;padding:24px;text-align:center"><h2>Test Code</h2><div style="font-size:32px;font-weight:800;letter-spacing:8px;color:#6366f1">${code}</div></div>`,
});

if (error) {
    console.log(`   ❌ Send FAILED — ${error.message || JSON.stringify(error)}`);
    if (/domain/i.test(error.message || '')) {
        console.log('      → With onboarding@resend.dev you can only email your own account address.');
        console.log('      → To email anyone, verify a domain at https://resend.com/domains');
        console.log('        then set RESEND_FROM="SportsVault <noreply@yourdomain.com>" in .env.local');
    }
    if (/api key/i.test(error.message || '')) {
        console.log('      → The API key is invalid. Re-copy it from https://resend.com/api-keys');
    }
    process.exit(1);
}

console.log(`   ✅ Sent! id: ${data?.id}. Check ${to} (and spam).`);
console.log('\n✅ Email OTP is good to go. In the app, use the "Email Code" tab.\n');
