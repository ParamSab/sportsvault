import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

function supabaseRowToGame(g) {
    return {
        id: g.game_id,
        title: g.title,
        sport: g.sport,
        format: g.format || '',
        date: g.game_date,
        time: g.game_time,
        duration: g.duration || 90,
        location: g.location || '',
        address: g.address || '',
        lat: g.lat,
        lng: g.lng,
        maxPlayers: g.max_players || 10,
        skillLevel: g.skill_level || 'All Levels',
        status: g.status,
        visibility: g.visibility || 'public',
        approvalRequired: false,
        bookingImage: null,
        pitchType: g.pitch_type || null,
        surface: g.surface || null,
        footwear: '',
        price: g.price || 0,
        gender: g.gender || 'mixed',
        amenities: '[]',
        organizerId: g.organizer_id,
        organizer: { id: g.organizer_id, name: '', photo: null },
        rsvps: [],
        createdAt: g.created_at,
    };
}

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const friendIds = searchParams.get('friendIds')?.split(',') || [];

    // --- Try Prisma first ---
    try {
        // Auto-expire games (24h after start)
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
    } catch (prismaErr) {
        console.error('GET /api/games Prisma error — falling back to Supabase:', prismaErr.message);
    }

    // --- Supabase fallback ---
    try {
        const supabase = getSupabase();
        if (supabase) {
            const query = supabase
                .from('saved_games')
                .select('*')
                .order('created_at', { ascending: false });

            const { data, error } = await query;
            if (!error && data) {
                // Filter to games visible to this user
                const visible = data.filter(g =>
                    g.visibility === 'public' ||
                    g.organizer_id === userId ||
                    (g.visibility === 'friends' && friendIds.includes(g.organizer_id))
                );
                return Response.json({ games: visible.map(supabaseRowToGame) });
            }
            if (error) console.error('Supabase fallback GET error:', error.message);
        }
    } catch (supaErr) {
        console.error('Supabase fallback GET exception:', supaErr.message);
    }

    // Both failed — return error so the client keeps existing state
    return Response.json({ error: 'Database unavailable' }, { status: 503 });
}

export async function POST(req) {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);

    const body = await req.json();
    const { game } = body;
    let userId = body.userId || session.user?.dbId || session.user?.id;

    if (!userId) {
        return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    // --- Try Prisma first ---
    try {
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

        // Also save to Supabase as backup (fire-and-forget)
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
                if (error) console.error('Supabase backup save error:', error.message);
            });
        }

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
    } catch (prismaErr) {
        console.error('POST /api/games Prisma error — falling back to Supabase:', prismaErr.message);
    }

    // --- Supabase fallback ---
    try {
        const supabase = getSupabase();
        if (!supabase) {
            return Response.json({ error: 'No database available' }, { status: 503 });
        }

        const gameId = crypto.randomUUID();
        const { error } = await supabase.from('saved_games').insert({
            game_id:      gameId,
            organizer_id: userId,
            title:        game.title,
            sport:        game.sport,
            format:       game.format || '',
            game_date:    game.date,
            game_time:    game.time,
            duration:     game.duration || 90,
            location:     game.location || '',
            address:      game.address || '',
            lat:          game.lat || null,
            lng:          game.lng || null,
            max_players:  game.maxPlayers || 10,
            skill_level:  game.skillLevel || 'All Levels',
            status:       'open',
            visibility:   game.visibility || 'public',
            price:        game.price ? parseFloat(game.price.toString()) : 0,
            gender:       game.gender || 'mixed',
            pitch_type:   game.pitchType || null,
            surface:      game.surface || null,
        });

        if (error) {
            console.error('Supabase fallback POST error:', error.message);
            return Response.json({ error: error.message }, { status: 500 });
        }

        // Return a game object shaped like what the frontend expects
        const savedGame = {
            id: gameId,
            title: game.title,
            sport: game.sport,
            format: game.format || '',
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
            approvalRequired: false,
            bookingImage: null,
            pitchType: game.pitchType || null,
            surface: game.surface || null,
            footwear: '',
            price: game.price ? parseFloat(game.price.toString()) : 0,
            gender: game.gender || 'mixed',
            amenities: typeof game.amenities === 'string' ? game.amenities : JSON.stringify(game.amenities || []),
            organizerId: userId,
            organizer: { id: userId, name: '', photo: null },
            rsvps: [{ playerId: userId, status: 'yes', position: game.organizerPosition || '', player: null }],
            createdAt: new Date().toISOString(),
        };

        return Response.json({ game: savedGame });
    } catch (supaErr) {
        console.error('Supabase fallback POST exception:', supaErr.message);
        return Response.json({ error: supaErr.message }, { status: 500 });
    }
}
