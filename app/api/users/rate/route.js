import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';

function computeUpdatedRatings(existingRatingsJson, sport, rating, attrs, fromId, gameId) {
    let ratings = {};
    try { ratings = JSON.parse(existingRatingsJson || '{}'); } catch { ratings = {}; }
    if (!ratings[sport]) ratings[sport] = { overall: 0, count: 0, attrs: {}, ratedLog: [] };

    const logKey = `${fromId || 'anon'}:${gameId || 'unknown'}`;
    const ratedLog = ratings[sport].ratedLog || [];
    if (fromId && gameId && ratedLog.includes(logKey)) return { alreadyRated: true };

    const prev = ratings[sport];
    const newCount = (prev.count || 0) + 1;
    const newOverall = (((prev.overall || 0) * (prev.count || 0)) + rating) / newCount;

    const updatedAttrs = { ...(prev.attrs || {}) };
    if (attrs && typeof attrs === 'object') {
        for (const [attr, val] of Object.entries(attrs)) {
            const prevAttrVal = updatedAttrs[attr] ?? 0;
            updatedAttrs[attr] = Math.round(((prevAttrVal * (prev.count || 0) + val) / newCount) * 10) / 10;
        }
    }

    ratings[sport] = {
        overall: Math.round(newOverall * 10) / 10,
        count: newCount,
        attrs: updatedAttrs,
        ratedLog: [...ratedLog, logKey].slice(-200),
    };

    return { ratings, sportRatings: ratings[sport] };
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { playerId, sport, rating, attrs, thought, fromId, gameId } = body;

        if (!playerId || !sport || !rating) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const trustBonus = rating >= 4 ? 2 : rating <= 2 ? -2 : 1;

        // --- Try Prisma first ---
        try {
            const user = await prisma.user.findUnique({ where: { id: playerId } });
            if (!user) throw new Error('User not found in Prisma');

            const result = computeUpdatedRatings(user.ratings, sport, rating, attrs, fromId, gameId);
            if (result.alreadyRated) return Response.json({ success: false, alreadyRated: true });

            await prisma.user.update({
                where: { id: playerId },
                data: {
                    ratings: JSON.stringify(result.ratings),
                    trustScore: Math.max(0, Math.min(100, (user.trustScore || 0) + trustBonus)),
                }
            });

            if (thought && fromId) {
                try {
                    await prisma.thought.create({ data: { fromId, toId: playerId, text: thought } });
                } catch (_) { /* Thought table might not exist */ }
            }

            return Response.json({ success: true, ratings: result.sportRatings });
        } catch (prismaErr) {
            console.error('[rate] Prisma error, falling back to Supabase:', prismaErr.message);
        }

        // --- Supabase fallback ---
        try {
            const supabase = getSupabase();
            if (!supabase) return Response.json({ error: 'Database unavailable' }, { status: 503 });

            const { data: user } = await supabase.from('users').select('ratings, trust_score').eq('id', playerId).single();
            if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

            const result = computeUpdatedRatings(user.ratings, sport, rating, attrs, fromId, gameId);
            if (result.alreadyRated) return Response.json({ success: false, alreadyRated: true });

            await supabase.from('users').update({
                ratings: JSON.stringify(result.ratings),
                trust_score: Math.max(0, Math.min(100, (user.trust_score || 0) + trustBonus)),
            }).eq('id', playerId);

            return Response.json({ success: true, ratings: result.sportRatings });
        } catch (sbErr) {
            console.error('[rate] Supabase error:', sbErr.message);
            return Response.json({ error: sbErr.message }, { status: 500 });
        }
    } catch (err) {
        console.error('Rating API error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
