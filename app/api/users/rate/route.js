import { prisma } from '@/lib/prisma';

export async function POST(req) {
    try {
        const body = await req.json();
        const { playerId, sport, rating, attrs, thought, fromId, gameId } = body;

        if (!playerId || !sport || !rating) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { id: playerId } });
        if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

        let ratings = {};
        try { ratings = JSON.parse(user.ratings || '{}'); } catch { ratings = {}; }
        if (!ratings[sport]) ratings[sport] = { overall: 0, count: 0, attrs: {}, ratedLog: [] };

        // Dedup: prevent the same person from rating the same player twice in the same game
        const logKey = `${fromId || 'anon'}:${gameId || 'unknown'}`;
        const ratedLog = ratings[sport].ratedLog || [];
        if (fromId && gameId && ratedLog.includes(logKey)) {
            return Response.json({ success: false, alreadyRated: true });
        }

        // Update overall (rolling average, 1-5 scale)
        const prev = ratings[sport];
        const newCount = (prev.count || 0) + 1;
        const newOverall = (((prev.overall || 0) * (prev.count || 0)) + rating) / newCount;

        // Update per-attribute rolling averages
        const updatedAttrs = { ...(prev.attrs || {}) };
        if (attrs && typeof attrs === 'object') {
            for (const [attr, val] of Object.entries(attrs)) {
                const prevAttrVal = updatedAttrs[attr] ?? 0;
                const prevCount = prev.count || 0;
                updatedAttrs[attr] = Math.round(((prevAttrVal * prevCount + val) / newCount) * 10) / 10;
            }
        }

        ratings[sport] = {
            overall: Math.round(newOverall * 10) / 10,
            count: newCount,
            attrs: updatedAttrs,
            ratedLog: [...ratedLog, logKey].slice(-200), // cap at 200 entries
        };

        // Trust score: +2 for great rating, -2 for poor, +1 otherwise
        const trustBonus = rating >= 4 ? 2 : rating <= 2 ? -2 : 1;

        await prisma.user.update({
            where: { id: playerId },
            data: {
                ratings: JSON.stringify(ratings),
                trustScore: Math.max(0, Math.min(100, (user.trustScore || 0) + trustBonus)),
            }
        });

        // Save thought if provided
        if (thought && fromId) {
            try {
                await prisma.thought.create({ data: { fromId, toId: playerId, text: thought } });
            } catch (_) { /* Thought table might not exist in all environments */ }
        }

        return Response.json({ success: true, ratings: ratings[sport] });
    } catch (err) {
        console.error('Rating API error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
