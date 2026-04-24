import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';

export async function POST(req) {
    try {
        const body = await req.json();
        const { playerId, sport, rating, attrs, thought, fromId, gameId } = body;

        if (!playerId || !sport || !rating) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // --- Prisma path ---
        try {
            const user = await prisma.user.findUnique({ where: { id: playerId } });
            if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

            let ratings = {};
            try { ratings = JSON.parse(user.ratings || '{}'); } catch { ratings = {}; }
            if (!ratings[sport]) ratings[sport] = { overall: 0, count: 0, attrs: {}, ratedLog: [] };

            const logKey = `${fromId || 'anon'}:${gameId || 'unknown'}`;
            const ratedLog = ratings[sport].ratedLog || [];
            if (fromId && gameId && ratedLog.includes(logKey)) {
                return Response.json({ success: false, alreadyRated: true });
            }

            const prev = ratings[sport];
            const newCount = (prev.count || 0) + 1;
            const newOverall = (((prev.overall || 0) * (prev.count || 0)) + rating) / newCount;

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
                ratedLog: [...ratedLog, logKey].slice(-200),
            };

            const trustBonus = rating >= 4 ? 2 : rating <= 2 ? -2 : 1;

            await prisma.user.update({
                where: { id: playerId },
                data: {
                    ratings: JSON.stringify(ratings),
                    trustScore: Math.max(0, Math.min(100, (user.trustScore || 0) + trustBonus)),
                }
            });

            if (thought && fromId) {
                try {
                    await prisma.thought.create({ data: { fromId, toId: playerId, text: thought } });
                } catch (_) { /* Thought table might not exist in all environments */ }
            }

            return Response.json({ success: true, ratings: ratings[sport] });
        } catch (prismaErr) {
            console.error('[rate] Prisma error, falling back to Supabase:', prismaErr.message);
        }

        // --- Supabase fallback ---
        const supabase = getSupabase();
        if (!supabase) return Response.json({ error: 'Database unavailable' }, { status: 503 });

        const { data: sbUser } = await supabase.from('users').select('ratings, trust_score').eq('id', playerId).single();
        if (!sbUser) return Response.json({ error: 'User not found' }, { status: 404 });

        let ratings = {};
        try { ratings = typeof sbUser.ratings === 'string' ? JSON.parse(sbUser.ratings) : (sbUser.ratings || {}); } catch { ratings = {}; }
        if (!ratings[sport]) ratings[sport] = { overall: 0, count: 0, attrs: {}, ratedLog: [] };

        const logKey = `${fromId || 'anon'}:${gameId || 'unknown'}`;
        const ratedLog = ratings[sport].ratedLog || [];
        if (fromId && gameId && ratedLog.includes(logKey)) {
            return Response.json({ success: false, alreadyRated: true });
        }

        const prev = ratings[sport];
        const newCount = (prev.count || 0) + 1;
        const newOverall = (((prev.overall || 0) * (prev.count || 0)) + rating) / newCount;

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
            ratedLog: [...ratedLog, logKey].slice(-200),
        };

        const trustBonus = rating >= 4 ? 2 : rating <= 2 ? -2 : 1;
        const newTrust = Math.max(0, Math.min(100, (sbUser.trust_score || 0) + trustBonus));

        await supabase.from('users').update({ ratings: JSON.stringify(ratings), trust_score: newTrust }).eq('id', playerId);

        if (thought && fromId) {
            try {
                await supabase.from('thoughts').insert({ from_id: fromId, to_id: playerId, text: thought });
            } catch (_) { /* ignore */ }
        }

        return Response.json({ success: true, ratings: ratings[sport] });
    } catch (err) {
        console.error('Rating API error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
