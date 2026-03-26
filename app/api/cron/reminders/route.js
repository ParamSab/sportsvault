// Cron job: Send reminders via Twilio SMS to confirmed game attendees
import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import twilio from 'twilio';

export const dynamic = 'force-dynamic';

export async function GET(req) {
    const authHeader = req.headers.get('authorization');
    const secret = process.env.CRON_SECRET;
    
    if (secret && authHeader !== `Bearer ${secret}`) {
        console.warn('Unauthorized CRON attempt');
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const now = new Date();
        
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
        let skipReasons = [];
        
        if (activeGames.length === 0) {
            return Response.json({ success: true, sent: 0, msg: "No active un-reminded games." });
        }

        const twilioSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
        const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
        
        const twilioAvailable = twilioSid && twilioAuth && twilioFrom;
        let client = null;
        if (twilioAvailable) {
            client = twilio(twilioSid, twilioAuth);
        }

        for (const game of activeGames) {
            const gameStart = new Date(`${game.date}T${game.time}+05:30`);
            if (isNaN(gameStart.getTime())) {
                skipReasons.push(`Game ${game.id}: Invalid format (${game.date}T${game.time})`);
                continue;
            }

            const reminderThreshold = new Date(gameStart.getTime() - (game.reminderHours * 60 * 60 * 1000));
            
            if (now >= reminderThreshold && now < gameStart) {
                const playersToSms = game.rsvps.map(r => r.player).filter(p => p && p.phone);

                if (playersToSms.length === 0) {
                    skipReasons.push(`Game ${game.id}: 0 participants with phone numbers`);
                }

                if (client && playersToSms.length > 0) {
                    for (const player of playersToSms) {
                        let phone = String(player.phone).replace(/[^0-9+]/g, '');
                        // Ensure E.164 format (add Indian country code if needed)
                        if (!phone.startsWith('+')) {
                            phone = phone.length === 10 ? `+91${phone}` : `+${phone}`;
                        }
                        
                        const message = `⚽ SportsVault Reminder: "${game.title}" starts in ${game.reminderHours}h at ${game.location}. See you on the pitch!`;
                        
                        try {
                            await client.messages.create({
                                body: message,
                                from: twilioFrom,
                                to: phone
                            });
                            sentCount++;
                        } catch (smsErr) {
                            console.error(`Twilio SMS error for player ${player.id}:`, smsErr.message);
                            skipReasons.push(`Game ${game.id}, Player ${player.id}: ${smsErr.message}`);
                        }
                    }
                } else if (!client) {
                    skipReasons.push(`Game ${game.id}: Twilio not configured (missing env vars)`);
                }

                // Mark reminders sent regardless of SMS success
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
            } else {
                const diffMin = Math.round((gameStart.getTime() - now.getTime()) / 60000);
                skipReasons.push(`Game ${game.id}: Outside window (Starts in ${diffMin} min, Threshold is ${game.reminderHours}h)`);
            }
        }

        return Response.json({ 
            success: true, 
            sent: sentCount, 
            processedGames: activeGames.length,
            skipReasons: skipReasons 
        });
    } catch (err) {
        console.error('CRON Reminders fatal error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
