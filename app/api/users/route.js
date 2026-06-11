import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';
import {
    getFreshPendingVerifiedAuth,
    normalizeEmail,
    normalizePhone,
    serializeUser,
} from '@/lib/auth';
import { findLocalUserByEmail, findLocalUserById, findLocalUserByPhone, upsertLocalUser } from '@/lib/localUserStore';

function canWriteUser({ sessionUserId, pendingAuth, existingUser, email, phone }) {
    if (sessionUserId && existingUser?.id === sessionUserId) return true;
    if (!pendingAuth) return false;

    const emailMatches = email && pendingAuth.email && email === pendingAuth.email;
    const phoneMatches = phone && pendingAuth.phone && phone === pendingAuth.phone;
    if (!emailMatches && !phoneMatches) return false;

    if (!existingUser) return true;
    return (emailMatches && existingUser.email === email) || (phoneMatches && existingUser.phone === phone);
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { name, photo, location, sports, positions, password } = body;
        const email = normalizeEmail(body.email);
        const phone = normalizePhone(body.phone);
        if (!email && !phone) return Response.json({ error: 'Email or phone required' }, { status: 400 });

        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        const sessionUserId = session.user?.dbId || session.user?.id;
        const pendingAuth = getFreshPendingVerifiedAuth(session);

        const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

        try {
            let existingUser = null;
            if (sessionUserId) existingUser = await prisma.user.findUnique({ where: { id: sessionUserId } });
            if (!existingUser && email) existingUser = await prisma.user.findUnique({ where: { email } });
            if (!existingUser && phone) existingUser = await prisma.user.findUnique({ where: { phone } });

            if (!canWriteUser({ sessionUserId, pendingAuth, existingUser, email, phone })) {
                return Response.json({ error: 'Verified login required to save this account.' }, { status: 401 });
            }

            let user;
            if (existingUser) {
                user = await prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        name: name || existingUser.name,
                        email: email ?? existingUser.email,
                        phone: phone ?? existingUser.phone,
                        photo: photo ?? existingUser.photo,
                        location: location ?? existingUser.location,
                        sports: JSON.stringify(sports || []),
                        positions: JSON.stringify(positions || {}),
                        ...(hashedPassword && { password: hashedPassword }),
                    },
                });
            } else {
                user = await prisma.user.create({
                    data: {
                        name: name || 'Player',
                        email: email || null,
                        phone: phone || null,
                        photo: photo || null,
                        location: location || null,
                        sports: JSON.stringify(sports || []),
                        positions: JSON.stringify(positions || {}),
                        ...(hashedPassword && { password: hashedPassword }),
                    },
                });
            }

            const userData = serializeUser(user);
            session.user = userData;
            delete session.pendingVerifiedAuth;
            await session.save();
            return Response.json({ user: userData });
        } catch (prismaErr) {
            console.error('POST /api/users Prisma error, falling back to Supabase:', prismaErr.message);
        }

        const lookupCol = email ? 'email' : 'phone';
        const lookupVal = email || phone;
        const supabase = getSupabase();
        if (!supabase) {
            let existing = null;
            if (sessionUserId) existing = await findLocalUserById(sessionUserId);
            if (!existing && email) existing = await findLocalUserByEmail(email);
            if (!existing && phone) existing = await findLocalUserByPhone(phone);

            if (!canWriteUser({ sessionUserId, pendingAuth, existingUser: existing, email, phone })) {
                return Response.json({ error: 'Verified login required to save this account.' }, { status: 401 });
            }

            const localUser = await upsertLocalUser({
                id: existing?.id,
                name,
                email,
                phone,
                photo,
                location,
                sports: JSON.stringify(sports || []),
                positions: JSON.stringify(positions || {}),
                ...(hashedPassword && { password: hashedPassword }),
            });
            const serialized = serializeUser(localUser);
            session.user = serialized;
            delete session.pendingVerifiedAuth;
            await session.save();
            return Response.json({ user: serialized, localFallback: true });
        }

        const { data: existing } = await supabase.from('users').select('*').eq(lookupCol, lookupVal).maybeSingle();

        if (!canWriteUser({ sessionUserId, pendingAuth, existingUser: existing, email, phone })) {
            return Response.json({ error: 'Verified login required to save this account.' }, { status: 401 });
        }

        let userData;
        if (existing) {
            const { data: updated, error } = await supabase
                .from('users')
                .update({
                    name: name || existing.name,
                    email: email ?? existing.email,
                    phone: phone ?? existing.phone,
                    photo: photo ?? existing.photo,
                    location: location ?? existing.location,
                    sports: JSON.stringify(sports || []),
                    positions: JSON.stringify(positions || {}),
                    ...(hashedPassword && { password: hashedPassword }),
                })
                .eq('id', existing.id)
                .select()
                .single();
            if (error) throw new Error(error.message);
            userData = updated;
        } else {
            const { data: created, error } = await supabase
                .from('users')
                .insert({
                    name: name || 'Player',
                    email: email || null,
                    phone: phone || null,
                    photo: photo || null,
                    location: location || null,
                    sports: JSON.stringify(sports || []),
                    positions: JSON.stringify(positions || {}),
                    ...(hashedPassword && { password: hashedPassword }),
                })
                .select()
                .single();
            if (error) throw new Error(error.message);
            userData = created;
        }

        const serialized = serializeUser(userData);
        session.user = serialized;
        delete session.pendingVerifiedAuth;
        await session.save();

        // Sync to Prisma so search and friends features work (fire-and-forget)
        prisma.user.upsert({
            where: { id: userData.id },
            create: {
                id: userData.id,
                name: userData.name || 'Player',
                email: userData.email || null,
                phone: userData.phone || null,
                photo: userData.photo || null,
                location: userData.location || null,
                sports: typeof userData.sports === 'string' ? userData.sports : JSON.stringify(userData.sports || []),
                positions: typeof userData.positions === 'string' ? userData.positions : JSON.stringify(userData.positions || {}),
            },
            update: {
                name: userData.name || 'Player',
                email: userData.email || null,
                phone: userData.phone || null,
                photo: userData.photo || null,
                location: userData.location || null,
                sports: typeof userData.sports === 'string' ? userData.sports : JSON.stringify(userData.sports || []),
                positions: typeof userData.positions === 'string' ? userData.positions : JSON.stringify(userData.positions || {}),
            },
        }).catch(e => console.error('[users POST] Prisma sync error (non-fatal):', e.message));

        return Response.json({ user: serialized });
    } catch (err) {
        console.error('POST /api/users error:', err.message);
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(req) {
    try {
        const { getIronSession } = await import('iron-session');
        const { cookies } = await import('next/headers');
        const { sessionOptions } = await import('@/lib/session');

        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        const userId = session.user?.dbId || session.user?.id;
        if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { positions, sports } = body;
        const updateData = {};
        if (positions !== undefined) updateData.positions = JSON.stringify(positions);
        if (sports !== undefined) updateData.sports = JSON.stringify(sports);

        if (Object.keys(updateData).length === 0) {
            return Response.json({ error: 'Nothing to update' }, { status: 400 });
        }

        try {
            const user = await prisma.user.update({ where: { id: userId }, data: updateData });
            // Also update the session so it stays in sync
            const updatedSessionUser = {
                ...session.user,
                ...(positions !== undefined && { positions }),
                ...(sports !== undefined && { sports }),
            };
            session.user = updatedSessionUser;
            await session.save();
            const { password: _pw, ...safeUser } = user;
            return Response.json({
                user: {
                    ...safeUser,
                    sports: JSON.parse(safeUser.sports || '[]'),
                    positions: JSON.parse(safeUser.positions || '{}'),
                    ratings: JSON.parse(safeUser.ratings || '{}'),
                }
            });
        } catch (prismaErr) {
            console.error('PATCH /api/users Prisma error:', prismaErr.message);
            // Supabase fallback
            const supabase = getSupabase();
            if (supabase) {
                await supabase.from('users').update(updateData).eq('id', userId);
            }
            return Response.json({ success: true });
        }
    } catch (err) {
        console.error('PATCH /api/users error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const q = searchParams.get('q');
        const id = searchParams.get('id');

        if (id) {
            let user = null;
            try {
                user = await prisma.user.findUnique({ where: { id } });
            } catch (_) {}

            if (user) return Response.json({ user: serializeUser(user) });

            try {
                const supabase = getSupabase();
                if (supabase) {
                    const { data } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
                    if (data) return Response.json({ user: serializeUser(data) });
                }
            } catch (_) {}

            return Response.json({ error: 'Player not found' }, { status: 404 });
        }

        if (!q || q.length < 2) return Response.json({ users: [] });

        let users = [];
        try {
            users = await prisma.user.findMany({
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
        } catch (_) {}

        // Also search Supabase users table (catches users created via the Supabase fallback path)
        try {
            const supabase = getSupabase();
            if (supabase && users.length < 10) {
                const { data: sbUsers } = await supabase
                    .from('users')
                    .select('id, name, email, phone, photo, location')
                    .or(`name.ilike.%${q}%,phone.like.%${q}%`)
                    .limit(10 - users.length);
                if (sbUsers?.length) {
                    const existingIds = new Set(users.map(u => u.id));
                    users = [...users, ...sbUsers.filter(u => !existingIds.has(u.id))];
                }
            }
        } catch (_) {}

        return Response.json({ users });
    } catch (err) {
        return Response.json({ users: [] });
    }
}
