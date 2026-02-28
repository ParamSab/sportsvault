import { prisma } from '@/lib/prisma';

export async function POST(req) {
    try {
        const { gameId, playerId, status, position } = await req.json();
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
