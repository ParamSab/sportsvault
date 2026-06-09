import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

export async function DELETE(req) {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        const userId = session.user?.dbId || session.user?.id;
        if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // Delete all user data: RSVPs, notifications, thoughts, games organised, then the user row.
        // Best-effort: continue even if one table is absent.
        const deleteFromPrisma = async () => {
            try { await prisma.notification.deleteMany({ where: { userId } }); } catch (_) {}
            try { await prisma.thought.deleteMany({ where: { senderId: userId } }); } catch (_) {}
            try { await prisma.rsvp.deleteMany({ where: { userId } }); } catch (_) {}
            // Games they organised: detach organiser so games stay visible for other RSVPs.
            try {
                await prisma.game.updateMany({ where: { organiserId: userId }, data: { organiserId: null } });
            } catch (_) {}
            await prisma.user.delete({ where: { id: userId } });
        };

        let deleted = false;
        try {
            await deleteFromPrisma();
            deleted = true;
        } catch (prismaErr) {
            console.error('[DELETE ACCOUNT] Prisma error — trying Supabase:', prismaErr.message);
        }

        if (!deleted) {
            const supabase = getSupabase();
            if (!supabase) return Response.json({ error: 'No database available' }, { status: 503 });
            await supabase.from('notifications').delete().eq('user_id', userId);
            await supabase.from('rsvps').delete().eq('user_id', userId);
            await supabase.from('users').delete().eq('id', userId);
        }

        // Destroy the session cookie
        session.destroy();

        return Response.json({ success: true });
    } catch (err) {
        console.error('[DELETE ACCOUNT ERROR]', err);
        return Response.json({ error: err.message || 'Failed to delete account' }, { status: 500 });
    }
}
