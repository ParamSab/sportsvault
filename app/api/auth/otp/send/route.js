import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(req) {
    try {
        const { email } = await req.json();
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return Response.json({ error: 'Valid email address is required.' }, { status: 400 });
        }
        const normalizedEmail = email.toLowerCase().trim();

        const rl = checkRateLimit(`email:${normalizedEmail}`, 3, 10 * 60 * 1000);
        if (!rl.allowed) {
            return Response.json(
                { error: `Too many requests. Try again in ${Math.ceil(rl.retryAfterSeconds / 60)} minute(s).` },
                { status: 429 }
            );
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Store in session (works without any DB table)
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        session.pendingOtp = { email: normalizedEmail, code, expiresAt: expiresAt.toISOString() };
        await session.save();

        // Best-effort DB persist (ignored if table doesn't exist)
        try {
            await prisma.otpCode.updateMany({ where: { email: normalizedEmail, used: false }, data: { used: true } });
            await prisma.otpCode.create({ data: { email: normalizedEmail, code, expiresAt } });
        } catch (_) { /* table may not exist — session is the source of truth */ }

        // Send via Resend
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            // SECURITY: never return the code in production — that would let anyone
            // log into any email. Only surface it for local dev with the explicit
            // bypass flag (mirrors the phone/send route).
            if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_OTP_BYPASS === 'true') {
                console.log(`[AUTH DEV] RESEND not configured — OTP for ${normalizedEmail}: ${code}`);
                return Response.json({ success: true, devMode: true, devCode: code });
            }
            console.error('[AUTH] RESEND_API_KEY not configured — cannot send email OTP');
            return Response.json({ error: 'Email login is temporarily unavailable. Please use SMS instead.' }, { status: 503 });
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
                    <div style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #c6f432; background: #fff; padding: 20px 32px; border-radius: 10px; border: 1px solid #e2e8f0; display: inline-block;">
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
