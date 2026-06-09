import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';
import { isDevOtpBypass, normalizePhone, serializeUser, setPendingVerifiedAuth } from '@/lib/auth';
import { findLocalUserByPhone } from '@/lib/localUserStore';

async function findUserByPhone(normalized) {
    try {
        const user = await prisma.user.findUnique({ where: { phone: normalized } });
        if (user) return user;
    } catch (_) { /* fall through to Supabase */ }

    try {
        const supabase = getSupabase();
        if (supabase) {
            const { data } = await supabase.from('users').select('*').eq('phone', normalized).maybeSingle();
            if (data) return data;
        }
    } catch (_) { /* ignore */ }

    return findLocalUserByPhone(normalized);
}

export async function POST(req) {
    try {
        const { phone, code, rememberMe } = await req.json();
        if (!phone || !code) return Response.json({ error: 'Phone and code required' }, { status: 400 });

        const normalized = normalizePhone(phone);
        if (!normalized) return Response.json({ error: 'Invalid phone number' }, { status: 400 });

        if (!isDevOtpBypass(code)) {
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;
            const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

            if (!accountSid || !authToken || !serviceSid) {
                return Response.json({ error: 'SMS service not configured' }, { status: 500 });
            }

            const twilio = (await import('twilio')).default;
            const client = twilio(accountSid, authToken);
            const verificationCheck = await client.verify.v2.services(serviceSid)
                .verificationChecks
                .create({ to: normalized, code });

            if (verificationCheck.status !== 'approved') {
                return Response.json({ error: 'Incorrect verification code. Please try again.' }, { status: 401 });
            }
        }

        const user = await findUserByPhone(normalized);

        const cookieStore = await cookies();
        const opts = { ...sessionOptions };
        if (!rememberMe) {
            opts.cookieOptions = { ...opts.cookieOptions };
            delete opts.cookieOptions.maxAge;
        }
        const session = await getIronSession(cookieStore, opts);
        setPendingVerifiedAuth(session, { phone: normalized, rememberMe });

        if (user) {
            const userData = serializeUser(user);
            if (!user.password) {
                await session.save();
                return Response.json({
                    exists: false,
                    phone: normalized,
                    existingProfile: userData,
                    needsPasswordSetup: true,
                });
            }

            session.user = userData;
            delete session.pendingVerifiedAuth;
            await session.save();
            return Response.json({ user: userData, exists: true, needsPasswordSetup: false });
        }

        await session.save();
        return Response.json({ exists: false, phone: normalized });
    } catch (err) {
        console.error('[PHONE VERIFY ERROR]', err);
        return Response.json({ error: err.message || 'Verification failed' }, { status: 500 });
    }
}
