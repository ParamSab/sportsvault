import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

export async function DELETE(req, { params }) {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        
        // Some robust checking for params
        let idParam = params.id;
        // next.js 15+ sometimes requires awaiting params if they are asynchronous
        if (params instanceof Promise) {
            const resolved = await params;
            idParam = resolved.id;
        }

        const gameId = idParam;
        
        // Allow passing userId for API-only clients, but fallback to secure session
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId') || session.user?.dbId || session.user?.id;

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
