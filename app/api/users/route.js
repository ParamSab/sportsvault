import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(req) {
    const { name, email, phone, photo, location, sports, positions, password } = await req.json();
    if (!email && !phone) return Response.json({ error: 'Email or phone required' }, { status: 400 });

    const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;
    const updateData = {
        name,
        email: email || null,
        phone: phone || null,
        photo: photo || null,
        location: location || null,
        sports: JSON.stringify(sports || []),
        positions: JSON.stringify(positions || {}),
        ...(hashedPassword && { password: hashedPassword }),
    };

    // --- Try Prisma first ---
    try {
        const whereClause = email ? { email } : { phone };
        const user = await prisma.user.upsert({ where: whereClause, update: updateData, create: updateData });
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

        // Find existing user
        const lookupCol = email ? 'email' : 'phone';
        const lookupVal = email || phone;
        const { data: existing } = await supabase.from('users').select('*').eq(lookupCol, lookupVal).maybeSingle();

        let userData;
        if (existing) {
            const { data: updated } = await supabase
                .from('users')
                .update({ name, photo: photo || null, location: location || null, sports: JSON.stringify(sports || []), positions: JSON.stringify(positions || {}), ...(hashedPassword && { password: hashedPassword }) })
                .eq('id', existing.id)
                .select()
                .single();
            userData = updated || existing;
        } else {
            const { data: created, error } = await supabase
                .from('users')
                .insert({ ...updateData })
                .select()
                .single();
            if (error) throw new Error(error.message);
            userData = created;
        }

        if (!userData) return Response.json({ error: 'Failed to save user' }, { status: 500 });
        const { password: _pw, ...safeUser } = userData;
        return Response.json({
            user: {
                ...safeUser,
                sports: JSON.parse(safeUser.sports || '[]'),
                positions: JSON.parse(safeUser.positions || '{}'),
                ratings: {},
            }
        });
    } catch (supaErr) {
        console.error('POST /api/users Supabase fallback error:', supaErr.message);
        return Response.json({ error: supaErr.message }, { status: 500 });
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
