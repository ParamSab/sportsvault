import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

export async function POST(req) {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        const userId = session.user?.dbId || session.user?.id;
        if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

        const { friendId, action } = await req.json();
        if (!friendId || !action) return Response.json({ error: 'Missing friendId or action' }, { status: 400 });

        if (action === 'send') {
            const existing = await prisma.friendship.findFirst({
                where: {
                    OR: [
                        { userId, friendId },
                        { userId: friendId, friendId: userId }
                    ]
                }
            });
            if (existing?.status === 'accepted') return Response.json({ error: 'Already friends' }, { status: 400 });
            if (existing?.status === 'pending') return Response.json({ error: 'Request already exists' }, { status: 400 });

            const friendship = await prisma.friendship.upsert({
                where: { userId_friendId: { userId, friendId } },
                update: { status: 'pending' },
                create: { userId, friendId, status: 'pending' }
            });

            try {
                await prisma.notification.create({
                    data: {
                        userId: friendId,
                        title: 'Friend Request',
                        message: `${session.user?.name || 'Someone'} sent you a friend request on SportsVault.`
                    }
                });
            } catch (_) { /* notification optional */ }

            return Response.json({ success: true, friendship });
        }

        if (action === 'accept') {
            await prisma.friendship.updateMany({
                where: {
                    OR: [
                        { userId: friendId, friendId: userId, status: 'pending' },
                        { userId, friendId, status: 'pending' }
                    ]
                },
                data: { status: 'accepted' }
            });
            // Notify the original sender
            try {
                await prisma.notification.create({
                    data: {
                        userId: friendId,
                        title: 'Friend Request Accepted',
                        message: `${session.user?.name || 'Someone'} accepted your friend request!`
                    }
                });
            } catch (_) {}
            return Response.json({ success: true });
        }

        if (action === 'reject' || action === 'cancel') {
            await prisma.friendship.deleteMany({
                where: {
                    OR: [
                        { userId, friendId, status: 'pending' },
                        { userId: friendId, friendId: userId, status: 'pending' }
                    ]
                }
            });
            return Response.json({ success: true });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });
    } catch (err) {
        console.error('POST /api/friends/request error:', err.message);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
