import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';

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

        const authKey = process.env.MSG91_AUTH_KEY;
        const templateId = process.env.MSG91_REMINDER_TEMPLATE_ID || '';

        for (const game of activeGames) {
            const gameStart = new Date(`${game.date}T${game.time}+05:30`);
            if (isNaN(gameStart.getTime())) continue;

            const reminderThreshold = new Date(gameStart.getTime() - (game.reminderHours * 60 * 60 * 1000));
            
            if (now >= reminderThreshold && now < gameStart) {
                const playersToSms = game.rsvps.map(r => r.player).filter(p => p && p.phone);

                if (authKey && templateId && playersToSms.length > 0) {
                    const recipients = playersToSms.map(player => ({
                        mobiles: String(player.phone).replace(/[^0-9]/g, ''),
                        var1: game.title,
                        var2: game.reminderHours.toString(),
                        var3: game.location
                    }));

                    try {
                        const url = 'https://control.msg91.com/api/v5/flow/';
                        const response = await fetch(url, {
                            method: 'POST',
                            headers: { 'authkey': authKey, 'content-type': 'application/json' },
                            body: JSON.stringify({
                                template_id: templateId,
                                short_url: '0',
                                recipients: recipients
                            })
                        });
                        const msgData = await response.json();
                        if (msgData.type === 'error') {
                            console.error('MSG91 Flow Error:', msgData.message);
                        } else {
                            sentCount += recipients.length;
                        }
                    } catch (smsErr) {
                        console.error('MSG91 JSON SDK Error', smsErr.message);
                    }
                }

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
