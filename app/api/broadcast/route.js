import twilio from 'twilio';

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

/**
 * POST /api/broadcast
 * Body: { gameId, recipients: [{name, phone}], gameTitle, date, time, location, mapLink, inviteLink }
 * Sends individual SMS to each recipient (Partiful-style Text Blast)
 */
export async function POST(req) {
    try {
        const {
            recipients,
            gameTitle,
            date,
            time,
            location,
            mapLink,
            inviteLink,
            sport,
            format,
            organizerName,
        } = await req.json();

        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_PHONE_NUMBER) {
            return Response.json({ error: 'Twilio not configured' }, { status: 503 });
        }

        if (!recipients || recipients.length === 0) {
            return Response.json({ error: 'No recipients provided' }, { status: 400 });
        }

        const validRecipients = recipients.filter(r => r.phone && r.phone.trim());
        if (validRecipients.length === 0) {
            return Response.json({ error: 'None of the selected contacts have a phone number.' }, { status: 400 });
        }

        // Build the message (Partiful-style: clean, personal, short)
        const mapLine = mapLink ? `\n📍 ${mapLink}` : '';
        const message =
            `Hey! ${organizerName} is organizing a ${format} ${sport} game and you're on the list 🏆\n\n` +
            `📅 ${date} at ${time}\n` +
            `📍 ${location}${mapLine}\n\n` +
            `RSVP here 👉 ${inviteLink}`;

        // Send individual SMS to each recipient (Partiful model — no group chat)
        const results = await Promise.allSettled(
            validRecipients.map(r =>
                client.messages.create({
                    body: message,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: r.phone,
                })
            )
        );

        const sent = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected');

        if (failed.length > 0) {
            console.error('Twilio failures:', failed.map(f => f.reason?.message));
        }

        return Response.json({
            success: true,
            sent,
            failed: failed.length,
            total: validRecipients.length,
        });

    } catch (error) {
        console.error('Broadcast error:', error);
        return Response.json({ error: error.message || 'Broadcast failed' }, { status: 500 });
    }
}
