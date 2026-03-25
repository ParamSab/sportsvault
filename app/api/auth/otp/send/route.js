import { Resend } from 'resend';
import { getSupabase } from '@/lib/supabase';

export async function POST(req) {
    try {
        const { email } = await req.json();
        if (!email || !email.includes('@')) {
            return Response.json({ error: 'Valid email address is required.' }, { status: 400 });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Store OTP in Supabase (invalidate old codes first)
        const supabase = getSupabase();
        if (supabase) {
            await supabase.from('otp_codes').update({ used: true }).eq('email', email).eq('used', false);
            await supabase.from('otp_codes').insert({ email, code, expires_at: expiresAt.toISOString() });
        }

        // Send via Resend
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.log(`[AUTH DEV] RESEND not configured — use bypass code 990770 for ${email}`);
            return Response.json({ success: true, devMode: true });
        }

        const resend = new Resend(apiKey);
        await resend.emails.send({
            from: 'SportsVault <onboarding@resend.dev>',
            to: [email],
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

        console.log(`[AUTH] Email OTP sent to ${email}`);
        return Response.json({ success: true });

    } catch (err) {
        console.error('[EMAIL OTP SEND ERROR]', err);
        return Response.json({ error: err.message || 'Failed to send verification code' }, { status: 500 });
    }
}
