import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

export const dynamic = 'force-dynamic';

function safeParse(val, fallback) {
    if (val == null) return fallback;
    if (typeof val !== 'string') return val ?? fallback;
    try { return JSON.parse(val) ?? fallback; } catch { return fallback; }
}

function parseUser(u) {
    if (!u) return null;
    return {
        ...u,
        sports: safeParse(u.sports, []),
        positions: safeParse(u.positions, {}),
        ratings: safeParse(u.ratings, {}),
        thoughts: [],
    };
}

// Single endpoint that returns games + notifications + friends in one DB round-trip.
// Replaces 3 separate cold-start API calls with one parallel query bundle.
export async function GET(req) {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    const userId = session.user?.dbId || session.user?.id;

    const { searchParams } = new URL(req.url);
    const friendIds = searchParams.get('friendIds')?.split(',').filter(Boolean) || [];

    // --- Try Prisma (all queries in parallel) ---
    try {
        const windowStart = new Date();
        windowStart.setDate(windowStart.getDate() - 7);
        const windowStr = windowStart.toISOString().split('T')[0];

        const visibilityFilter = [{ visibility: 'public' }];
        if (userId) visibilityFilter.push({ organizerId: userId });
        if (friendIds.length > 0) {
            visibilityFilter.push({ AND: [{ visibility: 'friends' }, { organizerId: { in: friendIds } }] });
        }

        const queries = [
            // Games
            prisma.game.findMany({
                where: { date: { gte: windowStr }, OR: visibilityFilter },
                include: {
                    organizer: { select: { id: true, name: true, photo: true } },
                    rsvps: {
                        include: {
                            player: { select: { id: true, name: true, photo: true, positions: true, ratings: true } }
                        }
                    },
                },
                orderBy: { date: 'asc' },
                take: 100,
            }),
            // Notifications
            userId
                ? prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 })
                : Promise.resolve([]),
            // Friendships
            userId
                ? prisma.friendship.findMany({
                    where: { OR: [{ userId }, { friendId: userId }] },
                    include: {
                        user: { select: { id: true, name: true, phone: true, photo: true, location: true, sports: true, positions: true, ratings: true, trustScore: true, createdAt: true, privacy: true, gamesPlayed: true } },
                        friend: { select: { id: true, name: true, phone: true, photo: true, location: true, sports: true, positions: true, ratings: true, trustScore: true, createdAt: true, privacy: true, gamesPlayed: true } },
                    },
                    take: 500,
                })
                : Promise.resolve([]),
            // Friend tiers — isolated so a missing table doesn't crash the whole block
            userId
                ? prisma.friendTier.findMany({ where: { userId } }).catch(() => [])
                : Promise.resolve([]),
        ];

        const [games, notifications, friendships, friendTiers] = await Promise.all(queries);

        const serializedGames = games.map(g => ({
            ...g,
            rsvps: g.rsvps.map(r => ({
                playerId: r.playerId,
                status: r.status,
                position: r.position || '',
                paymentStatus: r.paymentStatus || 'not_required',
                player: r.player ? {
                    ...r.player,
                    positions: safeParse(r.player.positions, {}),
                    ratings: safeParse(r.player.ratings, {}),
                } : null,
            })),
        }));

        const formatFriend = (f) => {
            const raw = f.userId === userId ? f.friend : f.user;
            if (!raw) return null;
            return { ...parseUser(raw), friendshipStatus: f.status, isSender: f.userId === userId };
        };
        const accepted = friendships.filter(f => f.status === 'accepted');
        const pending  = friendships.filter(f => f.status === 'pending');

        return Response.json({
            games: serializedGames,
            notifications,
            friends: accepted.map(formatFriend).filter(Boolean),
            pendingRequests: pending.map(formatFriend).filter(Boolean),
            tiers: friendTiers,
        });
    } catch (prismaErr) {
        console.error('[init] Prisma error, falling back to Supabase:', prismaErr.message);
    }

    // --- Supabase fallback ---
    try {
        const supabase = getSupabase();
        if (!supabase) return Response.json({ error: 'Database unavailable' }, { status: 503 });

        const windowStart = new Date();
        windowStart.setDate(windowStart.getDate() - 7);

        const sbQueries = [
            supabase.from('saved_games').select('*').gte('game_date', windowStart.toISOString().split('T')[0]).order('game_date', { ascending: true }).limit(100),
            userId ? supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
            userId ? supabase.from('friendships').select('user_id, friend_id, status').or(`user_id.eq.${userId},friend_id.eq.${userId}`) : Promise.resolve({ data: [] }),
            userId ? supabase.from('friend_tiers').select('*').eq('user_id', userId) : Promise.resolve({ data: [] }),
        ];

        const [gResult, nResult, fResult, tResult] = await Promise.all(sbQueries);

        // Games
        const visibleGames = (gResult.data || []).filter(g =>
            g.visibility === 'public' || g.organizer_id === userId ||
            (g.visibility === 'friends' && friendIds.includes(g.organizer_id))
        );
        const gameIds = visibleGames.map(g => g.game_id);
        const [rsvpResult, orgResult] = await Promise.all([
            gameIds.length ? supabase.from('game_rsvps').select('*').in('game_id', gameIds) : Promise.resolve({ data: [] }),
            visibleGames.length ? supabase.from('users').select('id, name, photo').in('id', [...new Set(visibleGames.map(g => g.organizer_id))]) : Promise.resolve({ data: [] }),
        ]);
        const orgMap = {};
        (orgResult.data || []).forEach(u => { orgMap[u.id] = u; });
        const games = visibleGames.map(g => ({
            id: g.game_id, title: g.title, sport: g.sport, format: g.format || '',
            date: g.game_date, time: g.game_time, duration: g.duration || 90,
            location: g.location || '', address: g.address || '', lat: g.lat, lng: g.lng,
            maxPlayers: g.max_players || 10, skillLevel: g.skill_level || 'All Levels',
            status: g.status, visibility: g.visibility || 'public', approvalRequired: !!g.approval_required,
            price: g.price || 0, gender: g.gender || 'mixed', organizerId: g.organizer_id,
            organizer: orgMap[g.organizer_id] || { id: g.organizer_id, name: '', photo: null },
            rsvps: (rsvpResult.data || []).filter(r => r.game_id === g.game_id).map(r => ({
                playerId: r.player_id, status: r.status, position: r.position || '', player: null,
            })),
            createdAt: g.created_at,
        }));

        // Friends
        const rows = fResult.data || [];
        const friendUserIds = rows.map(r => String(r.user_id) === String(userId) ? r.friend_id : r.user_id);
        let friendUsers = [];
        if (friendUserIds.length) {
            const { data: fu } = await supabase.from('users').select('id, name, phone, photo, location, sports, positions, ratings, trust_score, privacy, games_played').in('id', friendUserIds);
            friendUsers = (fu || []).map(u => parseUser({ ...u, trustScore: u.trust_score, gamesPlayed: u.games_played }));
        }
        const tiers = (tResult.data || []).map(t => ({ friendId: t.friend_id, sport: t.sport, tier: t.tier }));

        return Response.json({
            games,
            notifications: (nResult.data || []),
            friends: friendUsers,
            pendingRequests: [],
            tiers,
        });
    } catch (sbErr) {
        console.error('[init] Supabase error:', sbErr.message);
        return Response.json({ error: sbErr.message }, { status: 500 });
    }
}
