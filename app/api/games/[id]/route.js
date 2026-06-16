import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

export async function GET(req, props) {
    const params = await props.params;
    const gameId = params.id;
    
    try {
        // Auto-migrate new columns (safe — IF NOT EXISTS)
        try {
            await prisma.$executeRawUnsafe(`ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "upiId" TEXT`);
            await prisma.$executeRawUnsafe(`ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "score" TEXT`);
            await prisma.$executeRawUnsafe(`ALTER TABLE "Rsvp" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT DEFAULT 'not_required'`);
        } catch (_) { /* non-fatal */ }

        let game = null;
        let prismaError = false;

        try {
            game = await prisma.game.findUnique({
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
        } catch (e) {
            console.error('Prisma fetch failed, falling back:', e.message);
            prismaError = true;
        }

        if (!game || prismaError) {
            // Try Supabase fallback
            const supabase = getSupabase();
            if (supabase) {
                const { data: g } = await supabase.from('Game').select('*').eq('id', gameId).single();
                if (g) {
                    const { data: rsvps } = await supabase.from('Rsvp').select('*').eq('gameId', gameId);
                    const playerIds = [...new Set((rsvps || []).map(r => r.playerId))];
                    const [{ data: org }, { data: players }] = await Promise.all([
                        supabase.from('User').select('id, name, photo').eq('id', g.organizerId).single(),
                        playerIds.length
                            ? supabase.from('User').select('id, name, phone, photo, positions, ratings').in('id', playerIds)
                            : Promise.resolve({ data: [] }),
                    ]);
                    const playerMap = {};
                    (players || []).forEach(p => { playerMap[p.id] = p; });
                    
                    const supaGame = {
                        id: g.id, title: g.title, sport: g.sport, format: g.format || '',
                        date: g.date, time: g.time, duration: g.duration || 90,
                        location: g.location || '', address: g.address || '', lat: g.lat, lng: g.lng,
                        maxPlayers: g.maxPlayers || 10, skillLevel: g.skillLevel || 'All Levels',
                        status: g.status, visibility: g.visibility || 'public', approvalRequired: !!g.approvalRequired,
                        price: g.price || 0, gender: g.gender || 'mixed', amenities: g.amenities || '[]',
                        score: g.score || null,
                        organizerId: g.organizerId,
                        organizer: org || { id: g.organizerId, name: '', photo: null },
                        rsvps: (rsvps || []).map(r => {
                            const player = playerMap[r.playerId];
                            return {
                                playerId: r.playerId,
                                status: r.status,
                                position: r.position || '',
                                paymentStatus: r.paymentStatus || 'not_required',
                                player: player ? {
                                    ...player,
                                    positions: typeof player.positions === 'string' ? JSON.parse(player.positions || '{}') : (player.positions || {}),
                                    ratings: typeof player.ratings === 'string' ? JSON.parse(player.ratings || '{}') : (player.ratings || {}),
                                } : null,
                            };
                        }),
                        createdAt: g.createdAt,
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
                paymentStatus: r.paymentStatus || 'not_required',
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
                    .from('Game')
                    .select('organizerId')
                    .eq('id', gameId)
                    .single();
                
                if (!gData) {
                    return Response.json({ error: 'Game not found' }, { status: 404 });
                }
                
                if (gData.organizerId !== userId) {
                    return Response.json({ error: 'Unauthorized to delete this game' }, { status: 403 });
                }

                // Delete RSVPs and Game (Supabase handles cascading if foreign keys are set, but let's be safe)
                await supabase.from('Rsvp').delete().eq('gameId', gameId);
                const { error } = await supabase.from('Game').delete().eq('id', gameId);
                
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
                await supabase.from('Rsvp').delete().eq('gameId', gameId);
                await supabase.from('Game').delete().eq('id', gameId);
            }
        } catch (_) {}

        return Response.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/games/[id] error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
