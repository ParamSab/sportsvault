import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';

// Returns {photo} for a live user, null if the user no longer exists.
// The photo is fetched here because it is deliberately NOT stored in the
// session cookie (inline base64 photos blew past the 4KB cookie limit and
// broke login for users with profile photos).
async function fetchLiveUser(userId) {
    try {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, photo: true } });
        if (user) return user;
    } catch (_) {}
    try {
        const supabase = getSupabase();
        if (supabase) {
            const { data } = await supabase.from('users').select('id, photo').eq('id', userId).maybeSingle();
            if (data) return data;
        }
    } catch (_) {}
    return null;
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        if (!session.user) {
            return Response.json({ user: null });
        }

        const userId = session.user.dbId || session.user.id;
        const liveUser = await fetchLiveUser(userId);
        if (!liveUser) {
            session.destroy();
            await session.save();
            return Response.json({ user: null }, { status: 401 });
        }

        return Response.json({ user: { ...session.user, photo: session.user.photo || liveUser.photo || null } });
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
