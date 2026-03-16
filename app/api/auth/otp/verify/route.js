import { prisma } from '@/lib/prisma';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

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
        const { phone, code, rememberMe } = await req.json();
        if (!phone || !code) return Response.json({ error: 'Phone and code required' }, { status: 400 });

        // Master bypass code
        if (code === '990770') {
            return await handleUserLogin(phone, rememberMe);
        }

        // Phone number cleaning
        let formattedPhone = phone.trim();
        formattedPhone = formattedPhone.replace(/(?!^\+)/g, '').replace(/[^-+0-9]/g, '');
        if (formattedPhone.length === 10) {
            formattedPhone = '+91' + formattedPhone;
        } else if (!formattedPhone.startsWith('+')) {
            formattedPhone = '+' + formattedPhone;
        }

        const client = twilio(accountSid, authToken);

        // Check verification code with Twilio Verify
        const verificationCheck = await client.verify.v2.services(verifyServiceSid)
            .verificationChecks
            .create({ to: formattedPhone, code });

        if (verificationCheck.status !== 'approved') {
            return Response.json({ error: 'Invalid verification code' }, { status: 401 });
        }

        return await handleUserLogin(formattedPhone, rememberMe);
    } catch (err) {
        console.error('Verify API error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}

async function handleUserLogin(phone, rememberMe) {
    const user = await prisma.user.findUnique({
        where: { phone },
    });

    if (user) {
        const customOptions = { ...sessionOptions };
        if (!rememberMe) {
            customOptions.cookieOptions = { ...customOptions.cookieOptions };
            delete customOptions.cookieOptions.maxAge; // Session cookie only
        }

        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, customOptions);

        const userData = {
            ...user,
            sports: JSON.parse(user.sports || '[]'),
            positions: JSON.parse(user.positions || '{}'),
            ratings: JSON.parse(user.ratings || '{}'),
            dbId: user.id
        };
        delete userData.password;

        session.user = userData;
        await session.save();

        return Response.json({ user: userData, exists: true });
    }

    // User does not exist, need to onboard
    return Response.json({ exists: false });
}
