import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';
import { findLocalUserByEmail } from '@/lib/localUserStore';
import { serializeUser } from '@/lib/auth';

export async function POST(req) {
    try {
        const body = await req.json();
        const { email, password, rememberMe } = body;

        if (!email || !password) {
            return Response.json({ error: 'Email and password required' }, { status: 400 });
        }

        const normalizedEmail = email.toLowerCase().trim();

        let user = null;
        try {
            user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        } catch (prismaErr) {
            console.error('Password login Prisma error:', prismaErr.message);
        }

        if (!user) {
            try {
                const supabase = getSupabase();
                if (supabase) {
                    const { data } = await supabase.from('users').select('*').eq('email', normalizedEmail).maybeSingle();
                    if (data) user = data;
                }
            } catch (_) {}
        }

        if (!user) {
            user = await findLocalUserByEmail(normalizedEmail).catch(() => null);
        }

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

        session.user = serializeUser(user);
        session.isLoaded = true;

        if (rememberMe) {
            session.maxAge = 30 * 24 * 60 * 60; // 30 days
        } else {
            session.maxAge = undefined; // Session cookie
        }

        await session.save();

        const frontendUser = {
            ...session.user,
            joined: user.createdAt,
        };

        return Response.json({ success: true, user: frontendUser });
    } catch (err) {
        console.error('Login error:', err);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
