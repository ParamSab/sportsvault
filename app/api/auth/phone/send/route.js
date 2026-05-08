import { normalizePhone } from '@/lib/auth';

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

        if (!accountSid || !authToken || !serviceSid) {
            if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_OTP_BYPASS === 'true' && process.env.DEV_OTP_BYPASS_CODE) {
                console.log(`[AUTH DEV] Twilio not configured. Use configured dev OTP for ${normalized}`);
                return Response.json({ success: true, devMode: true });
            }
            return Response.json({ error: 'SMS service not configured.' }, { status: 503 });
        }

        const twilio = (await import('twilio')).default;
        const client = twilio(accountSid, authToken);
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
