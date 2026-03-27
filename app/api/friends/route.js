import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/session';

function parseUser(u) {
    if (!u) return null;
    const sports = (() => {
        if (Array.isArray(u.sports)) return u.sports;
        try { const p = JSON.parse(u.sports || '[]'); return Array.isArray(p) ? p : (p ? [p] : []); } catch { return []; }
    })();
    return {
        ...u,
        sports,
        positions: (() => { try { return typeof u.positions === 'object' ? u.positions : JSON.parse(u.positions || '{}'); } catch { return {}; } })(),
        ratings: (() => { try { return typeof u.ratings === 'object' ? u.ratings : JSON.parse(u.ratings || '{}'); } catch { return {}; } })(),
        thoughts: (u.thoughtsReceived || []).map(t => ({
            from: t.fromId,
            fromName: t.from?.name,
            text: t.text,
            date: t.date ? (t.date instanceof Date ? t.date.toISOString().split('T')[0] : String(t.date).split('T')[0]) : '',
        })),
    };
}

export async function GET(req) {
    try {
        const session = await getSession(req);
        if (!session.user) return Response.json({ friends: [] });

        // --- Try Prisma ---
        try {
            const friendships = await prisma.friendship.findMany({
                where: {
                    OR: [
                        { userId: session.user.dbId },
                        { friendId: session.user.dbId }
                    ]
                },
                include: {
                    user: {
                        select: {
                            id: true, name: true, phone: true, photo: true, location: true,
                            sports: true, positions: true, ratings: true, trustScore: true,
                            thoughtsReceived: {
                                include: { from: { select: { name: true } } },
                                orderBy: { date: 'desc' },
                                take: 10
                            }
                        }
                    },
                    friend: {
                        select: {
                            id: true, name: true, phone: true, photo: true, location: true,
                            sports: true, positions: true, ratings: true, trustScore: true,
                            thoughtsReceived: {
                                include: { from: { select: { name: true } } },
                                orderBy: { date: 'desc' },
                                take: 10
                            }
                        }
                    }
                }
            });

            const friendTiers = await prisma.friendTier.findMany({
                where: { userId: session.user.dbId }
            });

            const friends = friendships.map(f => {
                const raw = f.userId === session.user.dbId ? f.friend : f.user;
                return parseUser(raw);
            }).filter(Boolean);

            return Response.json({ friends, tiers: friendTiers });
        } catch (prismaErr) {
            console.error('[friends GET] Prisma error, falling back to Supabase:', prismaErr.message);
        }

        // --- Supabase fallback ---
        try {
            const supabase = getSupabase();
            if (supabase) {
                const uid = session.user.dbId || session.user.id;
                const { data: rows } = await supabase
                    .from('friendships')
                    .select('user_id, friend_id')
                    .or(`user_id.eq.${uid},friend_id.eq.${uid}`);

                if (rows?.length) {
                    const friendIds = rows.map(r => String(r.user_id) === String(uid) ? r.friend_id : r.user_id);
                    const { data: users } = await supabase.from('users').select('*').in('id', friendIds);
                    const friends = (users || []).map(u => parseUser({ ...u, thoughtsReceived: [] }));
                    return Response.json({ friends, tiers: [] });
                }
            }
        } catch (sbErr) {
            console.error('[friends GET] Supabase fallback error:', sbErr.message);
        }

        return Response.json({ friends: [], tiers: [] });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const session = await getSession(req);
        if (!session.user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

        const { friendId, action, phone, name } = await req.json();

        if (action === 'add') {
            let finalFriendId = friendId;

            if (phone && name) {
                // Shadow user — try Prisma first
                try {
                    const shadow = await prisma.user.upsert({
                        where: { phone },
                        update: {},
                        create: { name, phone, email: `offline_${Date.now()}@sportsvault.app`, privacy: 'private' }
                    });
                    finalFriendId = shadow.id;
                } catch (_) {
                    const supabase = getSupabase();
                    if (supabase) {
                        const { data } = await supabase.from('users').upsert(
                            { phone, name, email: `offline_${Date.now()}@sportsvault.app`, privacy: 'private' },
                            { onConflict: 'phone', ignoreDuplicates: false }
                        ).select('id').single();
                        finalFriendId = data?.id;
                    }
                }
            }

            if (!finalFriendId) return Response.json({ error: 'Friend ID or data required' }, { status: 400 });

            try {
                const friendship = await prisma.friendship.upsert({
                    where: { userId_friendId: { userId: session.user.dbId, friendId: finalFriendId } },
                    update: { status: 'accepted' },
                    create: { userId: session.user.dbId, friendId: finalFriendId, status: 'accepted' }
                });
                return Response.json({ success: true, friendship });
            } catch (_) {
                const supabase = getSupabase();
                if (supabase) {
                    await supabase.from('friendships').upsert(
                        { user_id: session.user.dbId, friend_id: finalFriendId, status: 'accepted' },
                        { onConflict: 'user_id,friend_id' }
                    );
                    return Response.json({ success: true, friendship: { friendId: finalFriendId } });
                }
            }
        }

        if (action === 'remove') {
            try {
                await prisma.friendship.deleteMany({
                    where: {
                        OR: [
                            { userId: session.user.dbId, friendId },
                            { userId: friendId, friendId: session.user.dbId }
                        ]
                    }
                });
            } catch (_) {
                const supabase = getSupabase();
                if (supabase) {
                    const uid = session.user.dbId;
                    await supabase.from('friendships').delete()
                        .or(`and(user_id.eq.${uid},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${uid})`);
                }
            }
            return Response.json({ success: true });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
