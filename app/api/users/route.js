import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
export async function POST(req) {
    try {
        const { name, password, email, phone, photo, location, sports, positions } = await req.json();
        if (!email && !phone) return Response.json({ error: 'Email or phone required' }, { status: 400 });

        // Try to find existing user by email first, then by phone
        let existingUser = null;
        if (email) {
            existingUser = await prisma.user.findUnique({ where: { email } });
        }
        if (!existingUser && phone) {
            existingUser = await prisma.user.findUnique({ where: { phone } });
        }

        let user;
        if (existingUser) {
            // Merge data: set email if missing, update other fields
            let updateData = {
                name,
                email: email ?? existingUser.email,
                phone: phone ?? existingUser.phone,
                photo: photo ?? existingUser.photo,
                location: location ?? existingUser.location,
                sports: JSON.stringify(sports || []),
                positions: JSON.stringify(positions || {}),
            };

            if (password) {
                updateData.password = await bcrypt.hash(password, 10);
            }

            user = await prisma.user.update({
                where: { id: existingUser.id },
                data: updateData,
            });
        } else {
            // No existing user, create a new one
            let hashedPassword = null;
            if (password) {
                hashedPassword = await bcrypt.hash(password, 10);
            }

            user = await prisma.user.create({
                data: {
                    name,
                    password: hashedPassword,
                    email: email || null,
                    phone: phone || null,
                    photo: photo || null,
                    location: location || null,
                    sports: JSON.stringify(sports || []),
                    positions: JSON.stringify(positions || {}),
                },
            });
        }

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
