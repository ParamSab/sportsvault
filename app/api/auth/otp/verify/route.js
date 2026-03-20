import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

const sessionOptions = {
    password: process.env.SESSION_SECRET || 'sportsvault-super-secret-key-min-32-chars!!',
    cookieName: 'sportsvault_session',
    cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30, // 30 days
    },
};

export async function POST(req) {
    try {
        const { email, code, rememberMe } = await req.json();
        if (!email || !code) return Response.json({ error: 'Email and code required' }, { status: 400 });

        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);

        // Verify against session
        const temp = session.temp;
        if (!temp || temp.email !== email) {
            return Response.json({ error: 'Verification expired or invalid' }, { status: 400 });
        }

        if (Date.now() > temp.expiresAt) {
            return Response.json({ error: 'Code expired' }, { status: 400 });
        }

        // Allow master bypass or correct code
        if (code !== temp.otp && code !== '990770') {
            return Response.json({ error: 'Incorrect verification code' }, { status: 401 });
        }

        // Clear temp state
        delete session.temp;
        await session.save();

        return await handleUserLogin(email, rememberMe);
    } catch (err) {
        console.error('Verify API error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}

async function handleUserLogin(email, rememberMe) {
    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (user) {
        const customOptions = { ...sessionOptions };
        if (!rememberMe) {
            customOptions.cookieOptions = { ...customOptions.cookieOptions };
            delete customOptions.cookieOptions.maxAge; // Session cookie only
        }

        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, customOptions);

        const userData = {
            ...user,
            sports: JSON.parse(user.sports || '[]'),
            positions: JSON.parse(user.positions || '{}'),
            ratings: JSON.parse(user.ratings || '{}'),
            dbId: user.id
        };
        delete userData.password;

        session.user = userData;
        await session.save();

        return Response.json({ user: userData, exists: true });
    }

    // User does not exist, need to onboard
    return Response.json({ exists: false });
}
