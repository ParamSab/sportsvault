import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';

export async function POST(req) {
    try {
        const { email } = await req.json();
        if (!email || !email.includes('@')) {
            return Response.json({ error: 'Valid email required' }, { status: 400 });
        }

        if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_...') {
            return Response.json({ error: 'Email service not configured. Please contact support.' }, { status: 500 });
        }

        const resend = new Resend(process.env.RESEND_API_KEY);

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        // Delete any existing OTPs for this email first
        await prisma.otpCode.deleteMany({ where: { email } });

        // Store OTP in database
        await prisma.otpCode.create({
            data: { email, code: otp, expiresAt },
        });

        // Send Email via Resend
        const { data, error } = await resend.emails.send({
            from: 'SportsVault <onboarding@resend.dev>',
            to: [email],
            subject: 'Your SportsVault Verification Code',
            html: `
                <div style="font-family: sans-serif; padding: 40px; max-width: 480px; margin: 0 auto; background: #0a0e1a; color: #e2e8f0; border-radius: 16px;">
                    <h2 style="color: #6366f1; margin-bottom: 8px;">SportsVault ⚡</h2>
                    <p style="color: #94a3b8; margin-bottom: 24px;">Your verification code is:</p>
                    <div style="font-size: 42px; font-weight: 900; letter-spacing: 12px; color: #a855f7; background: rgba(99,102,241,0.1); padding: 24px; border-radius: 12px; text-align: center; margin: 24px 0; border: 1px solid rgba(99,102,241,0.3);">
                        ${otp}
                    </div>
                    <p style="font-size: 13px; color: #64748b;">This code expires in 10 minutes. Do not share it with anyone.</p>
                </div>
            `
        });

        if (error) {
            console.error('[RESEND ERROR]', error);
            // Clean up DB entry on failure
            await prisma.otpCode.deleteMany({ where: { email } });
            return Response.json({ error: `Email sending failed: ${error.message}` }, { status: 500 });
        }

        console.log(`[AUTH] OTP sent to ${email}, expires at ${expiresAt.toISOString()}`);
        return Response.json({ success: true });

    } catch (err) {
        console.error('[OTP SEND ERROR]', err);
        return Response.json({ error: err.message || 'Failed to send verification code' }, { status: 500 });
    }
}
