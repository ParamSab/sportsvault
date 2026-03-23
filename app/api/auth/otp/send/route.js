import twilio from 'twilio';

export async function POST(req) {
    try {
        const { phone } = await req.json();

        if (!phone) {
            return Response.json({ error: 'Phone number is required.' }, { status: 400 });
        }

        // Normalize: ensure E.164 format
        const normalized = phone.startsWith('+') ? phone : `+${phone.replace(/\D/g, '')}`;
        if (normalized.length < 10) {
            return Response.json({ error: 'Enter a valid phone number with country code.' }, { status: 400 });
        }

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

        if (!accountSid || !authToken || !serviceSid || serviceSid.startsWith('VAxx')) {
            return Response.json({ error: 'SMS service is not configured. Contact support.' }, { status: 500 });
        }

        const client = twilio(accountSid, authToken);

        const verification = await client.verify.v2
            .services(serviceSid)
            .verifications.create({ to: normalized, channel: 'sms' });

        console.log(`[AUTH] Twilio Verify sent to ${normalized}, status: ${verification.status}`);
        return Response.json({ success: true, status: verification.status });

    } catch (err) {
        console.error('[OTP SEND ERROR]', err);
        const msg = err?.message || 'Failed to send verification code';
        return Response.json({ error: msg }, { status: 500 });
    }
}
