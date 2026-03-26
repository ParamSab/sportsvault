import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get('q');
        
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        const currentUserId = session.user?.dbId || session.user?.id;

        if (!currentUserId) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!query || query.length < 3) {
            return Response.json({ users: [] });
        }

        // Try Prisma first
        try {
            const users = await prisma.user.findMany({
                where: {
                    AND: [
                        { id: { not: currentUserId } },
                        {
                            OR: [
                                { name: { contains: query, mode: 'insensitive' } },
                                { phone: { contains: query } }
                            ]
                        }
                    ]
                },
                select: { id: true, name: true, photo: true, sports: true, positions: true, ratings: true },
                take: 20
            });
            return Response.json({ users });
        } catch (prismaErr) {
            console.error('Prisma search failed, trying Supabase:', prismaErr.message);
        }

        // Supabase Fallback
        const supabase = getSupabase();
        if (supabase) {
            const { data } = await supabase
                .from('users')
                .select('id, name, photo, sports, positions, ratings')
                .neq('id', currentUserId)
                .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
                .limit(20);

            if (data) {
                return Response.json({ users: data });
            }
        }

        return Response.json({ users: [] });
    } catch (err) {
        console.error('User Search API Error:', err);
        return Response.json({ error: 'Search failed' }, { status: 500 });
    }
}
