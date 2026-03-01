import { prisma } from '@/lib/prisma';
import { getAppSession } from '@/lib/session';

export async function GET() {
    try {
        const session = await getAppSession();
        if (!session.user) return Response.json({ friends: [] });

        const friendships = await prisma.friendship.findMany({
            where: {
                OR: [
                    { userId: session.user.dbId },
                    { friendId: session.user.dbId }
                ]
            },
            include: {
                user: { select: { id: true, name: true, phone: true, photo: true, location: true, sports: true, positions: true } },
                friend: { select: { id: true, name: true, phone: true, photo: true, location: true, sports: true, positions: true } }
            }
        });

        const friendTiers = await prisma.friendTier.findMany({
            where: { userId: session.user.dbId }
        });

        const friends = friendships.map(f => {
            const friendData = f.userId === session.user.dbId ? f.friend : f.user;
            return {
                ...friendData,
                sports: JSON.parse(friendData.sports || '[]'),
                positions: JSON.parse(friendData.positions || '{}')
            };
        });

        return Response.json({ friends, tiers: friendTiers });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const session = await getAppSession();
        if (!session.user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

        const { friendId, action, phone, name } = await req.json();

        if (action === 'add') {
            let finalFriendId = friendId;

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
