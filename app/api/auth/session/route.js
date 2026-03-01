import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

const sessionOptions = {
    password: process.env.SESSION_SECRET || 'sportsvault-super-secret-key-min-32-chars!!',
    cookieName: 'sportsvault_session',
    cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
    },
};

// Only store the minimal fields needed to identify the user.
// Photo is base64 and blows the 4KB cookie limit.
function minimalUser(user) {
    const { photo: _photo, thoughts: _t, ...rest } = user;
    return rest;
}

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
        const { user, rememberMe } = await req.json();
        const opts = rememberMe === false
            ? { ...sessionOptions, cookieOptions: { ...sessionOptions.cookieOptions, maxAge: undefined } }
            : sessionOptions;
        const session = await getIronSession(cookieStore, opts);
        session.user = minimalUser(user);
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
