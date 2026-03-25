import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import twilio from 'twilio';

// Disable edge runtime because Twilio Node SDK requires Node features
export const dynamic = 'force-dynamic';

export async function GET(req) {
    // Basic Cron Authentication
    // Vercel auto-injects CRON_SECRET header if configured
    const authHeader = req.headers.get('authorization');
    const secret = process.env.CRON_SECRET;
    
    // Allow local testing if secret is bypassing (e.g. dev mode)
    if (secret && authHeader !== `Bearer ${secret}`) {
        // Log unauthorized attempt
        console.warn('Unauthorized CRON attempt');
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const now = new Date();
        
        // Find games that are 'open', have reminders enabled, and haven't triggered sent yet
        const activeGames = await prisma.game.findMany({
            where: {
                status: 'open',
                remindersSent: false,
                reminderHours: { gt: 0 }
            },
            include: {
                rsvps: {
                    where: { status: 'yes' },
                    include: { player: true }
                }
            }
        });

        let sentCount = 0;
        
        if (activeGames.length === 0) {
            return Response.json({ success: true, sent: 0, msg: "No active un-reminded games." });
        }

        const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

        for (const game of activeGames) {
            // Standardize game ISO string target
            const gameStart = new Date(`${game.date}T${game.time}`);
            if (isNaN(gameStart.getTime())) continue;

            const reminderThreshold = new Date(gameStart.getTime() - (game.reminderHours * 60 * 60 * 1000));
            
            // Check if current time has passed the reminder barrier but game hasn't started yet
            // If now is past gameStart, we shouldn't send reminders since the game is over
            if (now >= reminderThreshold && now < gameStart) {
                const playersToSms = game.rsvps.map(r => r.player).filter(p => p && p.phone);

                await Promise.all(playersToSms.map(async (player) => {
                    try {
                        const msg = `[SportsVault]\nReminder: Your ${game.sport} game "${game.title}" at ${game.location} starts in exactly ${game.reminderHours} hours (at ${game.time})! See you on the pitch.`;
                        await twilioClient.messages.create({
                            body: msg,
                            from: process.env.TWILIO_PHONE_NUMBER,
                            to: player.phone,
                        });
                        sentCount++;
                    } catch (smsErr) {
                        console.error('Twilio Error for phone', player.phone, smsErr.message);
                    }
                }));

                // Atomically lock this game from future reminders
                try {
                    await prisma.game.update({
                        where: { id: game.id },
                        data: { remindersSent: true }
                    });
                } catch (pe) { console.error('Prisma flag update failed', pe.message); }

                try {
                    const supabase = getSupabase();
                    if (supabase) {
                        await supabase.from('saved_games').update({ reminders_sent: true }).eq('game_id', game.id);
                    }
                } catch (se) { console.error('Supabase backup flag update failed', se.message); }
            }
        }

        return Response.json({ success: true, sent: sentCount, processedGames: activeGames.length });
    } catch (err) {
        console.error('CRON Reminders fatal error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
