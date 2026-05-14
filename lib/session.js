import { getIronSession } from 'iron-session';

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is required in production.');
}

const secureCookie =
    process.env.SESSION_COOKIE_SECURE != null
        ? process.env.SESSION_COOKIE_SECURE === 'true'
        : process.env.VERCEL === '1' || process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://');

export const sessionOptions = {
    password: process.env.SESSION_SECRET || 'sportsvault-dev-session-secret-min-32-chars',
    cookieName: 'sportsvault_session',
    cookieOptions: {
        secure: secureCookie,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
    },
};

export async function getSession(req, res) {
    return getIronSession(req, res, sessionOptions);
}
