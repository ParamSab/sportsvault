import { promises as fs } from 'fs';
import path from 'path';
import { findLocalUserById } from './localUserStore';

const STORE_PATH = path.join(process.cwd(), 'tmp', 'local-friendships.json');

export function canUseLocalFriendStore() {
    return process.env.VERCEL !== '1';
}

async function readFriendships() {
    if (!canUseLocalFriendStore()) return [];
    try {
        const raw = await fs.readFile(STORE_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
    }
}

async function writeFriendships(rows) {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(rows, null, 2));
}

function publicUser(user, id) {
    return {
        id,
        name: user?.name || 'SportsVault Player',
        phone: user?.phone || null,
        photo: user?.photo || null,
        location: user?.location || 'Unknown',
        sports: Array.isArray(user?.sports) ? user.sports : JSON.parse(user?.sports || '[]'),
        positions: typeof user?.positions === 'string' ? JSON.parse(user.positions || '{}') : (user?.positions || {}),
        ratings: typeof user?.ratings === 'string' ? JSON.parse(user.ratings || '{}') : (user?.ratings || {}),
        trustScore: user?.trustScore ?? 50,
        gamesPlayed: user?.gamesPlayed ?? 0,
        privacy: user?.privacy || 'public',
        createdAt: user?.createdAt,
        thoughts: [],
    };
}

export async function listLocalFriendships(userId) {
    const rows = await readFriendships();
    const related = rows.filter(r => String(r.userId) === String(userId) || String(r.friendId) === String(userId));
    const formatted = await Promise.all(related.map(async (row) => {
        const otherId = String(row.userId) === String(userId) ? row.friendId : row.userId;
        const user = await findLocalUserById(otherId);
        return {
            ...publicUser(user, otherId),
            friendshipStatus: row.status,
            isSender: String(row.userId) === String(userId),
        };
    }));

    return {
        friends: formatted.filter(f => f.friendshipStatus === 'accepted'),
        pendingRequests: formatted.filter(f => f.friendshipStatus === 'pending'),
    };
}

export async function findLocalFriendship(userId, friendId) {
    const rows = await readFriendships();
    return rows.find(r =>
        (String(r.userId) === String(userId) && String(r.friendId) === String(friendId)) ||
        (String(r.userId) === String(friendId) && String(r.friendId) === String(userId))
    ) || null;
}

export async function upsertLocalFriendship(userId, friendId, status = 'accepted') {
    const rows = await readFriendships();
    const now = new Date().toISOString();
    const index = rows.findIndex(r =>
        (String(r.userId) === String(userId) && String(r.friendId) === String(friendId)) ||
        (String(r.userId) === String(friendId) && String(r.friendId) === String(userId))
    );
    const row = {
        ...(index >= 0 ? rows[index] : { id: crypto.randomUUID(), userId, friendId, createdAt: now }),
        status,
        updatedAt: now,
    };
    if (index >= 0) rows[index] = row;
    else rows.push(row);
    await writeFriendships(rows);
    return row;
}

export async function acceptLocalFriendship(requesterId, receiverId) {
    const rows = await readFriendships();
    const index = rows.findIndex(r =>
        String(r.userId) === String(requesterId) &&
        String(r.friendId) === String(receiverId) &&
        r.status === 'pending'
    );
    if (index < 0) return null;
    rows[index] = { ...rows[index], status: 'accepted', updatedAt: new Date().toISOString() };
    await writeFriendships(rows);
    return rows[index];
}

export async function deleteLocalFriendship(userId, friendId, status) {
    const rows = await readFriendships();
    const next = rows.filter(r => {
        const matchesPair =
            (String(r.userId) === String(userId) && String(r.friendId) === String(friendId)) ||
            (String(r.userId) === String(friendId) && String(r.friendId) === String(userId));
        const matchesStatus = !status || r.status === status;
        return !(matchesPair && matchesStatus);
    });
    await writeFriendships(next);
}
