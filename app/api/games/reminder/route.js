// API route to send immediate reminder to a player for a game
import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);
  const sessionUserId = session.user?.dbId || session.user?.id;

  if (!sessionUserId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { gameId, playerId } = await req.json();

  // Verify organizer
  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { organizerId: true, reminderHours: true, title: true, date: true, time: true, location: true } });
  if (!game) return Response.json({ error: 'Game not found' }, { status: 404 });
  if (sessionUserId !== game.organizerId) return Response.json({ error: 'Forbidden' }, { status: 403 });

  // Fetch player
  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { phone: true, name: true } });
  if (!player || !player.phone) return Response.json({ error: 'Player phone not available' }, { status: 400 });

  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_REMINDER_TEMPLATE_ID;
  if (!authKey || !templateId) return Response.json({ error: 'MSG91 config missing' }, { status: 500 });

  const recipients = [{
    mobiles: String(player.phone).replace(/[^0-9]/g, ''),
    var1: game.title,
    var2: String(game.reminderHours || ''),
    var3: game.location
  }];

  try {
    const url = 'https://control.msg91.com/api/v5/flow/';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'authkey': authKey, 'content-type': 'application/json' },
      body: JSON.stringify({ template_id: templateId, short_url: '0', recipients })
    });
    const msgData = await response.json();
    if (msgData.type === 'error') {
      console.error('MSG91 Flow Error:', msgData.message);
      return Response.json({ error: msgData.message }, { status: 500 });
    }
    return Response.json({ success: true, message: 'Reminder sent' });
  } catch (err) {
    console.error('Reminder send error', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
