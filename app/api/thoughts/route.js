import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

async function getSessionUserId() {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    return session.user?.dbId || session.user?.id || null;
}

// GET /api/thoughts?userId=xxx — thoughts left on a user's profile.
// Thoughts from users the viewer has blocked are filtered out server-side.
export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        if (!userId) return Response.json({ error: 'userId required' }, { status: 400 });

        const viewerId = await getSessionUserId();
        const blockedIds = viewerId
            ? (await prisma.block.findMany({ where: { blockerId: viewerId }, select: { blockedId: true } })).map(b => b.blockedId)
            : [];

        const thoughts = await prisma.thought.findMany({
            where: { toId: userId, ...(blockedIds.length > 0 && { fromId: { notIn: blockedIds } }) },
            include: { sender: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        return Response.json({
            thoughts: thoughts.map(t => ({
                id: t.id,
                from: t.fromId,
                fromName: t.sender?.name || 'Unknown',
                text: t.text,
                date: t.createdAt.toISOString().split('T')[0],
            })),
        });
    } catch (err) {
        console.error('GET /api/thoughts error:', err);
        return Response.json({ thoughts: [] });
    }
}

// POST /api/thoughts — leave a thought on another user's profile
export async function POST(req) {
    try {
        const fromId = await getSessionUserId();
        if (!fromId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { toId, text } = await req.json();
        if (!toId || !text?.trim()) return Response.json({ error: 'toId and text required' }, { status: 400 });
        if (String(toId) === String(fromId)) return Response.json({ error: 'Cannot leave a thought on your own profile' }, { status: 400 });
        if (text.length > 500) return Response.json({ error: 'Thought too long (max 500 chars)' }, { status: 400 });

        // Blocked users cannot leave thoughts on the blocker's profile
        const blocked = await prisma.block.findFirst({
            where: { blockerId: toId, blockedId: fromId },
        });
        if (blocked) return Response.json({ error: 'You cannot interact with this user' }, { status: 403 });

        const thought = await prisma.thought.create({
            data: { fromId, toId, text: text.trim() },
            include: { sender: { select: { name: true } } },
        });

        return Response.json({
            thought: {
                id: thought.id,
                from: thought.fromId,
                fromName: thought.sender?.name || 'Unknown',
                text: thought.text,
                date: thought.createdAt.toISOString().split('T')[0],
            },
        });
    } catch (err) {
        console.error('POST /api/thoughts error:', err);
        return Response.json({ error: 'Could not save thought' }, { status: 500 });
    }
}

// DELETE /api/thoughts?id=xxx — author or profile owner can remove a thought
export async function DELETE(req) {
    try {
        const userId = await getSessionUserId();
        if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });

        const thought = await prisma.thought.findUnique({ where: { id } });
        if (!thought) return Response.json({ error: 'Not found' }, { status: 404 });

        // Only the author or the person whose profile it's on may delete it
        if (String(thought.fromId) !== String(userId) && String(thought.toId) !== String(userId)) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        await prisma.thought.delete({ where: { id } });
        return Response.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/thoughts error:', err);
        return Response.json({ error: 'Could not delete thought' }, { status: 500 });
    }
}
