import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

export async function POST(req) {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    const userId = session.user?.dbId || session.user?.id;
    if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { friendId, sport, tier } = await req.json();
    if (!friendId || !sport) return Response.json({ error: 'Missing friendId or sport' }, { status: 400 });
    if (tier !== null && ![1, 2, 3].includes(Number(tier))) return Response.json({ error: 'Tier must be 1, 2, or 3' }, { status: 400 });

    // Auto-create FriendTier table if it doesn't exist yet
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "FriendTier" (
                "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
                "userId" TEXT NOT NULL,
                "friendId" TEXT NOT NULL,
                "sport" TEXT NOT NULL,
                "tier" INTEGER NOT NULL,
                CONSTRAINT "FriendTier_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "FriendTier_userId_friendId_sport_key" UNIQUE ("userId", "friendId", "sport")
            )
        `);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FriendTier_userId_idx" ON "FriendTier"("userId")`);
    } catch (_) { /* non-fatal — table probably already exists */ }

    // --- Try Prisma first ---
    try {
        if (tier === null) {
            await prisma.friendTier.deleteMany({ where: { userId, friendId, sport } });
        } else {
            await prisma.friendTier.upsert({
                where: { userId_friendId_sport: { userId, friendId, sport } },
                update: { tier: Number(tier) },
                create: { userId, friendId, sport, tier: Number(tier) },
            });
        }
        return Response.json({ success: true });
    } catch (prismaErr) {
        console.error('POST /api/friends/tier Prisma error — falling back to Supabase:', prismaErr.message);
    }

    // --- Supabase fallback ---
    try {
        const supabase = getSupabase();
        if (!supabase) return Response.json({ error: 'Database unavailable' }, { status: 503 });

        if (tier === null) {
            await supabase.from('friend_tiers')
                .delete()
                .match({ user_id: userId, friend_id: friendId, sport });
        } else {
            await supabase.from('friend_tiers')
                .upsert({ user_id: userId, friend_id: friendId, sport, tier: Number(tier) },
                    { onConflict: 'user_id,friend_id,sport' });
        }
        return Response.json({ success: true });
    } catch (supaErr) {
        console.error('POST /api/friends/tier Supabase error:', supaErr.message);
        return Response.json({ error: supaErr.message }, { status: 500 });
    }
}
