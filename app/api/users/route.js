import { prisma } from '@/lib/prisma';

export async function POST(req) {
    try {
        const { name, email, phone, photo, location, sports, positions } = await req.json();
        if (!email && !phone) return Response.json({ error: 'Email or phone required' }, { status: 400 });

        const whereClause = email ? { email } : { phone };
        const user = await prisma.user.upsert({
            where: whereClause,
            update: {
                name,
                email: email || null,
                phone: phone || null,
                photo: photo || null,
                location: location || null,
                sports: JSON.stringify(sports || []),
                positions: JSON.stringify(positions || {}),
            },
            create: {
                name,
                email: email || null,
                phone: phone || null,
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
                    { name: { contains: q, mode: 'insensitive' } },
                    { email: { contains: q, mode: 'insensitive' } },
                    { phone: { contains: q } },
                ],
            },
            take: 10,
            select: { id: true, name: true, email: true, phone: true, photo: true, location: true },
        });
        return Response.json({ users });
    } catch (err) {
        return Response.json({ users: [] });
    }
}
