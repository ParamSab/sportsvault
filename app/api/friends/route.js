import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

function safeParse(val, fallback) {
    if (val == null) return fallback;
    if (typeof val !== 'string') return val ?? fallback;
    try { return JSON.parse(val) ?? fallback; } catch { return fallback; }
}

function parseUser(u) {
    if (!u) return null;
    return {
        ...u,
        sports:    safeParse(u.sports, []),
        positions: safeParse(u.positions, {}),
        ratings:   safeParse(u.ratings, {}),
        thoughts: [], // loaded on demand when viewing a profile
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
        let sbOutage = false;
        try {
            const supabase = getSupabase();
            if (supabase) {
                const { data: rows, error: rowsError } = await supabase
                    .from('Friendship')
                    .select('userId, friendId, status')
                    .or(`userId.eq.${userId},friendId.eq.${userId}`);

                if (rowsError) throw rowsError;

                if (rows?.length) {
                    const friendIds = [...new Set(rows.map(r => String(r.userId) === String(userId) ? r.friendId : r.userId).filter(Boolean))];
                    const [{ data: users, error: usersError }, { data: tierRows, error: tiersError }] = await Promise.all([
                        supabase.from('User').select('*').in('id', friendIds),
                        supabase.from('FriendTier').select('friendId, sport, tier').eq('userId', userId),
                    ]);

                    if (usersError) throw usersError;
                    if (tiersError) throw tiersError;

                    const usersById = new Map((users || []).map(u => [String(u.id), u]));
                    const formatFriend = (row) => {
                        const friendId = String(row.userId) === String(userId) ? row.friendId : row.userId;
                        const raw = usersById.get(String(friendId));
                        if (!raw) return null;
                        return {
                            ...parseUser(raw),
                            friendshipStatus: row.status,
                            isSender: String(row.userId) === String(userId),
                        };
                    };
                    const tiers = (tierRows || []).map(t => ({ friendId: t.friendId, sport: t.sport, tier: t.tier }));

                    return Response.json({
                        friends: rows.filter(r => r.status === 'accepted').map(formatFriend).filter(Boolean),
                        pendingRequests: rows.filter(r => r.status === 'pending').map(formatFriend).filter(Boolean),
                        tiers,
                    });
                }
            }
        } catch (sbErr) {
            console.error('[friends GET] Supabase fallback error:', sbErr.message);
            sbOutage = true;
        }

        // If the fallback queries errored (real DB outage), surface a 503 rather than
        // masking the outage as "no friends".
        if (sbOutage) return Response.json({ error: 'Database unavailable' }, { status: 503 });

        return Response.json({ friends: [], pendingRequests: [], tiers: [] });
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
                            .from('User')
                            .upsert({ phone, name, email: `offline_${Date.now()}@sportsvault.app`, privacy: 'private' }, { onConflict: 'phone' })
                            .select('id').single();
                        finalFriendId = data?.id;
                    }
                }
            }

            if (!finalFriendId) return Response.json({ error: 'Friend ID or contact details required' }, { status: 400 });

            let friendship;
            try {
                friendship = await prisma.friendship.upsert({
                    where: { userId_friendId: { userId, friendId: finalFriendId } },
                    update: { status: 'accepted' },
                    create: { userId, friendId: finalFriendId, status: 'accepted' }
                });
            } catch (prismaErr) {
                console.error('[friends POST] Prisma friendship error, falling back to Supabase:', prismaErr.message);
                const supabase = getSupabase();
                if (!supabase) throw prismaErr;

                const { data, error } = await supabase
                    .from('Friendship')
                    .upsert({ userId, friendId: finalFriendId, status: 'accepted' }, { onConflict: 'userId,friendId' })
                    .select('*')
                    .single();

                if (error) throw error;
                friendship = data;
            }

            try {
                await prisma.notification.create({
                    data: {
                        userId: finalFriendId,
                        title: 'New Friend',
                        message: `${session.user?.name || 'Someone'} added you as a friend on SportsVault!`
                    }
                });
            } catch (_) {
                try {
                    const supabase = getSupabase();
                    if (supabase) {
                        await supabase.from('Notification').insert({
                            userId: finalFriendId,
                            title: 'New Friend',
                            message: `${session.user?.name || 'Someone'} added you as a friend on SportsVault!`
                        });
                    }
                } catch { /* notification optional */ }
            }

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
                console.error('[friends DELETE] Prisma error, falling back to Supabase:', prismaErr.message);
                const supabase = getSupabase();
                if (!supabase) throw prismaErr;

                const { error } = await supabase
                    .from('Friendship')
                    .delete()
                    .or(`and(userId.eq.${userId},friendId.eq.${friendId}),and(userId.eq.${friendId},friendId.eq.${userId})`);

                if (error) throw error;
            }
            return Response.json({ success: true });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });
    } catch (err) {
        console.error('POST /api/friends error:', err.message);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
