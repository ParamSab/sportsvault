import { prisma } from '@/lib/prisma';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const friendIds = searchParams.get('friendIds')?.split(',') || [];

        // --- Auto-expire games (24h after start) ---
        try {
            const now = new Date();
            const openGames = await prisma.game.findMany({ where: { status: 'open' } });
            for (const g of openGames) {
                const gameStart = new Date(`${g.date}T${g.time || '00:00'}`);
                const expiry = new Date(gameStart.getTime() + (24 * 60 * 60 * 1000));
                if (now > expiry) {
                    await prisma.game.update({ where: { id: g.id }, data: { status: 'completed' } });
                }
            }
        } catch (expireErr) {
            console.error('Error auto-expiring games:', expireErr);
        }

        const games = await prisma.game.findMany({
            where: {
                OR: [
                    { visibility: 'public' },
                    { organizerId: userId || undefined },
                    {
                        AND: [
                            { visibility: 'friends' },
                            { organizerId: { in: friendIds.length ? friendIds : ['__none__'] } }
                        ]
                    }
                ]
            },
            include: {
                organizer: { select: { id: true, name: true, photo: true } },
                rsvps: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        // Serialize for client
        const serialized = games.map(g => ({
            ...g,
            rsvps: g.rsvps.map(r => ({
                playerId: r.playerId,
                status: r.status,
                position: r.position || '',
            })),
        }));

        return Response.json({ games: serialized });
    } catch (err) {
        console.error('GET /api/games error:', err);
        return Response.json({ games: [] });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { game, userId } = body;

        if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });

        const newGame = await prisma.game.create({
            data: {
                id: game.id || undefined,
                title: game.title,
                sport: game.sport,
                format: game.format,
                date: game.date,
                time: game.time,
                duration: game.duration || 90,
                location: game.location || '',
                address: game.address || '',
                lat: game.lat || null,
                lng: game.lng || null,
                maxPlayers: game.maxPlayers || 10,
                skillLevel: game.skillLevel || 'All Levels',
                status: 'open',
                visibility: game.visibility || 'public',
                organizerId: userId,
                rsvps: {
                    create: [{
                        playerId: userId,
                        status: 'yes',
                        position: game.organizerPosition || '',
                    }]
                }
            },
            include: { rsvps: true },
        });

        return Response.json({ game: newGame });
    } catch (err) {
        console.error('POST /api/games error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
