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

export async function GET() {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        if (session.user) {
            return Response.json({ user: session.user });
        }
        return Response.json({ user: null });
    } catch (err) {
        console.error('Session GET error:', err);
        return Response.json({ user: null });
    }
}

export async function POST(req) {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        const { user } = await req.json();
        const parsedUser = {
            ...user,
            sports: Array.isArray(user.sports) ? user.sports : (typeof user.sports === 'string' ? JSON.parse(user.sports || '[]') : []),
            positions: typeof user.positions === 'object' ? user.positions : (typeof user.positions === 'string' ? JSON.parse(user.positions || '{}') : {}),
            ratings: typeof user.ratings === 'object' ? user.ratings : (typeof user.ratings === 'string' ? JSON.parse(user.ratings || '{}') : {}),
        };
        session.user = parsedUser;
        await session.save();
        return Response.json({ success: true });
    } catch (err) {
        console.error('Session POST error:', err);
        return Response.json({ error: 'Failed to save session' }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        session.destroy();
        return Response.json({ success: true });
    } catch (err) {
        console.error('Session DELETE error:', err);
        return Response.json({ error: 'Failed to destroy session' }, { status: 500 });
    }
}
