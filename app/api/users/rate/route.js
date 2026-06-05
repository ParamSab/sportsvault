import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

function computeUpdatedRatings(existingRatings, sport, rating, attrs, fromId, gameId) {
    // The ratings column may come back as a JSON string (Prisma/TEXT) or an
    // already-parsed object (Supabase jsonb). Handle both so we never wipe
    // a user's existing ratings by JSON.parse-ing an object.
    let ratings = {};
    if (existingRatings && typeof existingRatings === 'object') {
        ratings = existingRatings;
    } else {
        try { ratings = JSON.parse(existingRatings || '{}') || {}; } catch { ratings = {}; }
    }
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
        const { playerId, sport, rating, attrs, thought, gameId } = body;

        if (!playerId || !sport || !rating) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // The rater must be authenticated. Derive their identity from the
        // session cookie rather than trusting a client-supplied fromId, so a
        // caller cannot spoof ratings on behalf of someone else.
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        const fromId = session.user?.dbId || session.user?.id;
        if (!fromId) {
            return Response.json({ error: 'Authentication required' }, { status: 401 });
        }

        // Cannot rate yourself — guard the API even though the UI also filters this out.
        if (String(fromId) === String(playerId)) {
            return Response.json({ error: 'You cannot rate yourself.' }, { status: 400 });
        }

        const trustBonus = rating >= 4 ? 2 : rating <= 2 ? -2 : 1;

        // --- Try Prisma first ---
        try {
            const user = await prisma.user.findUnique({ where: { id: playerId } });
            if (!user) throw new Error('User not found in Prisma');

            // Authorize: the rater and the player being rated must both have been
            // in this game. Prevents rating people you never played with.
            if (gameId) {
                const [raterRsvp, ratedRsvp] = await Promise.all([
                    prisma.rsvp.findFirst({ where: { gameId, playerId: fromId } }),
                    prisma.rsvp.findFirst({ where: { gameId, playerId } }),
                ]);
                if (!raterRsvp) return Response.json({ error: 'You were not part of this game.' }, { status: 403 });
                if (!ratedRsvp) return Response.json({ error: 'That player was not part of this game.' }, { status: 403 });
            }

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

            // Authorize: both rater and rated player must have RSVP'd to this game.
            if (gameId) {
                const { data: rsvps } = await supabase
                    .from('game_rsvps')
                    .select('player_id')
                    .eq('game_id', gameId)
                    .in('player_id', [fromId, playerId]);
                const rsvpIds = (rsvps || []).map(r => String(r.player_id));
                if (!rsvpIds.includes(String(fromId))) return Response.json({ error: 'You were not part of this game.' }, { status: 403 });
                if (!rsvpIds.includes(String(playerId))) return Response.json({ error: 'That player was not part of this game.' }, { status: 403 });
            }

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
