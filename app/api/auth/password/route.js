import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

export async function POST(req) {
    try {
        const body = await req.json();
        const { email, password, rememberMe } = body;

        if (!email || !password) {
            return Response.json({ error: 'Email and password required' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user || !user.password) {
            return Response.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return Response.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        // Establish session
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);

        session.user = {
            id: user.id,
            dbId: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            photo: user.photo,
        };
        session.isLoaded = true;

        if (rememberMe) {
            session.maxAge = 30 * 24 * 60 * 60; // 30 days
        } else {
            session.maxAge = undefined; // Session cookie
        }

        await session.save();

        const frontendUser = {
            id: user.id,
            dbId: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            photo: user.photo,
            location: user.location,
            sports: user.sports,
            positions: user.positions,
            ratings: user.ratings || {},
            trustScore: user.trustScore,
            gamesPlayed: user.gamesPlayed,
            wins: user.wins,
            losses: user.losses,
            draws: user.draws,
            joined: user.createdAt,
        };

        return Response.json({ success: true, user: frontendUser });
    } catch (err) {
        console.error('Login error:', err);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
