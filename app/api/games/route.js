import { prisma } from '@/lib/prisma';

// Games expire 1 day after the game date.
// Return the cutoff: games with date < cutoff are expired.
function getExpiryCutoff() {
    const d = new Date();
    d.setDate(d.getDate() - 1); // yesterday
    return d.toISOString().split('T')[0]; // YYYY-MM-DD string
}

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const friendIds = searchParams.get('friendIds')?.split(',').filter(Boolean) || [];
        const cutoff = getExpiryCutoff();

        const games = await prisma.game.findMany({
            where: {
                date: { gte: cutoff }, // not expired
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
                rsvps: {
                    include: {
                        player: { select: { id: true, name: true, photo: true } }
                    }
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Serialize for client, include RSVP player name/photo
        const serialized = games.map(g => ({
            ...g,
            rsvps: g.rsvps.map(r => ({
                playerId: r.playerId,
                status: r.status,
                position: r.position || '',
                playerName: r.player?.name || null,
                playerPhoto: r.player?.photo || null,
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
