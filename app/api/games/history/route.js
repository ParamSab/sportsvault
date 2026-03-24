import { getSupabase } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

// A game enters "history" 24 hours after its scheduled start time.
function isHistory(game_date, game_time) {
    const startISO = `${game_date}T${game_time || '00:00'}`;
    const start = new Date(startISO);
    const historyAt = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return Date.now() > historyAt.getTime();
}

export async function GET(req) {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId') || session.user?.dbId || session.user?.id;

        if (!userId) {
            return Response.json({ error: 'Authentication required' }, { status: 401 });
        }

        const supabase = getSupabase();

        let historyGames = [];

        if (supabase) {
            // Fetch from Supabase saved_games
            const { data, error } = await supabase
                .from('saved_games')
                .select('*')
                .eq('organizer_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Supabase history fetch error:', error.message);
            } else if (data) {
                // Mark status as 'completed' in Supabase for games past 24h
                const toComplete = data.filter(
                    g => g.status === 'open' && isHistory(g.game_date, g.game_time)
                );
                if (toComplete.length > 0) {
                    const ids = toComplete.map(g => g.game_id);
                    await supabase
                        .from('saved_games')
                        .update({ status: 'completed' })
                        .in('game_id', ids);
                }

                // Return only games that are now history (24h elapsed)
                historyGames = data
                    .map(g => ({
                        ...g,
                        status: toComplete.find(t => t.game_id === g.game_id) ? 'completed' : g.status,
                    }))
                    .filter(g => g.status === 'completed' || isHistory(g.game_date, g.game_time));
            }
        } else {
            // Fallback: query Prisma for completed games organised by this user
            const games = await prisma.game.findMany({
                where: { organizerId: userId },
                include: {
                    organizer: { select: { id: true, name: true, photo: true } },
                    rsvps: {
                        include: {
                            player: { select: { id: true, name: true, photo: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
            });

            // Auto-expire and return games past 24h
            historyGames = games
                .map(g => {
                    const gameStart = new Date(`${g.date}T${g.time || '00:00'}`);
                    const historyAt = new Date(gameStart.getTime() + 24 * 60 * 60 * 1000);
                    const pastHistory = Date.now() > historyAt.getTime();
                    return {
                        game_id:     g.id,
                        organizer_id: g.organizerId,
                        title:       g.title,
                        sport:       g.sport,
                        format:      g.format,
                        game_date:   g.date,
                        game_time:   g.time,
                        duration:    g.duration,
                        location:    g.location,
                        address:     g.address,
                        max_players: g.maxPlayers,
                        skill_level: g.skillLevel,
                        status:      pastHistory ? 'completed' : g.status,
                        visibility:  g.visibility,
                        price:       g.price,
                        gender:      g.gender,
                        created_at:  g.createdAt,
                        rsvps:       g.rsvps.map(r => ({
                            playerId: r.playerId,
                            status:   r.status,
                            player:   r.player,
                        })),
                    };
                })
                .filter(g => g.status === 'completed');
        }

        return Response.json({ history: historyGames });
    } catch (err) {
        console.error('GET /api/games/history error:', err);
        return Response.json({ history: [] });
    }
}
