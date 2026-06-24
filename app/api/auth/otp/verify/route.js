import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { isDevOtpBypass } from '@/lib/auth';

export async function POST(req) {
    try {
        let email, code, rememberMe;
        try {
            ({ email, code, rememberMe } = await req.json());
        } catch {
            return Response.json({ error: 'Invalid request body' }, { status: 400 });
        }
        if (!email || typeof email !== 'string' || !code) {
            return Response.json({ error: 'Email and code are required.' }, { status: 400 });
        }
        const normalizedEmail = email.toLowerCase().trim();

        const cookieStore = await cookies();
        const opts = { ...sessionOptions };
        if (!rememberMe) {
            opts.cookieOptions = { ...opts.cookieOptions };
            delete opts.cookieOptions.maxAge;
        }
        const session = await getIronSession(cookieStore, opts);

        if (!isDevOtpBypass(code)) {
            // 1. Check session-stored OTP (works without DB)
            const pending = session.pendingOtp;
            let verified = false;

            if (pending && pending.email === normalizedEmail) {
                if (new Date() > new Date(pending.expiresAt)) {
                    return Response.json({ error: 'Code expired. Request a new one.' }, { status: 401 });
                }
                if (pending.code !== code) {
                    return Response.json({ error: 'Incorrect code. Please try again.' }, { status: 401 });
                }
                verified = true;
                delete session.pendingOtp;
            }

            // 2. Fall back to DB if session OTP not found (e.g. different browser tab)
            if (!verified) {
                try {
                    const otpRecord = await prisma.otpCode.findFirst({
                        where: { email: normalizedEmail, used: false },
                        orderBy: { createdAt: 'desc' },
                    });
                    if (!otpRecord) return Response.json({ error: 'Code not found. Request a new one.' }, { status: 401 });
                    if (new Date() > new Date(otpRecord.expiresAt)) return Response.json({ error: 'Code expired. Request a new one.' }, { status: 401 });
                    if (otpRecord.code !== code) return Response.json({ error: 'Incorrect code. Please try again.' }, { status: 401 });
                    await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { used: true } });
                    verified = true;
                } catch (_) { /* DB unavailable */ }
            }

            if (!verified) {
                return Response.json({ error: 'Code not found. Request a new one.' }, { status: 401 });
            }
        }

        // Look up user — Prisma first, Supabase fallback
        let user = null;
        try {
            user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        } catch (_) { /* fall through */ }

        if (!user) {
            try {
                const supabase = getSupabase();
                if (supabase) {
                    const { data } = await supabase.from('users').select('*').eq('email', normalizedEmail).maybeSingle();
                    if (data) user = data;
                }
            } catch (_) { /* ignore */ }
        }

        if (user && user.password) {
            const userData = {
                ...user,
                sports: Array.isArray(user.sports) ? user.sports : (typeof user.sports === 'string' ? JSON.parse(user.sports || '[]') : []),
                positions: typeof user.positions === 'object' ? user.positions : (typeof user.positions === 'string' ? JSON.parse(user.positions || '{}') : {}),
                ratings: typeof user.ratings === 'object' ? user.ratings : (typeof user.ratings === 'string' ? JSON.parse(user.ratings || '{}') : {}),
                dbId: user.id,
            };
            delete userData.password;
            session.user = userData;
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
