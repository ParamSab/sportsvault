import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

function safeParse(value, fallback) {
    if (value == null) return fallback;
    if (typeof value !== 'string') return value ?? fallback;
    try {
        return JSON.parse(value) ?? fallback;
    } catch {
        return fallback;
    }
}

function toFrontendUser(user) {
    return {
        id: user.id,
        dbId: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        photo: user.photo,
        location: user.location,
        sports: safeParse(user.sports, []),
        positions: safeParse(user.positions, {}),
        ratings: safeParse(user.ratings, {}),
        trustScore: user.trustScore,
        gamesPlayed: user.gamesPlayed,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        joined: user.createdAt || user.created_at,
    };
}

// Thrown when neither Prisma nor the Supabase fallback could be reached, so we
// genuinely don't know whether the user exists (vs. a confirmed "not found").
class DatabaseUnavailableError extends Error {}

async function findUserByEmail(email) {
    try {
        return await prisma.user.findUnique({ where: { email } });
    } catch (prismaErr) {
        console.error('[password login] Prisma error, falling back to Supabase:', prismaErr.message);
    }

    const supabase = getSupabase();
    if (!supabase) throw new DatabaseUnavailableError();

    const { data, error } = await supabase
        .from('User')
        .select('*')
        .eq('email', email)
        .maybeSingle();

    if (error) {
        console.error('[password login] Supabase fallback error:', error.message);
        throw new DatabaseUnavailableError();
    }

    return data;
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { email, password, rememberMe } = body;

        if (!email || !password) {
            return Response.json({ error: 'Email and password required' }, { status: 400 });
        }

        const normalizedEmail = email.toLowerCase().trim();
        let user;
        try {
            user = await findUserByEmail(normalizedEmail);
        } catch (lookupErr) {
            if (lookupErr instanceof DatabaseUnavailableError) {
                return Response.json({ error: 'Database unavailable' }, { status: 503 });
            }
            throw lookupErr;
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

        const frontendUser = toFrontendUser(user);
        session.user = {
            id: frontendUser.id,
            dbId: frontendUser.dbId,
            name: frontendUser.name,
            email: frontendUser.email,
            phone: frontendUser.phone,
            photo: frontendUser.photo,
        };
        session.isLoaded = true;

        if (rememberMe) {
            session.maxAge = 30 * 24 * 60 * 60; // 30 days
        } else {
            session.maxAge = undefined; // Session cookie
        }

        await session.save();

        return Response.json({ success: true, user: frontendUser });
    } catch (err) {
        console.error('Login error:', err);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
