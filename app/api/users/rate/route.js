import { prisma } from '@/lib/prisma';

export async function POST(req) {
    try {
        const body = await req.json();
        const { playerId, sport, rating, thought, fromId } = body;

        if (!playerId || !sport || !rating) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Update User Ratings and Trust Score
        const user = await prisma.user.findUnique({ where: { id: playerId } });
        if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

        let ratings = JSON.parse(user.ratings || '{}');
        if (!ratings[sport]) {
            ratings[sport] = { overall: 0, count: 0 };
        }

        const currentOverall = ratings[sport].overall;
        const currentCount = ratings[sport].count;
        const newCount = currentCount + 1;
        const newOverall = ((currentOverall * currentCount) + rating) / newCount;

        ratings[sport] = {
            overall: Math.round(newOverall * 10) / 10,
            count: newCount
        };

        // Update Trust Score (simple increment for being rated, plus rating weight)
        const trustBonus = rating >= 4 ? 2 : rating <= 2 ? -2 : 1;

        await prisma.user.update({
            where: { id: playerId },
            data: {
                ratings: JSON.stringify(ratings),
                trustScore: Math.max(0, Math.min(100, (user.trustScore || 0) + trustBonus)),
            }
        });

        // 2. Save Thought if provided
        if (thought && fromId) {
            await prisma.thought.create({
                data: {
                    fromId,
                    toId: playerId,
                    text: thought,
                }
            });
        }

        return Response.json({ success: true, ratings });
    } catch (err) {
        console.error('Rating API error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
