import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

export async function POST(req) {
    try {
        const { to } = await req.json();
        if (!to) return Response.json({ error: 'Phone number required' }, { status: 400 });

        // Phone number cleaning
        let formattedPhone = to.trim();
        // Remove any non-digit characters except the leading +
        formattedPhone = formattedPhone.replace(/(?!^\+)/g, '').replace(/[^-+0-9]/g, '');
        
        // If it's a 10 digit number without country code, assume India
        if (formattedPhone.length === 10) {
            formattedPhone = '+91' + formattedPhone;
        } else if (!formattedPhone.startsWith('+')) {
            formattedPhone = '+' + formattedPhone;
        }

        const client = twilio(accountSid, authToken);

        // Use Twilio Verify to send SMS
        const verification = await client.verify.v2.services(verifyServiceSid)
            .verifications
            .create({ to: formattedPhone, channel: 'sms' });

        console.log(`Twilio Verify SMS sent to ${formattedPhone}, Status: ${verification.status}`);
        return Response.json({ success: true, status: verification.status });
    } catch (error) {
        console.error("Twilio Verify Send Error:", error);
        return Response.json({ error: error.message || 'Failed to send verification code' }, { status: 500 });
    }
}
