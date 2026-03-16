const fs = require('fs');

// 1. Update /api/auth/verify/route.js
const verifyPath = 'c:\\Users\\Param\\Downloads\\New folder\\sportsvault\\app\\api\\auth\\verify\\route.js';
let verifyContent = fs.readFileSync(verifyPath, 'utf8');

const newVerifyContent = `import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

const sessionOptions = {
    password: process.env.SESSION_SECRET || 'sportsvault-super-secret-key-min-32-chars!!',
    cookieName: 'sportsvault_session',
    cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30, // 30 days
    },
};

export async function POST(req) {
    try {
        const { phone, rememberMe } = await req.json();
        if (!phone) return Response.json({ error: 'Phone number required' }, { status: 400 });

        const user = await prisma.user.findUnique({
            where: { phone },
        });

        if (user) {
            const customOptions = { ...sessionOptions };
            if (!rememberMe) {
                customOptions.cookieOptions = { ...customOptions.cookieOptions };
                delete customOptions.cookieOptions.maxAge; // Session cookie only
            }

            const cookieStore = await cookies();
            const session = await getIronSession(cookieStore, customOptions);

            const userData = {
                ...user,
                sports: JSON.parse(user.sports || '[]'),
                positions: JSON.parse(user.positions || '{}'),
                ratings: JSON.parse(user.ratings || '{}'),
                dbId: user.id
            };
            delete userData.password;

            session.user = userData;
            await session.save();

            return Response.json({ user: userData, exists: true });
        }

        return Response.json({ exists: false });
    } catch (err) {
        console.error('Verify API error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
`;
fs.writeFileSync(verifyPath, newVerifyContent, 'utf8');
console.log('Updated /api/auth/verify');

// 2. Update /api/users/route.js
const usersPath = 'c:\\Users\\Param\\Downloads\\New folder\\sportsvault\\app\\api\\users\\route.js';
let usersContent = fs.readFileSync(usersPath, 'utf8');

const newUsersContent = `import { prisma } from '@/lib/prisma';

export async function POST(req) {
    try {
        const { name, phone, photo, location, sports, positions } = await req.json();
        if (!phone) return Response.json({ error: 'Phone required' }, { status: 400 });

        const user = await prisma.user.upsert({
            where: { phone },
            update: {
                name,
                photo: photo || null,
                location: location || null,
                sports: JSON.stringify(sports || []),
                positions: JSON.stringify(positions || {}),
            },
            create: {
                name,
                phone,
                photo: photo || null,
                location: location || null,
                sports: JSON.stringify(sports || []),
                positions: JSON.stringify(positions || {}),
            },
        });

        return Response.json({
            user: {
                ...user,
                sports: JSON.parse(user.sports || '[]'),
                positions: JSON.parse(user.positions || '{}'),
                ratings: JSON.parse(user.ratings || '{}'),
            }
        });
    } catch (err) {
        console.error('POST /api/users error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const q = searchParams.get('q');
        if (!q || q.length < 2) return Response.json({ users: [] });

        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { name: { contains: q } },
                    { phone: { contains: q } },
                ],
            },
            take: 10,
            select: { id: true, name: true, phone: true, photo: true, location: true },
        });
        return Response.json({ users });
    } catch (err) {
        return Response.json({ users: [] });
    }
}
`;
fs.writeFileSync(usersPath, newUsersContent, 'utf8');
console.log('Updated /api/users');
