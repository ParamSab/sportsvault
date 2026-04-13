import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

// POST: organizer saves the final score + triggers win/loss/draw updates
export async function POST(req) {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        const sessionUserId = session.user?.dbId || session.user?.id;
        if (!sessionUserId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { gameId, team1Score, team2Score, team1PlayerIds, team2PlayerIds } = await req.json();
        if (!gameId || team1Score == null || team2Score == null) {
            return Response.json({ error: 'gameId, team1Score, team2Score required' }, { status: 400 });
        }

        const game = await prisma.game.findUnique({
            where: { id: gameId },
            select: { organizerId: true, title: true, score: true },
        });
        if (!game) return Response.json({ error: 'Game not found' }, { status: 404 });
        if (game.organizerId !== sessionUserId) {
            return Response.json({ error: 'Only the organizer can set the score' }, { status: 403 });
        }

        const s1 = parseInt(team1Score);
        const s2 = parseInt(team2Score);
        const scoreData = {
            team1: s1,
            team2: s2,
            team1PlayerIds: team1PlayerIds || [],
            team2PlayerIds: team2PlayerIds || [],
        };

        // Determine result for each team
        const team1Result = s1 > s2 ? 'win' : s1 < s2 ? 'loss' : 'draw';
        const team2Result = s2 > s1 ? 'win' : s2 < s1 ? 'loss' : 'draw';

        // Persist score and mark game completed
        await prisma.game.update({
            where: { id: gameId },
            data: {
                score: JSON.stringify(scoreData),
                status: 'completed',
            },
        });

        // Update each player's record — run in parallel
        const allUpdates = [
            ...((team1PlayerIds || []).map(pid => updatePlayerRecord(pid, team1Result))),
            ...((team2PlayerIds || []).map(pid => updatePlayerRecord(pid, team2Result))),
        ];
        await Promise.allSettled(allUpdates);

        return Response.json({ success: true, score: scoreData });
    } catch (err) {
        console.error('[SCORE ERROR]', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}

async function updatePlayerRecord(playerId, result) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: playerId },
            select: { gamesPlayed: true, wins: true, losses: true, draws: true, trustScore: true },
        });
        if (!user) return;

        const trustDelta = result === 'win' ? 3 : result === 'draw' ? 1 : 0;

        await prisma.user.update({
            where: { id: playerId },
            data: {
                gamesPlayed: (user.gamesPlayed || 0) + 1,
                wins:    result === 'win'  ? (user.wins   || 0) + 1 : (user.wins   || 0),
                losses:  result === 'loss' ? (user.losses || 0) + 1 : (user.losses || 0),
                draws:   result === 'draw' ? (user.draws  || 0) + 1 : (user.draws  || 0),
                trustScore: Math.min(100, (user.trustScore || 0) + trustDelta),
            },
        });
    } catch (err) {
        console.error(`updatePlayerRecord failed for ${playerId}:`, err.message);
    }
}
