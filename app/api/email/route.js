import { Resend } from 'resend';

export async function POST(req) {
    try {
        const body = await req.json();
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.error('RESEND_API_KEY is missing from environment variables.');
            return Response.json({ error: 'Email service not configured.' }, { status: 500 });
        }
        const resend = new Resend(apiKey);
        const { action, to, code, payload } = body;

        let subject = '';
        let htmlContext = '';

        if (action === 'send-otp') {
            subject = 'Your SportsVault Login Code';
            htmlContext = `
                <div style="font-family: sans-serif; text-align: center; padding: 40px; background: #f8fafc; border-radius: 12px;">
                    <h2 style="color: #0f172a; margin-bottom: 8px;">SportsVault Login</h2>
                    <p style="color: #475569; margin-bottom: 24px;">Here is your verification code to securely access your account:</p>
                    <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #3b82f6; background: #fff; padding: 16px 24px; border-radius: 8px; border: 1px solid #e2e8f0; display: inline-block;">
                        ${code}
                    </div>
                </div>
            `;
        } else if (action === 'send-broadcast') {
            subject = `You're invited to play ${payload.format}!`;
            htmlContext = `
                <div style="font-family: sans-serif; padding: 32px; background: #f8fafc; border-radius: 12px; max-width: 600px; margin: 0 auto;">
                    <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px;">
                        <span style="background: #3b82f6; color: white; padding: 4px 12px; border-radius: 99px; font-weight: 700; font-size: 14px;">Game Invite</span>
                        <h2 style="color: #0f172a; margin-top: 12px; margin-bottom: 0;">${payload.title || 'Game Details'}</h2>
                    </div>
                    
                    <p style="color: #334155; font-size: 16px; margin-bottom: 24px;">
                        Hey! I'm organizing a <b>${payload.format} ${payload.sport}</b> game and giving you first access to the list.
                    </p>

                    <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 32px;">
                        <table width="100%" cellPadding="8" cellSpacing="0">
                            <tr>
                                <td width="30" style="font-size: 20px;">📅</td>
                                <td style="color: #0f172a; font-weight: 600;">${payload.date}</td>
                            </tr>
                            <tr>
                                <td width="30" style="font-size: 20px;">⏰</td>
                                <td style="color: #0f172a; font-weight: 600;">${payload.time} <span style="color: #64748b; font-weight: 400;">(${payload.duration} min)</span></td>
                            </tr>
                            <tr>
                                <td width="30" style="font-size: 20px;">📍</td>
                                <td style="color: #0f172a; font-weight: 600;">${payload.location}</td>
                            </tr>
                        </table>
                        ${payload.mapLink ? `<div style="margin-top: 16px;"><a href="${payload.mapLink}" style="color: #3b82f6; text-decoration: none; font-weight: 600; display: inline-block;">View exact location on Google Maps →</a></div>` : ''}
                    </div>

                    <a href="${payload.link}" style="display: block; width: 100%; text-align: center; background: #0f172a; color: white; text-decoration: none; padding: 16px 0; border-radius: 8px; font-weight: 700; font-size: 16px;">
                        RSVP & Confirm Spot
                    </a>
                </div>
            `;
        } else {
            return Response.json({ error: 'Invalid action provided' }, { status: 400 });
        }

        const data = await resend.emails.send({
            from: 'SportsVault <onboarding@resend.dev>',
            to: Array.isArray(to) ? to : [to],
            subject: subject,
            html: htmlContext,
        });

        if (data.error) {
            console.error('Resend Error:', data.error);
            return Response.json({ error: data.error }, { status: 400 });
        }

        return Response.json({ success: true, data }, { status: 200 });

    } catch (error) {
        console.error('Email API Error:', error);
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
