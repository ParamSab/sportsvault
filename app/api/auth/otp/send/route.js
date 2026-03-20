import { Resend } from 'resend';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

const resend = new Resend(process.env.RESEND_API_KEY);

const sessionOptions = {
    password: process.env.SESSION_SECRET || 'sportsvault-super-secret-key-min-32-chars!!',
    cookieName: 'sportsvault_session',
    cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30, // 30 days
    },
};

export async function POST(req) {
    try {
        const { email } = await req.json();
        if (!email) return Response.json({ error: 'Email required' }, { status: 400 });

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Diagnostic: Check for Resend Key
        if (!process.env.RESEND_API_KEY) {
            console.error("Missing RESEND_API_KEY on Vercel");
            return Response.json({ error: 'Email configuration is incomplete (Missing API Key).' }, { status: 500 });
        }

        // Send Email via Resend
        const { data, error } = await resend.emails.send({
            from: 'SportsVault <verify@resend.dev>', // Use verified domain in prod, resend.dev for testing
            to: [email],
            subject: 'Your SportsVault Verification Code',
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #1f2937;">
                    <h2 style="color: #6366f1;">Welcome to SportsVault</h2>
                    <p>Your verification code is:</p>
                    <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #4f46e5; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p style="font-size: 14px; color: #6b7280;">This code will expire in 10 minutes.</p>
                </div>
            `
        });

        if (error) {
            console.error("Resend Error:", error);
            // Fallback for missing domain verification in Resend free tier
            if (error.message?.includes('from address')) {
                return Response.json({ error: 'Email verification currently limited to authorized users. Please contact support.' }, { status: 403 });
            }
            throw new Error(error.message);
        }

        // Store OTP in session
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        
        session.temp = {
            otp,
            email,
            expiresAt: Date.now() + 10 * 60 * 1000 // 10 mins
        };
        await session.save();

        console.log(`OTP ${otp} sent to ${email}`);
        return Response.json({ success: true });
    } catch (error) {
        console.error("Email Send Error:", error);
        return Response.json({ error: error.message || 'Failed to send verification code' }, { status: 500 });
    }
}
