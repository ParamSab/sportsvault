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
        // Auto-expire: single batch UPDATE for all games whose date is >2 days old.
        // This replaces the N+1 loop that fired one UPDATE per expired game.
        try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 2);
            const cutoffStr = cutoff.toISOString().split('T')[0]; // YYYY-MM-DD
            await prisma.game.updateMany({
                where: { status: 'open', date: { lt: cutoffStr } },
                data:  { status: 'completed' }
            });
        } catch (expireErr) {
            console.error('Auto-expire error:', expireErr.message);
        }

        // Only return games from 7 days ago onward — no need to load ancient history.
        const windowStart = new Date();
        windowStart.setDate(windowStart.getDate() - 7);
        const windowStr = windowStart.toISOString().split('T')[0];

        const visibilityFilter = [{ visibility: 'public' }];
        if (userId) visibilityFilter.push({ organizerId: userId });
        if (friendIds.length > 0) {
            visibilityFilter.push({
                AND: [{ visibility: 'friends' }, { organizerId: { in: friendIds } }]
            });
        }

        const games = await prisma.game.findMany({
            where: {
                date: { gte: windowStr },
                OR: visibilityFilter,
            },
            include: {
                organizer: { select: { id: true, name: true, photo: true } },
                rsvps: {
                    include: {
                        player: { select: { id: true, name: true, photo: true, positions: true, ratings: true } }
                    }
                },
            },
            orderBy: { date: 'asc' },
            take: 100, // Never return more than 100 games at once
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
            const { data, error } = await supabase
                .from('saved_games')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && data) {
                const visible = data.filter(g =>
                    g.visibility === 'public' ||
                    g.organizer_id === userId ||
                    (g.visibility === 'friends' && friendIds.includes(g.organizer_id))
                );

                const gameIds = visible.map(g => g.game_id);

                // Fetch RSVPs for these games
                const { data: rsvps } = gameIds.length
                    ? await supabase.from('game_rsvps').select('*').in('game_id', gameIds)
                    : { data: [] };

                // Fetch organizer names from users table
                const organizerIds = [...new Set(visible.map(g => g.organizer_id))];
                const { data: organizers } = organizerIds.length
                    ? await supabase.from('users').select('id, name, photo').in('id', organizerIds)
                    : { data: [] };
                const organizerMap = {};
                (organizers || []).forEach(u => { organizerMap[u.id] = u; });

                const games = visible.map(g => ({
                    ...supabaseRowToGame(g),
                    organizer: organizerMap[g.organizer_id] || { id: g.organizer_id, name: '', photo: null },
                    rsvps: (rsvps || [])
                        .filter(r => r.game_id === g.game_id)
                        .map(r => ({ playerId: r.player_id, status: r.status, position: r.position || '', player: null })),
                }));

                return Response.json({ games });
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

    // Ensure new columns exist before attempting to create (idempotent)
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "upiId" TEXT`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "score" TEXT`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Rsvp" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT DEFAULT 'not_required'`);
    } catch (_) { /* non-fatal */ }

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

        // Also create the organizer's RSVP in game_rsvps
        try {
            await supabase.from('game_rsvps').insert({
                game_id:   gameId,
                player_id: userId,
                status:    'yes',
                position:  game.organizerPosition || '',
            });
        } catch (rsvpErr) {
            console.error('Organizer RSVP Supabase error:', rsvpErr?.message);
        }

        const organizerName = session.user?.name || '';
        const organizerPhoto = session.user?.photo || null;

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
            approvalRequired: !!game.approvalRequired,
            bookingImage: null,
            pitchType: game.pitchType || null,
            surface: game.surface || null,
            footwear: '',
            price: game.price ? parseFloat(game.price.toString()) : 0,
            gender: game.gender || 'mixed',
            amenities: typeof game.amenities === 'string' ? game.amenities : JSON.stringify(game.amenities || []),
            organizerId: userId,
            organizer: { id: userId, name: organizerName, photo: organizerPhoto },
            rsvps: [{ playerId: userId, status: 'yes', position: game.organizerPosition || '', player: { id: userId, name: organizerName, photo: organizerPhoto, positions: {}, ratings: {} } }],
            createdAt: new Date().toISOString(),
        };

        return Response.json({ game: savedGame });
    } catch (supaErr) {
        console.error('Supabase fallback POST exception:', supaErr.message);
        return Response.json({ error: supaErr.message }, { status: 500 });
    }
}
