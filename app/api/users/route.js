import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(req) {
    const { name, email, phone, photo, location, sports, positions, password } = await req.json();
    if (!email && !phone) return Response.json({ error: 'Email or phone required' }, { status: 400 });

    const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

    // --- Try Prisma first ---
    try {
        // Find existing user by email or phone
        let existingUser = null;
        if (email) existingUser = await prisma.user.findUnique({ where: { email } });
        if (!existingUser && phone) existingUser = await prisma.user.findUnique({ where: { phone } });

        let user;
        if (existingUser) {
            const updateData = {
                name,
                email: email ?? existingUser.email,
                phone: phone ?? existingUser.phone,
                photo: photo ?? existingUser.photo,
                location: location ?? existingUser.location,
                sports: JSON.stringify(sports || []),
                positions: JSON.stringify(positions || {}),
                ...(hashedPassword && { password: hashedPassword }),
            };
            user = await prisma.user.update({ where: { id: existingUser.id }, data: updateData });
        } else {
            user = await prisma.user.create({
                data: {
                    name,
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
        console.error('POST /api/users Prisma error — falling back to Supabase:', prismaErr.message);
    }

    // --- Supabase fallback ---
    try {
        const supabase = getSupabase();
        if (!supabase) return Response.json({ error: 'No database available' }, { status: 503 });

        const lookupCol = email ? 'email' : 'phone';
        const lookupVal = email || phone;
        const { data: existing } = await supabase.from('users').select('*').eq(lookupCol, lookupVal).maybeSingle();

        let userData;
        if (existing) {
            const { data: updated } = await supabase
                .from('users')
                .update({
                    name,
                    photo: photo || null,
                    location: location || null,
                    sports: JSON.stringify(sports || []),
                    positions: JSON.stringify(positions || {}),
                    ...(hashedPassword && { password: hashedPassword }),
                })
                .eq('id', existing.id)
                .select()
                .single();
            userData = updated || existing;
        } else {
            const { data: created, error } = await supabase
                .from('users')
                .insert({ name, email: email || null, phone: phone || null, photo: photo || null, location: location || null, sports: JSON.stringify(sports || []), positions: JSON.stringify(positions || {}), ...(hashedPassword && { password: hashedPassword }) })
                .select()
                .single();
            if (error) throw new Error(error.message);
            userData = created;
        }

        if (!userData) return Response.json({ error: 'Failed to save user' }, { status: 500 });
        const { password: _pw, ...safeUser } = userData;
        return Response.json({
            user: { ...safeUser, sports: JSON.parse(safeUser.sports || '[]'), positions: JSON.parse(safeUser.positions || '{}'), ratings: {} }
        });
    } catch (supaErr) {
        console.error('POST /api/users Supabase fallback error:', supaErr.message);
        return Response.json({ error: supaErr.message }, { status: 500 });
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

            if (user) {
                const { password: _pw, ...safeUser } = user;
                return Response.json({
                    user: {
                        ...safeUser,
                        sports: typeof safeUser.sports === 'string' ? JSON.parse(safeUser.sports || '[]') : (safeUser.sports || []),
                        positions: typeof safeUser.positions === 'string' ? JSON.parse(safeUser.positions || '{}') : (safeUser.positions || {}),
                        ratings: typeof safeUser.ratings === 'string' ? JSON.parse(safeUser.ratings || '{}') : (safeUser.ratings || {}),
                    }
                });
            }

            // Supabase fallback
            try {
                const supabase = getSupabase();
                if (supabase) {
                    const { data } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
                    if (data) {
                        const { password: _pw, ...safeUser } = data;
                        return Response.json({
                            user: {
                                ...safeUser,
                                sports: typeof safeUser.sports === 'string' ? JSON.parse(safeUser.sports || '[]') : (safeUser.sports || []),
                                positions: typeof safeUser.positions === 'string' ? JSON.parse(safeUser.positions || '{}') : (safeUser.positions || {}),
                                ratings: typeof safeUser.ratings === 'string' ? JSON.parse(safeUser.ratings || '{}') : (safeUser.ratings || {}),
                            }
                        });
                    }
                }
            } catch (_) {}
            
            return Response.json({ error: 'Player not found' }, { status: 404 });
        }

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
