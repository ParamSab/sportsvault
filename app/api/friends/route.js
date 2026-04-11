import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

function safeParse(val, fallback) {
    if (val == null) return fallback;
    if (typeof val !== 'string') return val ?? fallback;
    try { return JSON.parse(val) ?? fallback; } catch { return fallback; }
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        const userId = session.user?.dbId || session.user?.id;
        if (!userId) return Response.json({ friends: [] });

        const [friendships, friendTiers] = await Promise.all([
            prisma.friendship.findMany({
                where: {
                    status: 'accepted',
                    OR: [{ userId }, { friendId: userId }]
                },
                // Thoughts are only needed when viewing an individual profile — don't
                // load them here to keep the friends-list query fast at any scale.
                include: {
                    user: {
                        select: {
                            id: true, name: true, phone: true, photo: true,
                            location: true, sports: true, positions: true,
                            ratings: true, trustScore: true, createdAt: true,
                        }
                    },
                    friend: {
                        select: {
                            id: true, name: true, phone: true, photo: true,
                            location: true, sports: true, positions: true,
                            ratings: true, trustScore: true, createdAt: true,
                        }
                    }
                },
                take: 500, // no user realistically needs more than 500 friends loaded at once
            }),
            prisma.friendTier.findMany({ where: { userId } })
        ]);

        const friends = friendships.map(f => {
            const d = f.userId === userId ? f.friend : f.user;
            const sports = (() => { const s = safeParse(d.sports, []); return Array.isArray(s) ? s : []; })();
            return {
                ...d,
                sports,
                positions: safeParse(d.positions, {}),
                ratings: safeParse(d.ratings, {}),
                thoughts: [], // loaded on demand when viewing a profile
            };
        });

        return Response.json({ friends, tiers: friendTiers });
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
                const shadow = await prisma.user.upsert({
                    where: { phone },
                    update: {},
                    create: { name, phone, email: `offline_${Date.now()}@sportsvault.app`, privacy: 'private' }
                });
                finalFriendId = shadow.id;
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
