import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/session';

function parseUser(u) {
    if (!u) return null;
    let sports = [];
    try { sports = Array.isArray(u.sports) ? u.sports : JSON.parse(u.sports || '[]'); if (!Array.isArray(sports)) sports = sports ? [sports] : []; } catch { sports = []; }
    let positions = {};
    try { positions = typeof u.positions === 'object' && u.positions !== null ? u.positions : JSON.parse(u.positions || '{}'); } catch { positions = {}; }
    let ratings = {};
    try { ratings = typeof u.ratings === 'object' && u.ratings !== null ? u.ratings : JSON.parse(u.ratings || '{}'); } catch { ratings = {}; }
    return {
        ...u,
        sports, positions, ratings,
        thoughts: (u.thoughtsReceived || []).map(t => ({
            from: t.fromId, fromName: t.from?.name, text: t.text,
            date: t.date ? (t.date instanceof Date ? t.date.toISOString().split('T')[0] : String(t.date).split('T')[0]) : '',
        })),
    };
}

export async function GET(req) {
    try {
        const session = await getSession(req);
        if (!session.user) return Response.json({ friends: [] });
        const currentUserId = session.user.dbId || session.user.id;

        // --- Try Prisma ---
        try {
            const friendships = await prisma.friendship.findMany({
                where: { OR: [{ userId: currentUserId }, { friendId: currentUserId }] },
                include: {
                    user: { select: { id: true, name: true, phone: true, photo: true, location: true, sports: true, positions: true, ratings: true, trustScore: true, createdAt: true, privacy: true, gamesPlayed: true, thoughtsReceived: { include: { from: { select: { name: true } } } } } },
                    friend: { select: { id: true, name: true, phone: true, photo: true, location: true, sports: true, positions: true, ratings: true, trustScore: true, createdAt: true, privacy: true, gamesPlayed: true, thoughtsReceived: { include: { from: { select: { name: true } } } } } }
                }
            });
            const friendTiers = await prisma.friendTier.findMany({ where: { userId: currentUserId } });
            const accepted = friendships.filter(f => f.status === 'accepted');
            const pending = friendships.filter(f => f.status === 'pending');
            const formatFriend = (f) => {
                const raw = f.userId === currentUserId ? f.friend : f.user;
                if (!raw) return null;
                return { ...parseUser(raw), friendshipStatus: f.status, isSender: f.userId === currentUserId };
            };
            return Response.json({ friends: accepted.map(formatFriend).filter(Boolean), pendingRequests: pending.map(formatFriend).filter(Boolean), tiers: friendTiers });
        } catch (prismaErr) {
            console.error('[friends GET] Prisma error, falling back to Supabase:', prismaErr.message);
        }

        // --- Supabase fallback ---
        try {
            const supabase = getSupabase();
            if (supabase) {
                const uid = currentUserId;
                const { data: rows } = await supabase.from('friendships').select('user_id, friend_id').or(`user_id.eq.${uid},friend_id.eq.${uid}`);
                if (rows?.length) {
                    const friendIds = rows.map(r => String(r.user_id) === String(uid) ? r.friend_id : r.user_id);
                    const { data: users } = await supabase.from('users').select('*').in('id', friendIds);
                    return Response.json({ friends: (users || []).map(u => parseUser({ ...u, thoughtsReceived: [] })), pendingRequests: [], tiers: [] });
                }
            }
        } catch (sbErr) {
            console.error('[friends GET] Supabase fallback error:', sbErr.message);
        }

        return Response.json({ friends: [], pendingRequests: [], tiers: [] });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const session = await getSession(req);
        if (!session.user) return Response.json({ error: 'Not authenticated' }, { status: 401 });
        const { friendId, action, phone, name } = await req.json();
        const currentUserId = session.user.dbId || session.user.id;

        if (action === 'add') {
            let finalFriendId = friendId;
            if (phone && name) {
                try {
                    const shadow = await prisma.user.upsert({ where: { phone }, update: {}, create: { name, phone, email: `offline_${Date.now()}@sportsvault.app`, privacy: 'private' } });
                    finalFriendId = shadow.id;
                } catch (_) {
                    const supabase = getSupabase();
                    if (supabase) {
                        const { data } = await supabase.from('users').upsert({ phone, name, email: `offline_${Date.now()}@sportsvault.app`, privacy: 'private' }, { onConflict: 'phone' }).select('id').single();
                        finalFriendId = data?.id;
                    }
                }
            }
            if (!finalFriendId) return Response.json({ error: 'Friend ID or data required' }, { status: 400 });
            try {
                const friendship = await prisma.friendship.upsert({ where: { userId_friendId: { userId: currentUserId, friendId: finalFriendId } }, update: { status: 'accepted' }, create: { userId: currentUserId, friendId: finalFriendId, status: 'accepted' } });
                return Response.json({ success: true, friendship });
            } catch (_) {
                const supabase = getSupabase();
                if (supabase) {
                    await supabase.from('friendships').upsert({ user_id: currentUserId, friend_id: finalFriendId, status: 'accepted' }, { onConflict: 'user_id,friend_id' });
                    return Response.json({ success: true, friendship: { friendId: finalFriendId } });
                }
            }
        }

        if (action === 'remove') {
            try {
                await prisma.friendship.deleteMany({ where: { OR: [{ userId: currentUserId, friendId }, { userId: friendId, friendId: currentUserId }] } });
            } catch (_) {
                const supabase = getSupabase();
                if (supabase) {
                    await supabase.from('friendships').delete().or(`and(user_id.eq.${currentUserId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${currentUserId})`);
                }
            }
            return Response.json({ success: true });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
