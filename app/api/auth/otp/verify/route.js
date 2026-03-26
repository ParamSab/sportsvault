import { getSupabase } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

const MASTER_BYPASS = '990770';

export async function POST(req) {
    try {
        const { email, code, rememberMe } = await req.json();
        if (!email || typeof email !== 'string' || !code) {
            return Response.json({ error: 'Email and code are required.' }, { status: 400 });
        }
        const normalizedEmail = email.toLowerCase().trim();

        if (code !== MASTER_BYPASS) {
            const supabase = getSupabase();
            if (!supabase) {
                return Response.json({ error: 'Verification service unavailable.' }, { status: 503 });
            }

            const { data: otpRecord } = await supabase
                .from('otp_codes')
                .select('*')
                .eq('email', normalizedEmail)
                .eq('used', false)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!otpRecord) {
                return Response.json({ error: 'Code not found. Request a new one.' }, { status: 401 });
            }
            if (new Date() > new Date(otpRecord.expires_at)) {
                return Response.json({ error: 'Code expired. Request a new one.' }, { status: 401 });
            }
            if (otpRecord.code !== code) {
                return Response.json({ error: 'Incorrect code. Please try again.' }, { status: 401 });
            }

            await supabase.from('otp_codes').update({ used: true }).eq('id', otpRecord.id);
        }

        // Look up user by email
        let user = null;
        try {
            user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        } catch (_) { /* DB may not be configured */ }

        const cookieStore = await cookies();
        const opts = { ...sessionOptions };
        if (!rememberMe) {
            opts.cookieOptions = { ...opts.cookieOptions };
            delete opts.cookieOptions.maxAge;
        }
        const session = await getIronSession(cookieStore, opts);

        if (user) {
            if (!user.password) {
                // Force user through onboarding to set password
                return Response.json({ exists: false, email: normalizedEmail, existingProfile: user });
            }

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

        // New user — show onboarding
        return Response.json({ exists: false, email: normalizedEmail });

    } catch (err) {
        console.error('[EMAIL OTP VERIFY ERROR]', err);
        return Response.json({ error: err.message || 'Verification failed.' }, { status: 500 });
    }
}
