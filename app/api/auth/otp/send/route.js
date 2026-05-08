import { Resend } from 'resend';
import { getSupabase } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';
import { normalizeEmail } from '@/lib/auth';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

export async function POST(req) {
    try {
        const { email } = await req.json();
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return Response.json({ error: 'Valid email address is required.' }, { status: 400 });
        }
        const normalizedEmail = normalizeEmail(email);

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        let storedOtp = false;
        try {
            await prisma.otpCode.updateMany({
                where: { email: normalizedEmail, used: false },
                data: { used: true },
            });
            await prisma.otpCode.create({
                data: { email: normalizedEmail, code, expiresAt },
            });
            storedOtp = true;
        } catch (prismaErr) {
            console.error('[EMAIL OTP SEND] Prisma OTP store failed:', prismaErr.message);
        }

        if (!storedOtp) {
            const supabase = getSupabase();
            if (supabase) {
                await supabase.from('otp_codes').update({ used: true }).eq('email', normalizedEmail).eq('used', false);
                await supabase.from('otp_codes').insert({ email: normalizedEmail, code, expires_at: expiresAt.toISOString() });
                storedOtp = true;
            } else {
                const cookieStore = await cookies();
                const session = await getIronSession(cookieStore, sessionOptions);
                session.pendingEmailOtp = {
                    email: normalizedEmail,
                    code,
                    expiresAt: expiresAt.toISOString(),
                };
                await session.save();
                storedOtp = true;
            }
        }

        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_OTP_BYPASS === 'true' && process.env.DEV_OTP_BYPASS_CODE) {
                console.log(`[AUTH DEV] RESEND not configured. Use configured dev OTP for ${normalizedEmail}`);
                return Response.json({ success: true, devMode: true });
            }
            return Response.json({ error: 'Email service not configured.' }, { status: 503 });
        }

        const resend = new Resend(apiKey);
        await resend.emails.send({
            from: 'SportsVault <onboarding@resend.dev>',
            to: [normalizedEmail],
            subject: 'Your SportsVault Login Code',
            html: `
                <div style="font-family: sans-serif; text-align: center; padding: 40px; background: #f8fafc; border-radius: 12px; max-width: 480px; margin: 0 auto;">
                    <h2 style="color: #0f172a; margin-bottom: 8px;">SportsVault Login</h2>
                    <p style="color: #475569; margin-bottom: 24px;">Your verification code:</p>
                    <div style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #6366f1; background: #fff; padding: 20px 32px; border-radius: 10px; border: 1px solid #e2e8f0; display: inline-block;">
                        ${code}
                    </div>
                    <p style="color: #94a3b8; margin-top: 24px; font-size: 14px;">Expires in 10 minutes. Do not share this code.</p>
                </div>
            `,
        });

        console.log(`[AUTH] Email OTP sent to ${normalizedEmail}`);
        return Response.json({ success: true });
    } catch (err) {
        console.error('[EMAIL OTP SEND ERROR]', err);
        return Response.json({ error: err.message || 'Failed to send verification code' }, { status: 500 });
    }
}
