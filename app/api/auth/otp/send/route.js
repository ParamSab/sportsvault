import { prisma } from '@/lib/prisma';

export async function POST(req) {
    try {
        const { email } = await req.json();

        if (!email) {
            return Response.json({ error: 'Email is required.' }, { status: 400 });
        }

        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

        await prisma.otpCode.create({
            data: { email, code, expiresAt },
        });

        const resendKey = process.env.RESEND_API_KEY;
        if (!resendKey) {
            console.log(`[AUTH DEV] Resend key missing, code for ${email} is ${code}`);
            return Response.json({ success: true, devMode: true, message: 'Resend API key missing, use 990770' });
        }

        const resBody = {
            from: "SportsVault <noreply@resend.dev>",
            to: [email],
            subject: "Your SportsVault Login Code",
            html: `<p>Your login code is <strong>${code}</strong></p><p>It expires in 15 minutes.</p>`
        };

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendKey}`
            },
            body: JSON.stringify(resBody)
        });

        const resendData = await response.json();
        
        if (!response.ok) {
            throw new Error(resendData.message || 'Failed to send email via Resend');
        }

        console.log(`[AUTH] Resend email sent to ${email}`);
        return Response.json({ success: true, method: 'email' });

    } catch (err) {
        console.error('[OTP SEND ERROR]', err);
        return Response.json({ error: err.message || 'Failed to send verification code' }, { status: 500 });
    }
}
