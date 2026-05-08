import { promises as fs } from 'fs';
import path from 'path';

const STORE_PATH = path.join(process.cwd(), 'tmp', 'local-games.json');

export function canUseLocalGameStore() {
    return process.env.VERCEL !== '1';
}

async function readGames() {
    if (!canUseLocalGameStore()) return [];
    try {
        const raw = await fs.readFile(STORE_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
    }
}

async function writeGames(games) {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(games, null, 2));
}

export async function listLocalGames({ userId, friendIds = [] } = {}) {
    const games = await readGames();
    return games
        .filter(g =>
            g.visibility === 'public' ||
            g.organizerId === userId ||
            (g.visibility === 'friends' && friendIds.includes(g.organizerId))
        )
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function saveLocalGame(game, userId) {
    if (!canUseLocalGameStore()) return null;
    const games = await readGames();
    const gameId = crypto.randomUUID();
    const savedGame = {
        id: gameId,
        title: game.title,
        sport: game.sport,
        format: game.format || '',
        date: game.date,
        time: game.time,
        duration: game.duration || 90,
        location: game.location || '',
        address: game.address || '',
        lat: game.lat || null,
        lng: game.lng || null,
        maxPlayers: game.maxPlayers || 10,
        skillLevel: game.skillLevel || 'All Levels',
        status: 'open',
        visibility: game.visibility || 'public',
        approvalRequired: !!game.approvalRequired,
        bookingImage: game.bookingImage || null,
        pitchType: game.pitchType || null,
        surface: game.surface || null,
        footwear: game.footwear || '',
        price: game.price ? parseFloat(game.price.toString()) : 0,
        gender: game.gender || 'mixed',
        amenities: typeof game.amenities === 'string' ? game.amenities : JSON.stringify(game.amenities || []),
        reminderHours: game.reminderHours !== undefined ? parseInt(game.reminderHours) : 2,
        remindersSent: false,
        organizerId: userId,
        organizer: { id: userId, name: 'Local player', photo: null },
        rsvps: [{ playerId: userId, status: 'yes', position: game.organizerPosition || '', player: null }],
        createdAt: new Date().toISOString(),
    };
    games.unshift(savedGame);
    await writeGames(games);
    return savedGame;
}
