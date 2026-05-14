import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';
import { listLocalFriendships, upsertLocalFriendship, deleteLocalFriendship } from '@/lib/localFriendStore';
import { upsertLocalUser } from '@/lib/localUserStore';

function safeParse(val, fallback) {
    if (val == null) return fallback;
    if (typeof val !== 'string') return val ?? fallback;
    try { return JSON.parse(val) ?? fallback; } catch { return fallback; }
}

function parseUser(u) {
    if (!u) return null;
    return {
        ...u,
        id: u.id,
        createdAt: u.createdAt || u.created_at,
        trustScore: u.trustScore ?? u.trust_score ?? 50,
        gamesPlayed: u.gamesPlayed ?? u.games_played ?? 0,
        sports:    safeParse(u.sports, []),
        positions: safeParse(u.positions, {}),
        ratings:   safeParse(u.ratings, {}),
        thoughts: [], // loaded on demand when viewing a profile
    };
}

function normalizeFriendPair(userId, friendId) {
    return {
        firstId: String(userId) <= String(friendId) ? userId : friendId,
        secondId: String(userId) <= String(friendId) ? friendId : userId,
    };
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        const userId = session.user?.dbId || session.user?.id;
        if (!userId) return Response.json({ friends: [], pendingRequests: [], tiers: [] });

        // --- Try Prisma ---
        try {
            const [friendships, friendTiers] = await Promise.all([
                prisma.friendship.findMany({
                    where: { OR: [{ userId }, { friendId: userId }] },
                    include: {
                        user: {
                            select: {
                                id: true, name: true, phone: true, photo: true,
                                location: true, sports: true, positions: true,
                                ratings: true, trustScore: true, createdAt: true,
                                privacy: true, gamesPlayed: true,
                            }
                        },
                        friend: {
                            select: {
                                id: true, name: true, phone: true, photo: true,
                                location: true, sports: true, positions: true,
                                ratings: true, trustScore: true, createdAt: true,
                                privacy: true, gamesPlayed: true,
                            }
                        }
                    },
                    take: 500,
                }),
                prisma.friendTier.findMany({ where: { userId } })
            ]);

            const formatFriend = (f) => {
                const raw = f.userId === userId ? f.friend : f.user;
                if (!raw) return null;
                return { ...parseUser(raw), friendshipStatus: f.status, isSender: f.userId === userId };
            };

            const accepted = friendships.filter(f => f.status === 'accepted');
            const pending  = friendships.filter(f => f.status === 'pending');

            return Response.json({
                friends: accepted.map(formatFriend).filter(Boolean),
                pendingRequests: pending.map(formatFriend).filter(Boolean),
                tiers: friendTiers,
            });
        } catch (prismaErr) {
            console.error('[friends GET] Prisma error, falling back to Supabase:', prismaErr.message);
        }

        // --- Supabase fallback ---
        try {
            const supabase = getSupabase();
            if (supabase) {
                const { data: rows } = await supabase
                    .from('friendships')
                    .select('user_id, friend_id, status, created_at')
                    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
                if (rows?.length) {
                    const friendIds = [...new Set(rows.map(r => String(r.user_id) === String(userId) ? r.friend_id : r.user_id))];
                    const { data: users } = await supabase.from('users').select('*').in('id', friendIds);
                    const usersById = new Map((users || []).map(u => [String(u.id), parseUser(u)]));
                    const formatFriend = (row) => {
                        const otherId = String(row.user_id) === String(userId) ? row.friend_id : row.user_id;
                        const user = usersById.get(String(otherId));
                        if (!user) return null;
                        return {
                            ...user,
                            friendshipStatus: row.status || 'accepted',
                            isSender: String(row.user_id) === String(userId),
                        };
                    };
                    const accepted = rows.filter(r => (r.status || 'accepted') === 'accepted');
                    const pending = rows.filter(r => r.status === 'pending');
                    return Response.json({
                        friends: accepted.map(formatFriend).filter(Boolean),
                        pendingRequests: pending.map(formatFriend).filter(Boolean),
                        tiers: [],
                    });
                }
            }
        } catch (sbErr) {
            console.error('[friends GET] Supabase fallback error:', sbErr.message);
        }

        const local = await listLocalFriendships(userId);
        return Response.json({ ...local, tiers: [] });
    } catch (err) {
        console.error('GET /api/friends error:', err.message);
        return Response.json({ friends: [], error: err.message }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        const userId = session.user?.dbId || session.user?.id;
        if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

        const { friendId, action, phone, name } = await req.json();

        if (action === 'add') {
            let finalFriendId = friendId;

            if (phone && name && !friendId) {
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
                        const { data } = await supabase
                            .from('users')
                            .upsert({ phone, name, email: `offline_${Date.now()}@sportsvault.app`, privacy: 'private' }, { onConflict: 'phone' })
                            .select('id').single();
                        finalFriendId = data?.id;
                    } else {
                        const user = await upsertLocalUser({
                            name,
                            phone,
                            email: `offline_${Date.now()}@sportsvault.app`,
                            privacy: 'private',
                        });
                        finalFriendId = user.id;
                    }
                }
            }

            if (!finalFriendId) return Response.json({ error: 'Friend ID or contact details required' }, { status: 400 });

            let friendship;
            try {
                const existing = await prisma.friendship.findFirst({
                    where: {
                        OR: [
                            { userId, friendId: finalFriendId },
                            { userId: finalFriendId, friendId: userId },
                        ],
                    },
                });

                friendship = existing
                    ? await prisma.friendship.update({ where: { id: existing.id }, data: { status: 'accepted' } })
                    : await prisma.friendship.create({ data: { userId, friendId: finalFriendId, status: 'accepted' } });
            } catch (prismaErr) {
                const supabase = getSupabase();
                if (!supabase) {
                    friendship = await upsertLocalFriendship(userId, finalFriendId, 'accepted');
                } else {
                    const { firstId, secondId } = normalizeFriendPair(userId, finalFriendId);
                    const { data, error } = await supabase
                        .from('friendships')
                        .upsert(
                            { user_id: firstId, friend_id: secondId, status: 'accepted' },
                            { onConflict: 'user_id,friend_id' }
                        )
                        .select()
                        .single();
                    if (error) throw error;
                    friendship = data;
                }
            }

            try {
                await prisma.notification.create({
                    data: {
                        userId: finalFriendId,
                        title: 'New Friend',
                        message: `${session.user?.name || 'Someone'} added you as a friend on SportsVault!`
                    }
                });
            } catch (_) { /* notification optional */ }

            return Response.json({ success: true, friendship, friendId: finalFriendId });
        }

        if (action === 'remove') {
            try {
                await prisma.friendship.deleteMany({
                    where: {
                        OR: [
                            { userId, friendId },
                            { userId: friendId, friendId: userId }
                        ]
                    }
                });
            } catch (prismaErr) {
                const supabase = getSupabase();
                if (!supabase) {
                    await deleteLocalFriendship(userId, friendId);
                } else {
                    await supabase
                        .from('friendships')
                        .delete()
                        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);
                }
            }
            return Response.json({ success: true });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });
    } catch (err) {
        console.error('POST /api/friends error:', err.message);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
