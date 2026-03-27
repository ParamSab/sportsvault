import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

export async function GET(req) {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    const userId = session.user?.dbId || session.user?.id;

    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50 // limit to last 50
        });
        return Response.json({ notifications });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req) {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    const userId = session.user?.dbId || session.user?.id;

    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        await prisma.notification.updateMany({
            where: { userId, read: false },
            data: { read: true }
        });
        return Response.json({ success: true });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
