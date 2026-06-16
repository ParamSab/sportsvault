import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

function supabaseRowToGame(g) {
    return {
        id: g.game_id || g.id,
        title: g.title,
        sport: g.sport,
        format: g.format || '',
        date: g.game_date || g.date,
        time: g.game_time || g.time,
        duration: g.duration || 90,
        location: g.location || '',
        address: g.address || '',
        lat: g.lat,
        lng: g.lng,
        maxPlayers: g.max_players || g.maxPlayers || 10,
        skillLevel: g.skill_level || g.skillLevel || 'All Levels',
        status: g.status,
        visibility: g.visibility || 'public',
        approvalRequired: !!(g.approval_required ?? g.approvalRequired),
        bookingImage: g.bookingImage || null,
        pitchType: g.pitch_type || g.pitchType || null,
        surface: g.surface || null,
        footwear: g.footwear || '',
        price: g.price || 0,
        gender: g.gender || 'mixed',
        amenities: g.amenities || '[]',
        organizerId: g.organizer_id || g.organizerId,
        organizer: { id: g.organizer_id || g.organizerId, name: '', photo: null },
        rsvps: [],
        score: g.score || null,
        createdAt: g.created_at || g.createdAt,
    };
}

function safeParse(val, fallback) {
    if (val == null) return fallback;
    if (typeof val !== 'string') return val ?? fallback;
    try { return JSON.parse(val) ?? fallback; } catch { return fallback; }
}

export const dynamic = 'force-dynamic';

// Run migrations + auto-expire at most once per 10 minutes per process, off the request path.
let _lastHousekeeping = 0;
function scheduleHousekeeping() {
    const now = Date.now();
    if (now - _lastHousekeeping < 10 * 60 * 1000) return;
    _lastHousekeeping = now;
    (async () => {
        try {
            await prisma.$executeRawUnsafe(`ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "upiId" TEXT`);
            await prisma.$executeRawUnsafe(`ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "score" TEXT`);
            await prisma.$executeRawUnsafe(`ALTER TABLE "Rsvp" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT DEFAULT 'not_required'`);
        } catch (e) { console.error('bg migrate:', e.message); }
        try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 2);
            const cutoffStr = cutoff.toISOString().split('T')[0];
            await prisma.game.updateMany({
                where: { status: 'open', date: { lt: cutoffStr } },
                data:  { status: 'completed' }
            });
        } catch (e) { console.error('bg expire:', e.message); }
    })();
}

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const friendIds = searchParams.get('friendIds')?.split(',') || [];

    // --- Try Prisma first ---
    try {
        scheduleHousekeeping();

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
                paymentStatus: r.paymentStatus || 'not_required',
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
            const windowStart = new Date();
            windowStart.setDate(windowStart.getDate() - 7);
            const windowStr = windowStart.toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('Game')
                .select('*')
                .gte('date', windowStr)
                .order('date', { ascending: true })
                .limit(100);

            if (!error && data) {
                const visible = data.filter(g =>
                    g.visibility === 'public' ||
                    g.organizerId === userId ||
                    (g.visibility === 'friends' && friendIds.includes(g.organizerId))
                );

                const gameIds = visible.map(g => g.id);

                // Fetch RSVPs for these games
                const { data: rsvps } = gameIds.length
                    ? await supabase.from('Rsvp').select('*').in('gameId', gameIds)
                    : { data: [] };

                // Fetch organizer names from users table
                const organizerIds = [...new Set(visible.map(g => g.organizerId))];
                const playerIds = [...new Set((rsvps || []).map(r => r.playerId))];
                const { data: organizers } = organizerIds.length
                    ? await supabase.from('User').select('id, name, photo').in('id', organizerIds)
                    : { data: [] };
                const { data: players } = playerIds.length
                    ? await supabase.from('User').select('id, name, photo, positions, ratings').in('id', playerIds)
                    : { data: [] };
                const organizerMap = {};
                (organizers || []).forEach(u => { organizerMap[u.id] = u; });
                const playerMap = {};
                (players || []).forEach(u => { playerMap[u.id] = u; });

                const games = visible.map(g => ({
                    ...supabaseRowToGame(g),
                    organizer: organizerMap[g.organizerId] || { id: g.organizerId, name: '', photo: null },
                    rsvps: (rsvps || [])
                        .filter(r => r.gameId === g.id)
                        .map(r => {
                            const player = playerMap[r.playerId];
                            return {
                                playerId: r.playerId,
                                status: r.status,
                                position: r.position || '',
                                paymentStatus: r.paymentStatus || 'not_required',
                                player: player ? {
                                    ...player,
                                    positions: safeParse(player.positions, {}),
                                    ratings: safeParse(player.ratings, {}),
                                } : null,
                            };
                        }),
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
                reminderHours: game.reminderHours !== undefined ? parseInt(game.reminderHours) : 2,
                remindersSent: false,
                bookingImage: game.bookingImage || null,
                pitchType: game.pitchType || '5-a-side',
                surface: game.surface || '3G Astro',
                footwear: game.footwear || '',
                price: game.price ? parseFloat(game.price.toString()) : 0,
                upiId: game.upiId || null,
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
        const { data: savedGameRow, error } = await supabase.from('Game').insert({
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
            reminderHours: game.reminderHours !== undefined ? parseInt(game.reminderHours) : 2,
            remindersSent: false,
            bookingImage: game.bookingImage || null,
            pitchType: game.pitchType || '5-a-side',
            surface: game.surface || '3G Astro',
            footwear: game.footwear || '',
            price: game.price ? parseFloat(game.price.toString()) : 0,
            gender: game.gender || 'mixed',
            amenities: typeof game.amenities === 'string' ? game.amenities : JSON.stringify(game.amenities || []),
            organizerId: userId,
            upiId: game.upiId || null,
        }).select().single();

        if (error) {
            console.error('Supabase fallback POST error:', error.message);
            return Response.json({ error: error.message }, { status: 500 });
        }

        const { error: rsvpError } = await supabase.from('Rsvp').insert({
            gameId,
            playerId: userId,
            status: 'yes',
            position: game.organizerPosition || '',
            paymentStatus: 'not_required',
        });
        if (rsvpError) {
            await supabase.from('Game').delete().eq('id', gameId);
            return Response.json({ error: rsvpError.message }, { status: 500 });
        }

        const organizerName = session.user?.name || '';
        const organizerPhoto = session.user?.photo || null;

        // Return a game object shaped like what the frontend expects
        const savedGame = {
            ...supabaseRowToGame(savedGameRow),
            status: 'open',
            organizerId: userId,
            organizer: { id: userId, name: organizerName, photo: organizerPhoto },
            rsvps: [{ playerId: userId, status: 'yes', position: game.organizerPosition || '', player: { id: userId, name: organizerName, photo: organizerPhoto, positions: {}, ratings: {} } }],
        };

        return Response.json({ game: savedGame });
    } catch (supaErr) {
        console.error('Supabase fallback POST exception:', supaErr.message);
        return Response.json({ error: 'Database unavailable' }, { status: 503 });
    }
}
