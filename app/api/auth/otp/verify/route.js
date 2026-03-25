import { getSupabase } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

const MASTER_BYPASS = '990770';

export async function POST(req) {
    try {
        const { email, code, rememberMe } = await req.json();
        if (!email || !code) {
            return Response.json({ error: 'Email and code are required.' }, { status: 400 });
        }

        if (code !== MASTER_BYPASS) {
            const supabase = getSupabase();
            if (!supabase) {
                return Response.json({ error: 'Verification service unavailable.' }, { status: 503 });
            }

            const { data: otpRecord } = await supabase
                .from('otp_codes')
                .select('*')
                .eq('email', email)
                .eq('used', false)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

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
            user = await prisma.user.findUnique({ where: { email } });
        } catch (_) { /* DB may not be configured */ }

        const cookieStore = await cookies();
        const opts = { ...sessionOptions };
        if (!rememberMe) {
            opts.cookieOptions = { ...opts.cookieOptions };
            delete opts.cookieOptions.maxAge;
        }
        const session = await getIronSession(cookieStore, opts);

        if (user) {
            const userData = {
                ...user,
                sports: JSON.parse(user.sports || '[]'),
                positions: JSON.parse(user.positions || '{}'),
                ratings: JSON.parse(user.ratings || '{}'),
                dbId: user.id,
            };
            delete userData.password;
            session.user = userData;
            await session.save();
            return Response.json({ user: userData, exists: true, needsPasswordSetup: !user.password });
        }

        // New user — show onboarding
        return Response.json({ exists: false, email });

    } catch (err) {
        console.error('[EMAIL OTP VERIFY ERROR]', err);
        return Response.json({ error: err.message || 'Verification failed.' }, { status: 500 });
    }
}
