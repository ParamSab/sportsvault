import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

async function getSessionUserId() {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    return session.user?.dbId || session.user?.id || null;
}

// GET /api/moderation — list of user IDs the session user has blocked
export async function GET() {
    try {
        const userId = await getSessionUserId();
        if (!userId) return Response.json({ blocked: [] });
        const blocks = await prisma.block.findMany({
            where: { blockerId: userId },
            select: { blockedId: true },
        });
        return Response.json({ blocked: blocks.map(b => b.blockedId) });
    } catch (err) {
        console.error('GET /api/moderation error:', err);
        return Response.json({ blocked: [] });
    }
}

// POST /api/moderation — { action: 'report'|'block'|'unblock', ... }
export async function POST(req) {
    try {
        const userId = await getSessionUserId();
        if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { action } = body;

        if (action === 'report') {
            const { targetType, targetId, reason } = body;
            if (!targetType || !targetId) {
                return Response.json({ error: 'targetType and targetId required' }, { status: 400 });
            }
            if (!['thought', 'user'].includes(targetType)) {
                return Response.json({ error: 'Invalid targetType' }, { status: 400 });
            }
            await prisma.report.create({
                data: {
                    reporterId: userId,
                    targetType,
                    targetId: String(targetId),
                    reason: (reason || '').slice(0, 500) || null,
                },
            });
            return Response.json({ success: true });
        }

        if (action === 'block') {
            const { targetUserId } = body;
            if (!targetUserId) return Response.json({ error: 'targetUserId required' }, { status: 400 });
            if (String(targetUserId) === String(userId)) {
                return Response.json({ error: 'Cannot block yourself' }, { status: 400 });
            }
            await prisma.block.upsert({
                where: { blockerId_blockedId: { blockerId: userId, blockedId: targetUserId } },
                create: { blockerId: userId, blockedId: targetUserId },
                update: {},
            });
            // Blocking also severs any friendship in both directions
            await prisma.friendship.deleteMany({
                where: {
                    OR: [
                        { userId, friendId: targetUserId },
                        { userId: targetUserId, friendId: userId },
                    ],
                },
            }).catch(() => {});
            await prisma.friend.deleteMany({
                where: {
                    OR: [
                        { userId, friendUserId: targetUserId },
                        { userId: targetUserId, friendUserId: userId },
                    ],
                },
            }).catch(() => {});
            return Response.json({ success: true });
        }

        if (action === 'unblock') {
            const { targetUserId } = body;
            if (!targetUserId) return Response.json({ error: 'targetUserId required' }, { status: 400 });
            await prisma.block.deleteMany({
                where: { blockerId: userId, blockedId: targetUserId },
            });
            return Response.json({ success: true });
        }

        return Response.json({ error: 'Unknown action' }, { status: 400 });
    } catch (err) {
        console.error('POST /api/moderation error:', err);
        return Response.json({ error: 'Moderation action failed' }, { status: 500 });
    }
}
