import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

export async function POST(req) {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        
        const body = await req.json();
        const { gameId, status, position } = body;
        const playerId = body.playerId || session.user?.dbId || session.user?.id;

        if (!gameId || !playerId) return Response.json({ error: 'Missing required fields' }, { status: 400 });

        const rsvp = await prisma.rsvp.upsert({
            where: { gameId_playerId: { gameId, playerId } },
            update: { status, position: position || null },
            create: { gameId, playerId, status, position: position || null },
        });

        return Response.json({ rsvp });
    } catch (err) {
        console.error('RSVP error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
