import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function GET(req) {
    try {
        const session = await getSession(req);
        if (!session?.user?.id) return Response.json({ error: 'Not authenticated' }, { status: 401 });

        // In a real app, you would fetch from the Friend table
        // But for this MVP, let's just return all users except the current one as "suggested friends"
        // if the Friend table is still migrating or empty.
        
        const currentUserId = session.user.id;
        
        // Try getting actual friends first
        let friends = await prisma.friend.findMany({
            where: { userId: currentUserId },
            include: { friend: true }
        });

        // Fallback or addition: players who have played with this user (could be another logic)
        // For now, let's return all users for the "search and add" friend experience
        const allUsers = await prisma.user.findMany({
            where: { id: { not: currentUserId } },
            select: { id: true, name: true, phone: true, photo: true }
        });

        return Response.json({ 
            success: true, 
            friends: friends.map(f => f.friend), 
            suggested: allUsers 
        });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
