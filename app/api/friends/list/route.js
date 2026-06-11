import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

export async function GET() {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    const userId = session.user?.dbId || session.user?.id;
    if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    // Try Prisma first
    try {
        const friendships = await prisma.friendship.findMany({
            where: {
                status: 'accepted',
                OR: [{ userId }, { friendId: userId }]
            },
            include: {
                user: { select: { id: true, name: true, phone: true, photo: true } },
                friend: { select: { id: true, name: true, phone: true, photo: true } }
            }
        });
        const friends = friendships.map(f => f.userId === userId ? f.friend : f.user);
        return Response.json({ success: true, friends });
    } catch (err) {
        console.error('GET /api/friends/list Prisma error, falling back to Supabase:', err.message);
    }

    // Supabase fallback
    try {
        const supabase = getSupabase();
        if (supabase) {
            const { data: rows } = await supabase
                .from('friendships')
                .select('user_id, friend_id, status')
                .eq('status', 'accepted')
                .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
            if (rows?.length) {
                const friendIds = rows.map(r => r.user_id === userId ? r.friend_id : r.user_id);
                const { data: users } = await supabase
                    .from('users')
                    .select('id, name, phone, photo')
                    .in('id', friendIds);
                return Response.json({ success: true, friends: users || [] });
            }
        }
    } catch (err) {
        console.error('GET /api/friends/list Supabase error:', err.message);
    }

    return Response.json({ success: true, friends: [] });
}
