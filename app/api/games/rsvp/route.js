import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

export async function POST(req) {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    const sessionUserId = session.user?.dbId || session.user?.id;

    if (!sessionUserId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { gameId, status, position } = body;
    const playerId = body.playerId || sessionUserId;

    if (!gameId || !playerId) return Response.json({ error: 'Missing required fields' }, { status: 400 });

    // Verify authorization: Player themselves or the Game Organizer
    const game = await prisma.game.findUnique({
        where: { id: gameId },
        select: { organizerId: true, title: true, approvalRequired: true }
    });

    if (!game) return Response.json({ error: 'Game not found' }, { status: 404 });

    const isSelf = sessionUserId === playerId;
    const isOrganizer = sessionUserId === game.organizerId;

    if (!isSelf && !isOrganizer) {
        return Response.json({ error: 'Forbidden: You cannot RSVP for others' }, { status: 403 });
    }

    // Server-side enforcement: if the game requires approval and the player
    // is RSVPing 'yes' themselves (not the organizer approving), force 'pending'.
    let finalStatus = status;
    if (finalStatus === 'yes' && game.approvalRequired && isSelf && !isOrganizer) {
        finalStatus = 'pending';
    }

    // --- Try Prisma first ---
    try {
        const rsvp = await prisma.rsvp.upsert({
            where: { gameId_playerId: { gameId, playerId } },
            update: { status: finalStatus, position: position || null },
            create: { gameId, playerId, status: finalStatus, position: position || null },
        });

        // Create notification for organizer if it's a pending request
        if (finalStatus === 'pending') {
            try {
                const player = await prisma.user.findUnique({
                    where: { id: playerId },
                    select: { name: true }
                });

                if (game && player) {
                    await prisma.notification.create({
                        data: {
                            userId: game.organizerId,
                            title: 'New Join Request',
                            message: `${player.name} requested to join "${game.title}"`,
                            gameId: gameId,
                            action: `/?game=${gameId}`
                        }
                    });
                }
            } catch (notifyErr) {
                console.error('Notification creation error:', notifyErr.message);
            }
        }

        // Create notification for player if they are accepted by organizer
        if (finalStatus === 'yes' && isOrganizer && !isSelf) {
            try {
                await prisma.notification.create({
                    data: {
                        userId: playerId,
                        title: 'Game Confirmed! 🎉',
                        message: `Organizer accepted your request for "${game.title}". You're in!`,
                        gameId: gameId,
                        action: `/?game=${gameId}`
                    }
                });
            } catch (notifyErr) {
                console.error('Admission notification error:', notifyErr.message);
            }
        }

        return Response.json({ rsvp });
    } catch (prismaErr) {
        console.error('RSVP Prisma error — falling back to Supabase:', prismaErr.message);
    }

    // --- Supabase fallback ---
    try {
        const supabase = getSupabase();
        if (!supabase) return Response.json({ error: 'Database unavailable' }, { status: 503 });

        const { data, error } = await supabase
            .from('game_rsvps')
            .upsert({ game_id: gameId, player_id: playerId, status, position: position || null },
                { onConflict: 'game_id,player_id' })
            .select()
            .single();

        if (error) return Response.json({ error: error.message }, { status: 500 });
        
        // Notification fallback for Supabase if needed (omitted for brevity unless Prisma fails completely)
        // Usually Prisma is the primary for these complex relations.
        
        return Response.json({ rsvp: data });
    } catch (supaErr) {
        console.error('RSVP Supabase fallback error:', supaErr.message);
        return Response.json({ error: supaErr.message }, { status: 500 });
    }
}
