import { promises as fs } from 'fs';
import path from 'path';

const STORE_PATH = path.join(process.cwd(), 'tmp', 'local-users.json');

export function canUseLocalUserStore() {
    return process.env.VERCEL !== '1';
}

async function readUsers() {
    if (!canUseLocalUserStore()) return [];
    try {
        const raw = await fs.readFile(STORE_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
    }
}

async function writeUsers(users) {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(users, null, 2));
}

export async function findLocalUserByEmail(email) {
    const users = await readUsers();
    return users.find(u => u.email === email) || null;
}

export async function findLocalUserByPhone(phone) {
    const users = await readUsers();
    return users.find(u => u.phone === phone) || null;
}

export async function findLocalUserById(id) {
    const users = await readUsers();
    return users.find(u => u.id === id) || null;
}

export async function upsertLocalUser(data) {
    const users = await readUsers();
    const index = users.findIndex(u =>
        (data.id && u.id === data.id) ||
        (data.email && u.email === data.email) ||
        (data.phone && u.phone === data.phone)
    );
    const now = new Date().toISOString();
    const existing = index >= 0 ? users[index] : null;
    const user = {
        id: existing?.id || crypto.randomUUID(),
        name: data.name || existing?.name || 'Player',
        email: data.email ?? existing?.email ?? null,
        phone: data.phone ?? existing?.phone ?? null,
        password: data.password ?? existing?.password,
        photo: data.photo ?? existing?.photo ?? null,
        location: data.location ?? existing?.location ?? null,
        sports: data.sports ?? existing?.sports ?? '[]',
        positions: data.positions ?? existing?.positions ?? '{}',
        ratings: data.ratings ?? existing?.ratings ?? '{}',
        trustScore: existing?.trustScore ?? 0,
        gamesPlayed: existing?.gamesPlayed ?? 0,
        wins: existing?.wins ?? 0,
        losses: existing?.losses ?? 0,
        draws: existing?.draws ?? 0,
        privacy: existing?.privacy ?? 'public',
        createdAt: existing?.createdAt || now,
        updatedAt: now,
    };
    if (index >= 0) users[index] = user;
    else users.push(user);
    await writeUsers(users);
    return user;
}
