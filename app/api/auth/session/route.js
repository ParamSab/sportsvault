import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';

async function userStillExists(userId) {
    try {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
        if (user) return true;
    } catch (_) {}
    try {
        const supabase = getSupabase();
        if (supabase) {
            const { data } = await supabase.from('users').select('id').eq('id', userId).maybeSingle();
            if (data) return true;
        }
    } catch (_) {}
    return false;
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        if (!session.user) {
            return Response.json({ user: null });
        }

        const userId = session.user.dbId || session.user.id;
        const exists = await userStillExists(userId);
        if (!exists) {
            session.destroy();
            await session.save();
            return Response.json({ user: null }, { status: 401 });
        }

        return Response.json({ user: session.user });
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
