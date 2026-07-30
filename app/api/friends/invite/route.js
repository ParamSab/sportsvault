import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';

export async function POST(req) {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        const userId = session.user?.dbId || session.user?.id;
        if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

        const { friendIds, method, message } = await req.json();
        if (!Array.isArray(friendIds) || friendIds.length === 0) {
            return Response.json({ error: 'No friends selected' }, { status: 400 });
        }
        if (!['app', 'sms'].includes(method)) {
            return Response.json({ error: 'Invalid method' }, { status: 400 });
        }

        const smsLinks = [];
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sportsvault.co.in';
        let defaultMsg = message || `${session.user?.name || 'Your friend'} invited you to play on SportsVault!`;
        // Every invite must carry a destination — append the site link unless a
        // custom message already includes one.
        if (!defaultMsg.includes('sportsvault')) {
            defaultMsg += `\n\nJoin here 👉 ${appUrl}`;
        }

        // Batch-load all friend data in one query instead of N individual queries
        const friendUsers = await prisma.user.findMany({
            where: { id: { in: friendIds } },
            select: { id: true, phone: true, name: true }
        });
        const friendMap = Object.fromEntries(friendUsers.map(f => [f.id, f]));

        if (method === 'app') {
            // Batch create notifications
            await prisma.notification.createMany({
                data: friendIds.map(friendId => ({
                    userId: friendId,
                    title: 'Game Invite',
                    message: defaultMsg,
                })),
                skipDuplicates: true,
            });
        } else if (method === 'sms') {
            for (const friendId of friendIds) {
                const friend = friendMap[friendId];
                if (friend?.phone) {
                    const phone = friend.phone.replace(/^\+/, '');
                    const encodedMsg = encodeURIComponent(defaultMsg);
                    smsLinks.push({
                        friendId,
                        name: friend.name,
                        phone: friend.phone,
                        whatsappLink: `https://wa.me/${phone}?text=${encodedMsg}`,
                        smsLink: `sms:${friend.phone}?body=${encodedMsg}`
                    });
                }
            }
        }

        return Response.json({ success: true, smsLinks });
    } catch (err) {
        console.error('POST /api/friends/invite error:', err.message);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
