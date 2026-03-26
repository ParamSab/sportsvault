import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function GET(req) {
    try {
        const session = await getSession(req);
        if (!session.user) return Response.json({ friends: [] });

        const friendships = await prisma.friendship.findMany({
            where: {
                OR: [
                    { userId: session.user.dbId },
                    { friendId: session.user.dbId }
                ]
            },
            include: {
                user: {
                    select: {
                        id: true, name: true, phone: true, photo: true, location: true,
                        sports: true, positions: true, ratings: true, trustScore: true,
                        thoughtsReceived: {
                            include: { from: { select: { name: true } } },
                            orderBy: { date: 'desc' },
                            take: 10
                        }
                    }
                },
                friend: {
                    select: {
                        id: true, name: true, phone: true, photo: true, location: true,
                        sports: true, positions: true, ratings: true, trustScore: true,
                        thoughtsReceived: {
                            include: { from: { select: { name: true } } },
                            orderBy: { date: 'desc' },
                            take: 10
                        }
                    }
                }
            }
        });

        const friendTiers = await prisma.friendTier.findMany({
            where: { userId: session.user.dbId }
        });

        const accepted = friendships.filter(f => f.status === 'accepted');
        const pending = friendships.filter(f => f.status === 'pending');

        const formatFriend = (f) => {
            const friendData = f.userId === session.user.dbId ? f.friend : f.user;
            return {
                ...friendData,
                friendshipStatus: f.status,
                isSender: f.userId === session.user.dbId,
                sports: JSON.parse(friendData.sports || '[]'),
                positions: JSON.parse(friendData.positions || '{}'),
                ratings: JSON.parse(friendData.ratings || '{}'),
                thoughts: (friendData.thoughtsReceived || []).map(t => ({
                    from: t.fromId,
                    fromName: t.from?.name,
                    text: t.text,
                    date: t.date.toISOString().split('T')[0]
                }))
            };
        };

        const friends = accepted.map(formatFriend);
        const pendingRequests = pending.map(formatFriend);

        return Response.json({ friends, pendingRequests, tiers: friendTiers });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const session = await getSession(req);
        if (!session.user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

        const { friendId, action, phone, name } = await req.json();

        if (action === 'add') {
            let finalFriendId = friendId;

            // If it's a "new" (offline) friend, we might need to create a shadow user or just save locally.
            // For now, let's just support adding existing users.
            if (phone && name) {
                const shadow = await prisma.user.upsert({
                    where: { phone },
                    update: {},
                    create: { name, phone, email: `offline_${Date.now()}@sportsvault.app`, privacy: 'private' }
                });
                finalFriendId = shadow.id;
            }

            if (!finalFriendId) return Response.json({ error: 'Friend ID or data required' }, { status: 400 });

            const friendship = await prisma.friendship.upsert({
                where: {
                    userId_friendId: { userId: session.user.dbId, friendId: finalFriendId }
                },
                update: { status: 'accepted' },
                create: { userId: session.user.dbId, friendId: finalFriendId, status: 'accepted' }
            });
            return Response.json({ success: true, friendship });
        }

        if (action === 'remove') {
            await prisma.friendship.deleteMany({
                where: {
                    OR: [
                        { userId: session.user.dbId, friendId },
                        { userId: friendId, friendId: session.user.dbId }
                    ]
                }
            });
            return Response.json({ success: true });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
