import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

export async function GET() {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    const userId = session.user?.dbId || session.user?.id;
    if (!userId) return Response.json({ notifications: [] });

    try {
        const notifications = await prisma.notification.findMany({
            where: { userId }, orderBy: { createdAt: 'desc' }, take: 50,
        });
        return Response.json({ notifications });
    } catch (_) { /* fall through to Supabase */ }

    try {
        const supabase = getSupabase();
        if (supabase) {
            const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
            return Response.json({ notifications: (data || []).map(n => ({
                id: n.id, userId: n.user_id, title: n.title, message: n.message,
                read: n.read, createdAt: n.created_at, gameId: n.game_id, action: n.action,
            })) });
        }
    } catch (_) { /* ignore */ }

    return Response.json({ notifications: [] });
}

export async function POST() {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    const userId = session.user?.dbId || session.user?.id;
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
        return Response.json({ success: true });
    } catch (_) { /* fall through */ }

    try {
        const supabase = getSupabase();
        if (supabase) {
            await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
            return Response.json({ success: true });
        }
    } catch (_) { /* ignore */ }

    return Response.json({ success: false });
}
