import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

export const dynamic = 'force-dynamic';

function parseScore(scoreStr) {
    try { return scoreStr ? JSON.parse(scoreStr) : null; } catch { return null; }
}

function getMyResult(score, myPlayerIds) {
    if (!score || score.team1 == null) return null;
    const onTeam1 = (score.team1PlayerIds || []).some(id => myPlayerIds.includes(id));
    const onTeam2 = (score.team2PlayerIds || []).some(id => myPlayerIds.includes(id));
    if (!onTeam1 && !onTeam2) return null;
    const t1 = score.team1, t2 = score.team2;
    const myTeam = onTeam1 ? 1 : 2;
    const myScore = onTeam1 ? t1 : t2;
    const oppScore = onTeam1 ? t2 : t1;
    const result = myScore > oppScore ? 'win' : myScore < oppScore ? 'loss' : 'draw';
    const iScored = onTeam1
        ? (score.team1Scorers || []).some(id => myPlayerIds.includes(id))
        : (score.team2Scorers || []).some(id => myPlayerIds.includes(id));
    return { result, myTeam, score: `${t1}–${t2}`, iScored };
}

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    const userId = searchParams.get('userId') || session.user?.dbId || session.user?.id;

    if (!userId) return Response.json({ error: 'Authentication required' }, { status: 401 });

    // Try Prisma first
    try {
        const games = await prisma.game.findMany({
            where: {
                OR: [
                    { organizerId: userId },
                    { rsvps: { some: { playerId: userId, status: { in: ['yes', 'checked_in'] } } } }
                ]
            },
            include: {
                organizer: { select: { id: true, name: true } },
                rsvps: {
                    where: { playerId: userId },
                    select: { status: true, position: true }
                }
            },
            orderBy: { date: 'desc' },
            take: 200,
        });

        const myIds = [userId];
        const mapped = games.map(g => {
            const score = parseScore(g.score);
            const matchData = score ? getMyResult(score, myIds) : null;
            const isOrganizer = g.organizerId === userId;
            const myRsvp = g.rsvps[0];
            return {
                game_id: g.id,
                title: g.title,
                sport: g.sport,
                format: g.format,
                game_date: g.date,
                game_time: g.time,
                location: g.location || '',
                status: g.status,
                max_players: g.maxPlayers,
                skill_level: g.skillLevel,
                organizer_id: g.organizerId,
                score: g.score || null,
                role: isOrganizer ? 'organizer' : 'player',
                my_rsvp_status: myRsvp?.status || null,
                match: matchData, // { result, myTeam, score, iScored } or null
                created_at: g.createdAt,
            };
        });

        const saved = mapped.filter(g => g.status === 'open');
        const history = mapped.filter(g => g.status !== 'open');
        return Response.json({ saved, history });
    } catch (prismaErr) {
        console.error('GET /api/games/history Prisma error:', prismaErr.message);
    }

    // Supabase fallback
    try {
        const supabase = getSupabase();
        if (!supabase) return Response.json({ error: 'Database unavailable' }, { status: 503 });

        // Fetch organized games
        const { data: organizedData, error: organizedError } = await supabase
            .from('Game')
            .select('*')
            .eq('organizerId', userId)
            .order('date', { ascending: false })
            .limit(100);

        // Fetch games where player RSVPed
        const { data: rsvpData, error: rsvpError } = await supabase
            .from('Rsvp')
            .select('gameId, status, position')
            .eq('playerId', userId)
            .in('status', ['yes', 'checked_in']);

        // If the fallback queries errored (real DB outage), surface a 503 rather than
        // masking the outage as empty history.
        if (organizedError || rsvpError) {
            console.error('GET /api/games/history Supabase query error:', (organizedError || rsvpError).message);
            return Response.json({ error: 'Database unavailable' }, { status: 503 });
        }

        const participatedIds = (rsvpData || [])
            .map(r => r.gameId)
            .filter(id => !(organizedData || []).some(g => g.id === id));

        let participatedGames = [];
        if (participatedIds.length > 0) {
            const { data } = await supabase
                .from('Game')
                .select('*')
                .in('id', participatedIds)
                .order('date', { ascending: false });
            participatedGames = data || [];
        }

        const allGames = [
            ...(organizedData || []).map(g => ({ ...g, role: 'organizer' })),
            ...participatedGames.map(g => ({
                ...g,
                role: 'player',
                my_rsvp_status: (rsvpData || []).find(r => r.gameId === g.id)?.status || null,
            })),
        ];

        const mapped = allGames.map(g => {
            const score = parseScore(g.score);
            const matchData = score ? getMyResult(score, [userId]) : null;
            return {
                game_id: g.id,
                title: g.title,
                sport: g.sport,
                format: g.format || '',
                game_date: g.date,
                game_time: g.time,
                location: g.location || '',
                status: g.status,
                max_players: g.maxPlayers || 10,
                skill_level: g.skillLevel || '',
                organizer_id: g.organizerId,
                score: g.score || null,
                role: g.role,
                my_rsvp_status: g.my_rsvp_status || null,
                match: matchData,
                created_at: g.createdAt,
            };
        });

        const saved = mapped.filter(g => g.status === 'open');
        const history = mapped.filter(g => g.status !== 'open');
        return Response.json({ saved, history });
    } catch (err) {
        console.error('GET /api/games/history Supabase error:', err.message);
        return Response.json({ error: 'Database unavailable' }, { status: 503 });
    }
}
