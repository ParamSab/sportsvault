import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        const userId = session.user?.dbId || session.user?.id;
        if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

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
        console.error('GET /api/friends/list error:', err.message);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
