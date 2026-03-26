import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

export async function POST(req) {
    try {
        const { friendId, action } = await req.json(); // action: 'send', 'accept', 'reject', 'cancel'
        
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        const currentUserId = session.user?.dbId || session.user?.id;

        if (!currentUserId || !friendId) {
            return Response.json({ error: 'Unauthorized or missing data' }, { status: 400 });
        }

        try {
            if (action === 'send') {
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

                const friendship = await prisma.friendship.create({
                    data: { userId: currentUserId, friendId: friendId, status: 'pending' }
                });

                await prisma.notification.create({
                    data: {
                        userId: friendId,
                        title: 'New Friend Request',
                        message: `${session.user?.name || 'Someone'} sent you a friend request.`,
                        action: '/discover?tab=friends', // Frontend will parse this to open Discover page on friends view
                    }
                });
                
                return Response.json({ success: true, friendship });
            }

            if (action === 'accept') {
                const reqRow = await prisma.friendship.findFirst({
                    where: { userId: friendId, friendId: currentUserId, status: 'pending' }
                });
                if (!reqRow) return Response.json({ error: 'No pending request found' }, { status: 404 });
                
                const friendship = await prisma.friendship.update({
                    where: { id: reqRow.id },
                    data: { status: 'accepted' }
                });
                return Response.json({ success: true, friendship });
            }

            if (action === 'reject' || action === 'cancel') {
                await prisma.friendship.deleteMany({
                    where: {
                        OR: [
                            { userId: currentUserId, friendId, status: 'pending' },
                            { userId: friendId, friendId: currentUserId, status: 'pending' }
                        ]
                    }
                });
                return Response.json({ success: true });
            }

            return Response.json({ error: 'Invalid action' }, { status: 400 });

        } catch (prismaErr) {
            console.error('Prisma friend request error:', prismaErr.message);
            // Fallback to Supabase here if urgently needed, but Prisma covers 99% for us.
            return Response.json({ error: 'Database error' }, { status: 500 });
        }
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
