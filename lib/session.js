import { getIronSession } from 'iron-session';

const secureCookie =
    process.env.SESSION_COOKIE_SECURE != null
        ? process.env.SESSION_COOKIE_SECURE === 'true'
        : process.env.VERCEL === '1' || process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://');

function getSessionPassword() {
    const secret = process.env.SESSION_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
        console.error('[session] SESSION_SECRET env var is not set — using insecure fallback. Set it in Vercel environment variables.');
    }
    return secret || 'sportsvault-dev-session-secret-min-32-chars';
}

export const sessionOptions = {
    password: getSessionPassword(),
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
