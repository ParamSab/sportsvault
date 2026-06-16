import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    });
    return Promise.race([
        promise.finally(() => clearTimeout(timer)),
        timeout,
    ]);
}

async function loadFriendsWithPrisma(userId) {
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

    return friendships.map(f => f.userId === userId ? f.friend : f.user);
}

async function loadFriendsWithSupabase(userId) {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data: rows, error } = await supabase
        .from('Friendship')
        .select('userId, friendId, status')
        .eq('status', 'accepted')
        .or(`userId.eq.${userId},friendId.eq.${userId}`);

    if (error) throw error;

    const friendIds = [...new Set((rows || []).map(row =>
        String(row.userId) === String(userId) ? row.friendId : row.userId
    ).filter(Boolean))];

    if (friendIds.length === 0) return [];

    const { data: users, error: usersError } = await supabase
        .from('User')
        .select('id, name, phone, photo')
        .in('id', friendIds);

    if (usersError) throw usersError;

    return users || [];
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        const userId = session.user?.dbId || session.user?.id;
        if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

        let friends;
        try {
            friends = await withTimeout(loadFriendsWithPrisma(userId), 5000, 'Friends lookup');
        } catch (prismaErr) {
            console.error('[friends/list] Prisma error, falling back to Supabase:', prismaErr.message);
            friends = await loadFriendsWithSupabase(userId);
        }

        return Response.json({ success: true, friends });
    } catch (err) {
        console.error('GET /api/friends/list error:', err.message);
        return Response.json({ success: true, friends: [], warning: 'Friends could not be loaded right now.' });
    }
}
