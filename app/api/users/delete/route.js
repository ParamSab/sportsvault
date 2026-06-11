import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

export async function DELETE() {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        const userId = session.user?.dbId || session.user?.id;
        if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        let deleted = false;
        try {
            // Relations WITHOUT onDelete: Cascade must be removed first, or the
            // final user.delete() fails on a foreign-key constraint. Both directions
            // of each relation are cleared. Cascade relations (Game→Organizer,
            // Rsvp→player, Notification→user, FriendTier→owner) are removed
            // automatically when the user row is deleted.
            await prisma.$transaction([
                prisma.thought.deleteMany({ where: { OR: [{ fromId: userId }, { toId: userId }] } }),
                prisma.friend.deleteMany({ where: { OR: [{ userId }, { friendUserId: userId }] } }),
                prisma.friendInvite.deleteMany({ where: { OR: [{ senderId: userId }, { friendId: userId }] } }),
                prisma.friendship.deleteMany({ where: { OR: [{ userId }, { friendId: userId }] } }),
                prisma.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } }),
                prisma.report.deleteMany({ where: { reporterId: userId } }),
                prisma.user.delete({ where: { id: userId } }),
            ]);
            deleted = true;
        } catch (prismaErr) {
            console.error('[DELETE ACCOUNT] Prisma error — trying Supabase:', prismaErr.message);
        }

        if (!deleted) {
            const supabase = getSupabase();
            if (!supabase) return Response.json({ error: 'No database available' }, { status: 503 });
            // Best-effort: clear dependent rows, then the user. Ignore per-table errors.
            await supabase.from('thoughts').delete().or(`fromId.eq.${userId},toId.eq.${userId}`);
            await supabase.from('friends').delete().or(`userId.eq.${userId},friendUserId.eq.${userId}`);
            await supabase.from('friend_invites').delete().or(`senderId.eq.${userId},friendId.eq.${userId}`);
            await supabase.from('friendships').delete().or(`userId.eq.${userId},friendId.eq.${userId}`);
            await supabase.from('rsvps').delete().eq('playerId', userId);
            await supabase.from('notifications').delete().eq('userId', userId);
            await supabase.from('games').delete().eq('organizerId', userId);
            const { error: userErr } = await supabase.from('users').delete().eq('id', userId);
            if (userErr) return Response.json({ error: userErr.message }, { status: 500 });
        }

        // Clear the session cookie so the client is fully logged out.
        session.destroy();

        return Response.json({ success: true });
    } catch (err) {
        console.error('[DELETE ACCOUNT ERROR]', err);
        return Response.json({ error: err.message || 'Failed to delete account' }, { status: 500 });
    }
}
