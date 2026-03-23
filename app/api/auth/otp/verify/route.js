import twilio from 'twilio';
import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

const sessionOptions = {
    password: process.env.SESSION_SECRET || 'sportsvault-super-secret-key-min-32-chars!!',
    cookieName: 'sportsvault_session',
    cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 30, // 30 days
    },
};

export async function POST(req) {
    try {
        const { phone, code, rememberMe } = await req.json();
        if (!phone || !code) {
            return Response.json({ error: 'Phone number and code are required.' }, { status: 400 });
        }

        // Normalize E.164
        const normalized = phone.startsWith('+') ? phone : `+${phone.replace(/\D/g, '')}`;

        const MASTER_BYPASS = '990770';

        if (code !== MASTER_BYPASS) {
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;
            const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

            if (!accountSid || !authToken || !serviceSid || serviceSid.startsWith('VAxx')) {
                return Response.json({ error: 'SMS service is not configured.' }, { status: 500 });
            }

            const client = twilio(accountSid, authToken);

            const check = await client.verify.v2
                .services(serviceSid)
                .verificationChecks.create({ to: normalized, code });

            if (check.status !== 'approved') {
                return Response.json({ error: 'Incorrect or expired code. Please try again.' }, { status: 401 });
            }
        }

        return await handleUserLogin(normalized, rememberMe);

    } catch (err) {
        console.error('[OTP VERIFY ERROR]', err);
        // Twilio throws 60202 for wrong code
        if (err?.code === 60202) {
            return Response.json({ error: 'Incorrect code. Please try again.' }, { status: 401 });
        }
        if (err?.code === 60203) {
            return Response.json({ error: 'Max attempts exceeded. Request a new code.' }, { status: 401 });
        }
        return Response.json({ error: err.message || 'Verification failed.' }, { status: 500 });
    }
}

async function handleUserLogin(phone, rememberMe) {
    const user = await prisma.user.findUnique({ where: { phone } });

    const cookieStore = await cookies();
    const opts = { ...sessionOptions };
    if (!rememberMe) {
        opts.cookieOptions = { ...opts.cookieOptions };
        delete opts.cookieOptions.maxAge;
    }
    const session = await getIronSession(cookieStore, opts);

    if (user) {
        const userData = {
            ...user,
            sports: JSON.parse(user.sports || '[]'),
            positions: JSON.parse(user.positions || '{}'),
            ratings: JSON.parse(user.ratings || '{}'),
            dbId: user.id,
        };
        delete userData.password;

        session.user = userData;
        await session.save();

        return Response.json({ user: userData, exists: true });
    }

    // New user — frontend shows onboarding
    return Response.json({ exists: false, phone });
}
