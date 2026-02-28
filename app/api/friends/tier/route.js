import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function POST(req) {
    try {
        const session = await getSession(req);
        if (!session.user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

        const { friendId, sport, tier } = await req.json();

        if (tier === null) {
            await prisma.friendTier.deleteMany({
                where: { userId: session.user.dbId, friendId, sport }
            });
        } else {
            await prisma.friendTier.upsert({
                where: {
                    userId_friendId_sport: { userId: session.user.dbId, friendId, sport }
                },
                update: { tier },
                create: { userId: session.user.dbId, friendId, sport, tier }
            });
        }

        return Response.json({ success: true });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
