import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function POST(req) {
    try {
        const session = await getSession(req);
        if (!session.user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

        const { friendId, sport, tier } = await req.json();
        const currentUserId = session.user.dbId || session.user.id;

        if (tier === null) {
            await prisma.friendTier.deleteMany({
                where: { userId: currentUserId, friendId, sport }
            });
        } else {
            await prisma.friendTier.upsert({
                where: {
                    userId_friendId_sport: { userId: currentUserId, friendId, sport }
                },
                update: { tier },
                create: { userId: currentUserId, friendId, sport, tier }
            });
        }

        return Response.json({ success: true });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
