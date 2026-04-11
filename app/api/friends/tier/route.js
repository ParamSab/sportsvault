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

        const { friendId, sport, tier } = await req.json();

        if (tier === null) {
            await prisma.friendTier.deleteMany({
                where: { userId, friendId, sport }
            });
        } else {
            await prisma.friendTier.upsert({
                where: { userId_friendId_sport: { userId, friendId, sport } },
                update: { tier },
                create: { userId, friendId, sport, tier }
            });
        }

        return Response.json({ success: true });
    } catch (err) {
        console.error('POST /api/friends/tier error:', err.message);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
