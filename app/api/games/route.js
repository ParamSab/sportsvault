import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

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
                rsvps: {
                    include: {
                        player: { select: { id: true, name: true, photo: true, positions: true, ratings: true } }
                    }
                },
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
                player: r.player ? {
                    ...r.player,
                    positions: JSON.parse(r.player.positions || '{}'),
                    ratings: JSON.parse(r.player.ratings || '{}')
                } : null
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
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        
        const body = await req.json();
        const { game } = body;
        let userId = body.userId || session.user?.dbId || session.user?.id;

        if (!userId) {
            return Response.json({ error: 'Authentication required' }, { status: 401 });
        }

        const newGame = await prisma.game.create({
            data: {
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
                approvalRequired: !!game.approvalRequired,
                bookingImage: game.bookingImage || null,
                // Footy Addicts Parity
                pitchType: game.pitchType || '5-a-side',
                surface: game.surface || '3G Astro',
                footwear: game.footwear || '',
                price: game.price ? parseFloat(game.price.toString()) : 0,
                gender: game.gender || 'mixed',
                amenities: typeof game.amenities === 'string' ? game.amenities : JSON.stringify(game.amenities || []),
                organizerId: userId,
                rsvps: {
                    create: [{
                        playerId: userId,
                        status: 'yes',
                        position: game.organizerPosition || '',
                    }]
                }
            },
            include: { 
                rsvps: {
                    include: {
                        player: { select: { id: true, name: true, photo: true, positions: true, ratings: true } }
                    }
                },
                organizer: { select: { id: true, name: true, photo: true } }
            },
        });

        // Save to Supabase (fire-and-forget; does not block response)
        const supabase = getSupabase();
        if (supabase) {
            supabase.from('saved_games').upsert({
                game_id:      newGame.id,
                organizer_id: userId,
                title:        newGame.title,
                sport:        newGame.sport,
                format:       newGame.format,
                game_date:    newGame.date,
                game_time:    newGame.time,
                duration:     newGame.duration,
                location:     newGame.location,
                address:      newGame.address || '',
                lat:          newGame.lat,
                lng:          newGame.lng,
                max_players:  newGame.maxPlayers,
                skill_level:  newGame.skillLevel,
                status:       'open',
                visibility:   newGame.visibility,
                price:        newGame.price || 0,
                gender:       newGame.gender || 'mixed',
                pitch_type:   newGame.pitchType || null,
                surface:      newGame.surface || null,
            }, { onConflict: 'game_id' }).then(({ error }) => {
                if (error) console.error('Supabase save_game error:', error.message);
            });
        }

        // Serialize for client
        const serialized = {
            ...newGame,
            rsvps: newGame.rsvps.map(r => ({
                playerId: r.playerId,
                status: r.status,
                position: r.position || '',
                player: r.player ? {
                    ...r.player,
                    positions: JSON.parse(r.player.positions || '{}'),
                    ratings: JSON.parse(r.player.ratings || '{}')
                } : null
            }))
        };

        return Response.json({ game: serialized });
    } catch (err) {
        console.error('POST /api/games error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
