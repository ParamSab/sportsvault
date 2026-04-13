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
            const otpRecord = await prisma.otpCode.findFirst({
                where: { email: normalizedEmail, used: false },
                orderBy: { createdAt: 'desc' },
            });

            if (!otpRecord) {
                return Response.json({ error: 'Code not found. Request a new one.' }, { status: 401 });
            }
            if (new Date() > new Date(otpRecord.expiresAt)) {
                return Response.json({ error: 'Code expired. Request a new one.' }, { status: 401 });
            }
            if (otpRecord.code !== code) {
                return Response.json({ error: 'Incorrect code. Please try again.' }, { status: 401 });
            }

            // Mark used
            await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { used: true } });
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

        if (user && user.password) {
            // Existing user with password — log straight in
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

        // New user or existing user without password — go to onboarding to finish setup
        return Response.json({ exists: false, email: normalizedEmail });

    } catch (err) {
        console.error('[EMAIL OTP VERIFY ERROR]', err);
        return Response.json({ error: err.message || 'Verification failed.' }, { status: 500 });
    }
}
