// API route to send immediate reminder to a player for a game via Twilio
import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    const sessionUserId = session.user?.dbId || session.user?.id;

    // Allow non-session calls (e.g. from handleHostAction) if triggered server-side,
    // but still do a best-effort auth check
    const { gameId, playerId, type } = await req.json();
    
    if (!gameId || !playerId) {
      return Response.json({ error: 'gameId and playerId required' }, { status: 400 });
    }

    // Fetch game
    const game = await prisma.game.findUnique({ 
      where: { id: gameId }, 
      select: { organizerId: true, reminderHours: true, title: true, date: true, time: true, location: true } 
    });
    if (!game) return Response.json({ error: 'Game not found' }, { status: 404 });

    // Check auth only for manual (non-approval-auto) calls
    if (sessionUserId && type !== 'approval' && sessionUserId !== game.organizerId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch player
    const player = await prisma.user.findUnique({ where: { id: playerId }, select: { phone: true, name: true } });
    if (!player || !player.phone) {
      return Response.json({ error: 'Player phone not available' }, { status: 400 });
    }

    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

    if (!twilioSid || !twilioAuth || !twilioFrom) {
      console.warn('Twilio credentials not configured – skipping SMS');
      return Response.json({ success: false, reason: 'Twilio not configured' });
    }

    let phone = String(player.phone).replace(/[^0-9+]/g, '');
    if (!phone.startsWith('+')) {
      phone = phone.length === 10 ? `+91${phone}` : `+${phone}`;
    }

    const messageBody = type === 'approval'
      ? `🎉 You're in! Your spot for "${game.title}" has been confirmed. See you at ${game.location}! Game info: https://sportsvault.co.in/?game=${game.id}`
      : type === 'nudge'
      ? `👋 Quick nudge from the organizer of "${game.title}"! We're looking forward to seeing you at ${game.location}. Join here: https://sportsvault.co.in/?game=${game.id}`
      : `⚽ SportsVault Reminder: "${game.title}" starts in ${game.reminderHours || 2}h at ${game.location}. Don't be late!`;

    const twilio = (await import('twilio')).default;
    const client = twilio(twilioSid, twilioAuth);

    await client.messages.create({
      body: messageBody,
      from: twilioFrom,
      to: phone
    });

    return Response.json({ success: true, message: 'Reminder sent via Twilio' });
  } catch (err) {
    console.error('Reminder send error', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
