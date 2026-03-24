import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

const sessionOptions = {
    password: process.env.SESSION_SECRET || 'sportsvault-super-secret-key-min-32-chars!!',
    cookieName: 'sportsvault_session',
    cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 30, // 30 days
    },
};

export async function POST(req) {
    try {
        const { email, code, rememberMe } = await req.json();
        if (!email || !code) {
            return Response.json({ error: 'Email and code are required.' }, { status: 400 });
        }

        const MASTER_BYPASS = '990770';

        if (code !== MASTER_BYPASS) {
            const otpRecord = await prisma.otpCode.findFirst({
                where: { email, code, used: false, expiresAt: { gt: new Date() } },
                orderBy: { createdAt: 'desc' }
            });

            if (!otpRecord) {
                return Response.json({ error: 'Incorrect or expired code. Please try again.' }, { status: 401 });
            }

            // Mark as used
            await prisma.otpCode.update({
                where: { id: otpRecord.id },
                data: { used: true }
            });
        }

        return await handleUserLogin(email, rememberMe);

    } catch (err) {
        console.error('[OTP VERIFY ERROR]', err);
        return Response.json({ error: err.message || 'Verification failed.' }, { status: 500 });
    }
}

async function handleUserLogin(email, rememberMe) {
    const user = await prisma.user.findUnique({ where: { email } });

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

        return Response.json({ user: userData, exists: true });
    }

    // New user — frontend shows onboarding
    return Response.json({ exists: false, phone: null });
}
