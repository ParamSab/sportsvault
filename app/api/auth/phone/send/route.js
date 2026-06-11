// MSG91 Auth Route
import { checkRateLimit } from '@/lib/rateLimit';

function normalizePhone(phone) {
    const cleaned = phone.trim();
    if (cleaned.startsWith('+')) {
        return cleaned.replace(/\s/g, '');
    }
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    return null;
}

export async function POST(req) {
    try {
        const { phone } = await req.json();
        if (!phone) {
            return Response.json({ error: 'Phone number required' }, { status: 400 });
        }

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

        const normalized = normalizePhone(phone);
        if (!normalized) {
            return Response.json({ error: 'Invalid phone number. Please enter a valid 10-digit number.' }, { status: 400 });
        }

        const rl = checkRateLimit(`phone:${normalized}`, 3, 10 * 60 * 1000);
        if (!rl.allowed) {
            return Response.json(
                { error: `Too many requests. Try again in ${Math.ceil(rl.retryAfterSeconds / 60)} minute(s).` },
                { status: 429 }
            );
        }

        // Twilio implementation
        if (!accountSid || !authToken || !serviceSid) {
            // Dev-only fallback. In production a missing Twilio config is a hard error —
            // never expose a bypass code.
            if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_OTP_BYPASS === 'true') {
                const devCode = process.env.DEV_OTP_BYPASS_CODE;
                console.log(`[AUTH DEV] Twilio not configured — use bypass code ${devCode} for ${normalized}`);
                return Response.json({ success: true, devMode: true, devCode });
            }
            return Response.json({ error: 'SMS service not configured' }, { status: 500 });
        }

        const client = require('twilio')(accountSid, authToken);
        const verification = await client.verify.v2.services(serviceSid)
            .verifications
            .create({ to: normalized, channel: 'sms' });

        console.log(`[AUTH] Twilio Verify sent to ${normalized}, sid: ${verification.sid}`);
        return Response.json({ success: true });

    } catch (err) {
        console.error('[PHONE SEND ERROR]', err);
        let message = err.message || 'Failed to send verification code';
        if (err.code === 20003) message = 'SMS service auth failed — Twilio Account SID or Auth Token is invalid. Check .env.local.';
        else if (err.code === 21608) message = 'This number is not verified on your Twilio trial account. Verify it in the Twilio console.';
        else if (err.code === 60200) message = 'Invalid phone number format. Include country code, e.g. +91...';
        return Response.json({ error: message, code: err.code }, { status: 500 });
    }
}
