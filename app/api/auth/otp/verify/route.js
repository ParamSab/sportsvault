import { getSupabase } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';
import { isDevOtpBypass, normalizeEmail, serializeUser, setPendingVerifiedAuth } from '@/lib/auth';
import { findLocalUserByEmail } from '@/lib/localUserStore';

export async function POST(req) {
    try {
        const { email, code, rememberMe } = await req.json();
        if (!email || typeof email !== 'string' || !code) {
            return Response.json({ error: 'Email and code are required.' }, { status: 400 });
        }
        const normalizedEmail = normalizeEmail(email);

        const cookieStore = await cookies();
        const opts = { ...sessionOptions };
        if (!rememberMe) {
            opts.cookieOptions = { ...opts.cookieOptions };
            delete opts.cookieOptions.maxAge;
        }
        const session = await getIronSession(cookieStore, opts);

        if (!isDevOtpBypass(code)) {
            const sessionOtp = session.pendingEmailOtp;
            if (sessionOtp?.email === normalizedEmail) {
                if (new Date() > new Date(sessionOtp.expiresAt)) {
                    delete session.pendingEmailOtp;
                    await session.save();
                    return Response.json({ error: 'Code expired. Request a new one.' }, { status: 401 });
                }
                if (sessionOtp.code !== code) {
                    return Response.json({ error: 'Incorrect code. Please try again.' }, { status: 401 });
                }
                delete session.pendingEmailOtp;
            } else {
                let otpRecord = null;
                let otpSource = null;

                try {
                    otpRecord = await prisma.otpCode.findFirst({
                        where: { email: normalizedEmail, used: false },
                        orderBy: { createdAt: 'desc' },
                    });
                    if (otpRecord) otpSource = 'prisma';
                } catch (prismaErr) {
                    console.error('[EMAIL OTP VERIFY] Prisma OTP lookup failed:', prismaErr.message);
                }

                if (!otpRecord) {
                    const supabase = getSupabase();
                    if (!supabase) {
                        return Response.json({ error: 'Verification service unavailable.' }, { status: 503 });
                    }

                    const { data } = await supabase
                        .from('otp_codes')
                        .select('*')
                        .eq('email', normalizedEmail)
                        .eq('used', false)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    otpRecord = data;
                    if (otpRecord) otpSource = 'supabase';
                }

                if (!otpRecord) {
                    return Response.json({ error: 'Code not found. Request a new one.' }, { status: 401 });
                }
                const expiresAt = otpRecord.expiresAt || otpRecord.expires_at;
                if (new Date() > new Date(expiresAt)) {
                    return Response.json({ error: 'Code expired. Request a new one.' }, { status: 401 });
                }
                if (otpRecord.code !== code) {
                    return Response.json({ error: 'Incorrect code. Please try again.' }, { status: 401 });
                }

                if (otpSource === 'prisma') {
                    await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { used: true } });
                } else {
                    const supabase = getSupabase();
                    await supabase.from('otp_codes').update({ used: true }).eq('id', otpRecord.id);
                }
            }
        }

        let user = null;
        try {
            user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        } catch (_) {
            user = await findLocalUserByEmail(normalizedEmail);
        }

        setPendingVerifiedAuth(session, { email: normalizedEmail, rememberMe });

        if (user) {
            const userData = serializeUser(user);
            if (!user.password) {
                await session.save();
                return Response.json({
                    exists: false,
                    email: normalizedEmail,
                    existingProfile: userData,
                    needsPasswordSetup: true,
                });
            }

            session.user = userData;
            delete session.pendingVerifiedAuth;
            await session.save();
            return Response.json({ user: userData, exists: true });
        }

        await session.save();
        return Response.json({ exists: false, email: normalizedEmail });
    } catch (err) {
        console.error('[EMAIL OTP VERIFY ERROR]', err);
        return Response.json({ error: err.message || 'Verification failed.' }, { status: 500 });
    }
}
