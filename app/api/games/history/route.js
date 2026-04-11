import { getSupabase } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

// Returns true once 24 hours have elapsed since the game's scheduled start.
function isHistory(game_date, game_time) {
    const start = new Date(`${game_date}T${game_time || '00:00'}`);
    return Date.now() > start.getTime() + 24 * 60 * 60 * 1000;
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
        let saved = [];   // visible from creation until 24h after game start
        let history = []; // 24h+ after game start

        if (supabase) {
            const { data, error } = await supabase
                .from('saved_games')
                .select('*')
                .eq('organizer_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Supabase saved_games fetch error:', error.message);
            } else if (data) {
                // Auto-complete rows that have passed the 24h mark
                const toComplete = data.filter(
                    g => g.status === 'open' && isHistory(g.game_date, g.game_time)
                );
                if (toComplete.length > 0) {
                    await supabase
                        .from('saved_games')
                        .update({ status: 'completed' })
                        .in('game_id', toComplete.map(g => g.game_id));
                }

                // Merge the updated status into the in-memory rows
                const rows = data.map(g => ({
                    ...g,
                    status: toComplete.find(t => t.game_id === g.game_id) ? 'completed' : g.status,
                }));

                saved   = rows.filter(g => g.status === 'open');
                history = rows.filter(g => g.status === 'completed');
            }
        } else {
            // Fallback: use Prisma when Supabase is not configured
            const games = await prisma.game.findMany({
                where: { organizerId: userId },
                select: {
                    id: true, title: true, sport: true, format: true,
                    date: true, time: true, duration: true, location: true,
                    address: true, maxPlayers: true, skillLevel: true,
                    status: true, visibility: true, price: true, gender: true,
                    organizerId: true, createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
                take: 200, // cap at 200 most recent games
            });

            const mapped = games.map(g => ({
                game_id:      g.id,
                organizer_id: g.organizerId,
                title:        g.title,
                sport:        g.sport,
                format:       g.format,
                game_date:    g.date,
                game_time:    g.time,
                duration:     g.duration,
                location:     g.location,
                address:      g.address,
                max_players:  g.maxPlayers,
                skill_level:  g.skillLevel,
                status:       isHistory(g.date, g.time) ? 'completed' : 'open',
                visibility:   g.visibility,
                price:        g.price,
                gender:       g.gender,
                created_at:   g.createdAt,
                rsvps:        [],
            }));

            saved   = mapped.filter(g => g.status === 'open');
            history = mapped.filter(g => g.status === 'completed');
        }

        return Response.json({ saved, history });
    } catch (err) {
        console.error('GET /api/games/history error:', err);
        return Response.json({ saved: [], history: [] });
    }
}
