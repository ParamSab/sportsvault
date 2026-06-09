import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

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

export async function POST() {
    return Response.json({ error: 'Session creation must use a verified auth route.' }, { status: 405 });
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
