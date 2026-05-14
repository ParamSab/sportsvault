import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';
import {
    acceptLocalFriendship,
    deleteLocalFriendship,
    findLocalFriendship,
    upsertLocalFriendship,
} from '@/lib/localFriendStore';

export async function POST(req) {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        const currentUserId = session.user?.dbId || session.user?.id;

        const { friendId, action } = await req.json(); // action: 'send', 'accept', 'reject', 'cancel'

        if (!currentUserId || !friendId) {
            return Response.json({ error: 'Unauthorized or missing data' }, { status: 400 });
        }

        if (action === 'send') {
            let friendship;
            try {
                const existing = await prisma.friendship.findFirst({
                    where: { OR: [
                        { userId: currentUserId, friendId },
                        { userId: friendId, friendId: currentUserId }
                    ]}
                });

                if (existing) {
                    if (existing.status === 'accepted') return Response.json({ error: 'Already friends' }, { status: 400 });
                    return Response.json({ error: 'Request already exists' }, { status: 400 });
                }

                friendship = await prisma.friendship.create({
                    data: { userId: currentUserId, friendId, status: 'pending' }
                });
            } catch (prismaErr) {
                const supabase = getSupabase();
                if (!supabase) {
                    const existing = await findLocalFriendship(currentUserId, friendId);
                    if (existing) {
                        if (existing.status === 'accepted') return Response.json({ error: 'Already friends' }, { status: 400 });
                        return Response.json({ error: 'Request already exists' }, { status: 400 });
                    }
                    friendship = await upsertLocalFriendship(currentUserId, friendId, 'pending');
                } else {
                const { data: existingRows, error: existingError } = await supabase
                    .from('friendships')
                    .select('*')
                    .or(`and(user_id.eq.${currentUserId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${currentUserId})`)
                    .limit(1);
                if (existingError) throw existingError;
                const existing = existingRows?.[0];
                if (existing) {
                    if (existing.status === 'accepted') return Response.json({ error: 'Already friends' }, { status: 400 });
                    return Response.json({ error: 'Request already exists' }, { status: 400 });
                }
                const { data, error } = await supabase
                    .from('friendships')
                    .insert({ user_id: currentUserId, friend_id: friendId, status: 'pending' })
                    .select()
                    .single();
                if (error) throw error;
                friendship = data;
                }
            }

            try {
                await prisma.notification.create({
                    data: {
                        userId: friendId,
                        title: 'New Friend Request',
                        message: `${session.user?.name || 'Someone'} sent you a friend request.`,
                    }
                });
            } catch (_) { /* notification optional */ }

            return Response.json({ success: true, friendship });
        }

        if (action === 'accept') {
            let friendship;
            try {
                const reqRow = await prisma.friendship.findFirst({
                    where: { userId: friendId, friendId: currentUserId, status: 'pending' }
                });
                if (!reqRow) return Response.json({ error: 'No pending request found' }, { status: 404 });

                friendship = await prisma.friendship.update({
                    where: { id: reqRow.id },
                    data: { status: 'accepted' }
                });
            } catch (prismaErr) {
                const supabase = getSupabase();
                if (!supabase) {
                    friendship = await acceptLocalFriendship(friendId, currentUserId);
                    if (!friendship) return Response.json({ error: 'No pending request found' }, { status: 404 });
                } else {
                const { data, error } = await supabase
                    .from('friendships')
                    .update({ status: 'accepted' })
                    .eq('user_id', friendId)
                    .eq('friend_id', currentUserId)
                    .eq('status', 'pending')
                    .select()
                    .maybeSingle();
                if (error) throw error;
                if (!data) return Response.json({ error: 'No pending request found' }, { status: 404 });
                friendship = data;
                }
            }

            try {
                await prisma.notification.create({
                    data: {
                        userId: friendId,
                        title: 'Friend Request Accepted',
                        message: `${session.user?.name || 'Someone'} accepted your friend request!`
                    }
                });
            } catch (_) {}

            return Response.json({ success: true, friendship });
        }

        if (action === 'reject' || action === 'cancel') {
            try {
                await prisma.friendship.deleteMany({
                    where: {
                        OR: [
                            { userId: currentUserId, friendId, status: 'pending' },
                            { userId: friendId, friendId: currentUserId, status: 'pending' }
                        ]
                    }
                });
            } catch (prismaErr) {
                const supabase = getSupabase();
                if (!supabase) {
                    await deleteLocalFriendship(currentUserId, friendId, 'pending');
                } else {
                    await supabase
                        .from('friendships')
                        .delete()
                        .eq('status', 'pending')
                        .or(`and(user_id.eq.${currentUserId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${currentUserId})`);
                }
            }
            return Response.json({ success: true });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });
    } catch (err) {
        console.error('POST /api/friends/request error:', err.message);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
