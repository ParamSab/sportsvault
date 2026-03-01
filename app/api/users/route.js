import { prisma } from '@/lib/prisma';

function parseUser(user) {
    return {
        ...user,
        sports: JSON.parse(user.sports || '[]'),
        positions: JSON.parse(user.positions || '{}'),
        ratings: JSON.parse(user.ratings || '{}'),
    };
}

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const email = searchParams.get('email');
        const phone = searchParams.get('phone');
        const id = searchParams.get('id');
        const q = searchParams.get('q');

        // Exact lookup by id
        if (id) {
            const user = await prisma.user.findUnique({ where: { id } });
            if (!user) return Response.json({ user: null });
            return Response.json({ user: parseUser(user) });
        }

        // Exact lookup by email (for returning user login check)
        if (email) {
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user) return Response.json({ user: null });
            return Response.json({ user: parseUser(user) });
        }

        // Exact lookup by phone (for friend-by-phone search)
        if (phone) {
            const user = await prisma.user.findUnique({ where: { phone } });
            if (!user) return Response.json({ user: null });
            return Response.json({ user: parseUser(user) });
        }

        // Fuzzy search by name/email
        if (q && q.length >= 2) {
            const users = await prisma.user.findMany({
                where: {
                    OR: [
                        { name: { contains: q } },
                        { email: { contains: q } },
                    ],
                },
                take: 10,
                select: { id: true, name: true, email: true, photo: true, location: true },
            });
            return Response.json({ users });
        }

        return Response.json({ user: null });
    } catch (err) {
        console.error('GET /api/users error:', err);
        return Response.json({ user: null });
    }
}

export async function POST(req) {
    try {
        const { name, email, phone, photo, location, sports, positions } = await req.json();
        if (!email) return Response.json({ error: 'Email required' }, { status: 400 });

        const user = await prisma.user.upsert({
            where: { email },
            update: {
                name,
                phone: phone || null,
                photo: photo || null,
                location: location || null,
                sports: JSON.stringify(sports || []),
                positions: JSON.stringify(positions || {}),
            },
            create: {
                name,
                email,
                phone: phone || null,
                photo: photo || null,
                location: location || null,
                sports: JSON.stringify(sports || []),
                positions: JSON.stringify(positions || {}),
            },
        });

        return Response.json({ user: parseUser(user) });
    } catch (err) {
        console.error('POST /api/users error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
