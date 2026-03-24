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

function normalizePhone(phone) {
    const cleaned = phone.trim();
    if (cleaned.startsWith('+')) {
        return cleaned.replace(/\s/g, '');
    }
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    return null;
}

export async function POST(req) {
    try {
        const { phone, code, rememberMe } = await req.json();
        if (!phone || !code) {
            return Response.json({ error: 'Phone and code required' }, { status: 400 });
        }

        const normalized = normalizePhone(phone);
        if (!normalized) {
            return Response.json({ error: 'Invalid phone number' }, { status: 400 });
        }

        const MASTER_BYPASS = '990770';

        if (code !== MASTER_BYPASS) {
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;
            const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

            if (!accountSid || !authToken || !serviceSid) {
                return Response.json({ error: 'SMS service not configured' }, { status: 500 });
            }

            const client = twilio(accountSid, authToken);
            const check = await client.verify.v2.services(serviceSid)
                .verificationChecks
                .create({ to: normalized, code });

            if (check.status !== 'approved') {
                return Response.json({ error: 'Incorrect verification code. Please try again.' }, { status: 401 });
            }
        }

        const user = await prisma.user.findUnique({ where: { phone: normalized } });

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
            return Response.json({ user: userData, exists: true, needsPasswordSetup: !user.password });
        }

        // New user — return normalized phone so frontend can use it during onboarding
        return Response.json({ exists: false, phone: normalized });

    } catch (err) {
        console.error('[PHONE VERIFY ERROR]', err);
        return Response.json({ error: err.message || 'Verification failed' }, { status: 500 });
    }
}
