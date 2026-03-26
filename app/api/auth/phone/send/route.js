// MSG91 Auth Route

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

        // Twilio implementation
        if (!accountSid || !authToken || !serviceSid) {
            console.log(`[AUTH DEV] Twilio not configured — use bypass code 990770 for ${normalized}`);
            return Response.json({ success: true, devMode: true });
        }

        const client = require('twilio')(accountSid, authToken);
        const verification = await client.verify.v2.services(serviceSid)
            .verifications
            .create({ to: normalized, channel: 'sms' });

        console.log(`[AUTH] Twilio Verify sent to ${normalized}, sid: ${verification.sid}`);
        return Response.json({ success: true });

    } catch (err) {
        console.error('[PHONE SEND ERROR]', err);
        return Response.json({ error: err.message || 'Failed to send verification code' }, { status: 500 });
    }
}
