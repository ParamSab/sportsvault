import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function POST(req) {
  try {
    const session = await getSession(req);
    if (!session?.user?.id) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { friendIds, method, message } = await req.json();
    if (!Array.isArray(friendIds) || friendIds.length === 0) {
      return Response.json({ error: 'No friends selected' }, { status: 400 });
    }
    if (!['app', 'sms'].includes(method)) {
      return Response.json({ error: 'Invalid method' }, { status: 400 });
    }

    const senderId = session.user.id;
    const invites = [];
    const smsLinks = [];

    for (const friendId of friendIds) {
      // create invite record
      const invite = await prisma.friendInvite.create({
        data: {
          senderId,
          friendId,
          method,
          message,
        },
      });
      invites.push(invite);

      if (method === 'app') {
        // create in‑app notification (reuse existing Notification model)
        await prisma.notification.create({
          data: {
            userId: friendId,
            title: `${session.user.name || 'A user'} invited you to a game`,
            message: message || 'You have a new invitation.',
            action: '/invite',
          },
        });
      } else if (method === 'sms') {
        // fetch friend's phone number
        const friend = await prisma.user.findUnique({
          where: { id: friendId },
          select: { phone: true },
        });
        if (friend?.phone) {
          const encodedMsg = encodeURIComponent(message || 'You have a new invitation.');
          const phone = friend.phone.replace(/^\+/, ''); // remove leading + for wa.me
          const whatsappLink = `https://wa.me/${phone}?text=${encodedMsg}`;
          const smsLink = `sms:${friend.phone}?body=${encodedMsg}`;
          smsLinks.push({ friendId, phone: friend.phone, whatsappLink, smsLink });
        }
      }
    }

    return Response.json({ success: true, invites, smsLinks }, { status: 200 });
  } catch (err) {
    console.error('Invite error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
