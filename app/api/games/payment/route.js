import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

// POST: player marks payment as done, OR organizer approves it
export async function POST(req) {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        const sessionUserId = session.user?.dbId || session.user?.id;
        if (!sessionUserId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { gameId, playerId, action } = await req.json();
        // action: 'mark_paid' (player) | 'approve' | 'reject' (organizer)
        if (!gameId || !playerId || !action) {
            return Response.json({ error: 'gameId, playerId, action required' }, { status: 400 });
        }

        const game = await prisma.game.findUnique({
            where: { id: gameId },
            select: { organizerId: true, title: true, price: true },
        });
        if (!game) return Response.json({ error: 'Game not found' }, { status: 404 });

        const isSelf = sessionUserId === playerId;
        const isOrganizer = sessionUserId === game.organizerId;

        if (action === 'mark_paid') {
            if (!isSelf) return Response.json({ error: 'Forbidden' }, { status: 403 });
            await prisma.rsvp.update({
                where: { gameId_playerId: { gameId, playerId } },
                data: { paymentStatus: 'pending' },
            });
            // Notify the organizer
            try {
                await prisma.notification.create({
                    data: {
                        userId: game.organizerId,
                        gameId,
                        title: '💰 Payment Marked',
                        message: `A player says they've paid ₹${game.price} for "${game.title}". Tap to approve.`,
                        action: `?game=${gameId}`,
                    },
                });
            } catch (_) {}
            return Response.json({ success: true, paymentStatus: 'pending' });
        }

        if (action === 'approve' || action === 'reject') {
            if (!isOrganizer) return Response.json({ error: 'Only organizer can approve payments' }, { status: 403 });
            const newStatus = action === 'approve' ? 'approved' : 'not_required';
            await prisma.rsvp.update({
                where: { gameId_playerId: { gameId, playerId } },
                data: { paymentStatus: newStatus },
            });
            // Notify the player
            if (action === 'approve') {
                try {
                    await prisma.notification.create({
                        data: {
                            userId: playerId,
                            gameId,
                            title: '✅ Payment Confirmed',
                            message: `Your payment of ₹${game.price} for "${game.title}" has been confirmed by the organizer.`,
                            action: `?game=${gameId}`,
                        },
                    });
                } catch (_) {}
            }
            return Response.json({ success: true, paymentStatus: newStatus });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });
    } catch (err) {
        console.error('[PAYMENT ERROR]', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
