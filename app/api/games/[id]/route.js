import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

export async function GET(req, props) {
    const params = await props.params;
    const gameId = params.id;
    
    try {
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: {
                organizer: { select: { id: true, name: true, photo: true } },
                rsvps: {
                    include: {
                        player: { select: { id: true, name: true, phone: true, photo: true, positions: true, ratings: true } }
                    }
                },
            }
        });

        if (!game) {
            // Try Supabase fallback
            const supabase = getSupabase();
            if (supabase) {
                const { data: g } = await supabase.from('saved_games').select('*').eq('game_id', gameId).single();
                if (g) {
                    const { data: rsvps } = await supabase.from('game_rsvps').select('*').eq('game_id', gameId);
                    const { data: org } = await supabase.from('users').select('id, name, photo').eq('id', g.organizer_id).single();
                    
                    const supaGame = {
                        id: g.game_id, title: g.title, sport: g.sport, format: g.format || '',
                        date: g.game_date, time: g.game_time, duration: g.duration || 90,
                        location: g.location || '', address: g.address || '', lat: g.lat, lng: g.lng,
                        maxPlayers: g.max_players || 10, skillLevel: g.skill_level || 'All Levels',
                        status: g.status, visibility: g.visibility || 'public', approvalRequired: false,
                        price: g.price || 0, gender: g.gender || 'mixed', amenities: '[]',
                        organizerId: g.organizer_id,
                        organizer: org || { id: g.organizer_id, name: '', photo: null },
                        rsvps: (rsvps || []).map(r => ({ playerId: r.player_id, status: r.status, position: r.position || '', player: null })),
                        createdAt: g.created_at,
                    };
                    return Response.json({ game: supaGame });
                }
            }
            return Response.json({ error: 'Game not found' }, { status: 404 });
        }

        const serialized = {
            ...game,
            rsvps: game.rsvps.map(r => ({
                playerId: r.playerId,
                status: r.status,
                position: r.position || '',
                player: r.player ? {
                    ...r.player,
                    positions: typeof r.player.positions === 'string' ? JSON.parse(r.player.positions || '{}') : (r.player.positions || {}),
                    ratings: typeof r.player.ratings === 'string' ? JSON.parse(r.player.ratings || '{}') : (r.player.ratings || {})
                } : null
            }))
        };

        return Response.json({ game: serialized });
    } catch (err) {
        console.error('GET /api/games/[id] error:', err);
        return Response.json({ error: 'Database error' }, { status: 500 });
    }
}
export async function DELETE(req, props) {
    const params = await props.params;
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        
        // Allow passing userId for API-only clients, but fallback to secure session
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId') || session.user?.dbId || session.user?.id;
        const gameId = params.id;

        if (!userId) {
            return Response.json({ error: 'Authentication required' }, { status: 401 });
        }

        // --- Try Prisma first ---
        try {
            const game = await prisma.game.findUnique({ where: { id: gameId } });
            if (!game) {
                // If not found in prisma, try supabase later
                throw new Error('Game not found in Prisma');
            }

            if (game.organizerId !== userId) {
                return Response.json({ error: 'Unauthorized to delete this game' }, { status: 403 });
            }

            // Prisma cascading delete deletes associated RSVPs automatically (if configured)
            // Or we delete them manually just to be safe
            await prisma.rsvp.deleteMany({ where: { gameId: gameId } }).catch(()=>null);
            await prisma.game.delete({ where: { id: gameId } });

        } catch (prismaErr) {
            console.error('DELETE /api/games/[id] Prisma error — falling back to Supabase:', prismaErr.message);
            
            // --- Supabase fallback ---
            const supabase = getSupabase();
            if (supabase) {
                // Verify ownership first
                const { data: gData } = await supabase
                    .from('saved_games')
                    .select('organizer_id')
                    .eq('game_id', gameId)
                    .single();
                
                if (!gData) {
                    return Response.json({ error: 'Game not found' }, { status: 404 });
                }
                
                if (gData.organizer_id !== userId) {
                    return Response.json({ error: 'Unauthorized to delete this game' }, { status: 403 });
                }

                // Delete RSVPs and Game (Supabase handles cascading if foreign keys are set, but let's be safe)
                await supabase.from('game_rsvps').delete().eq('game_id', gameId);
                const { error } = await supabase.from('saved_games').delete().eq('game_id', gameId);
                
                if (error) {
                    return Response.json({ error: error.message }, { status: 500 });
                }
                return Response.json({ success: true });
            } else {
                return Response.json({ error: 'Database unavailable' }, { status: 503 });
            }
        }

        // Also delete from Supabase fallback just in case it exists in both
        try {
            const supabase = getSupabase();
            if (supabase) {
                await supabase.from('game_rsvps').delete().eq('game_id', gameId);
                await supabase.from('saved_games').delete().eq('game_id', gameId);
            }
        } catch (_) {}

        return Response.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/games/[id] error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
