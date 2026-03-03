import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

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
        const { email, password, rememberMe } = await req.json();
        if (!email) return Response.json({ error: 'Email required' }, { status: 400 });

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (user) {
            // Check password if set
            if (user.password) {
                const isMatch = await bcrypt.compare(password || '', user.password);
                if (!isMatch) {
                    return Response.json({ exists: true, error: 'Invalid password' }, { status: 401 });
                }
            }

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
            // Don't leak password
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
