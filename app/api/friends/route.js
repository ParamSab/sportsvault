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
        try {
            const supabase = getSupabase();
            if (supabase) {
                const { data: rows } = await supabase
                    .from('friendships')
                    .select('user_id, friend_id')
                    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
                if (rows?.length) {
                    const friendIds = rows.map(r => String(r.user_id) === String(userId) ? r.friend_id : r.user_id);
                    const { data: users } = await supabase.from('users').select('*').in('id', friendIds);
                    return Response.json({
                        friends: (users || []).map(u => parseUser(u)),
                        pendingRequests: [],
                        tiers: [],
                    });
                }
            }
        } catch (sbErr) {
            console.error('[friends GET] Supabase fallback error:', sbErr.message);
        }

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
                            .from('users')
                            .upsert({ phone, name, email: `offline_${Date.now()}@sportsvault.app`, privacy: 'private' }, { onConflict: 'phone' })
                            .select('id').single();
                        finalFriendId = data?.id;
                    }
                }
            }

            if (!finalFriendId) return Response.json({ error: 'Friend ID or contact details required' }, { status: 400 });

            const friendship = await prisma.friendship.upsert({
                where: { userId_friendId: { userId, friendId: finalFriendId } },
                update: { status: 'accepted' },
                create: { userId, friendId: finalFriendId, status: 'accepted' }
            });

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
            await prisma.friendship.deleteMany({
                where: {
                    OR: [
                        { userId, friendId },
                        { userId: friendId, friendId: userId }
                    ]
                }
            });
            return Response.json({ success: true });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });
    } catch (err) {
        console.error('POST /api/friends error:', err.message);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
