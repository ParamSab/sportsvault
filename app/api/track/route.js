import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

// First-party analytics sink. Best-effort: any failure is swallowed so
// tracking can never affect the user experience. Always returns 200.
export async function POST(req) {
    try {
        let body;
        try {
            body = await req.json();
        } catch {
            return Response.json({ ok: true });
        }

        const name = typeof body?.name === 'string' ? body.name.slice(0, 64) : null;
        if (!name) return Response.json({ ok: true });

        // Resolve the acting user from the session (never trust a client-supplied id).
        let userId = null;
        try {
            const cookieStore = await cookies();
            const session = await getIronSession(cookieStore, sessionOptions);
            userId = session.user?.dbId || session.user?.id || null;
        } catch { /* no session — anonymous event */ }

        let props = null;
        if (body.props && typeof body.props === 'object') {
            try { props = JSON.stringify(body.props).slice(0, 2000); } catch { props = null; }
        }

        try {
            await prisma.event.create({ data: { name, userId, props } });
        } catch { /* table missing / db down — drop the event silently */ }

        return Response.json({ ok: true });
    } catch {
        return Response.json({ ok: true });
    }
}
