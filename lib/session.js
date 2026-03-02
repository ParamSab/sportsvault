import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

export const sessionOptions = {
    password: process.env.SESSION_SECRET || 'sportsvault-super-secret-key-min-32-chars!!',
    cookieName: 'sportsvault_session',
    cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30, // 30 days
    },
};

// App Router: reads cookies() from next/headers — use this in route.js files
export async function getAppSession() {
    const cookieStore = await cookies();
    return getIronSession(cookieStore, sessionOptions);
}

// Legacy Pages Router helper (kept for reference)
export async function getSession(req, res) {
    return getIronSession(req, res, sessionOptions);
}
