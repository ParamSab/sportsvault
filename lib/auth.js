export const VERIFIED_AUTH_MAX_AGE_MS = 15 * 60 * 1000;

export function isDevOtpBypass(code) {
    return process.env.NODE_ENV !== 'production' &&
        process.env.ALLOW_DEV_OTP_BYPASS === 'true' &&
        code === process.env.DEV_OTP_BYPASS_CODE;
}

export function normalizeEmail(email) {
    return typeof email === 'string' ? email.toLowerCase().trim() : null;
}

export function normalizePhone(phone) {
    if (!phone || typeof phone !== 'string') return null;
    const cleaned = phone.trim();
    if (cleaned.startsWith('+')) return cleaned.replace(/\s/g, '');
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    return null;
}

export function parseJsonField(value, fallback) {
    if (Array.isArray(fallback) && Array.isArray(value)) return value;
    if (!Array.isArray(fallback) && value && typeof value === 'object') return value;
    if (typeof value !== 'string') return fallback;
    try {
        return JSON.parse(value || JSON.stringify(fallback));
    } catch {
        return fallback;
    }
}

export function serializeUser(user) {
    if (!user) return null;
    const { password, ...safeUser } = user;
    return {
        ...safeUser,
        sports: parseJsonField(safeUser.sports, []),
        positions: parseJsonField(safeUser.positions, {}),
        ratings: parseJsonField(safeUser.ratings, {}),
        dbId: safeUser.id,
    };
}

export function setPendingVerifiedAuth(session, { email, phone, rememberMe }) {
    session.pendingVerifiedAuth = {
        email: normalizeEmail(email),
        phone: normalizePhone(phone),
        verifiedAt: Date.now(),
        rememberMe: !!rememberMe,
    };
}

export function getFreshPendingVerifiedAuth(session) {
    const pending = session.pendingVerifiedAuth;
    if (!pending?.verifiedAt || Date.now() - pending.verifiedAt > VERIFIED_AUTH_MAX_AGE_MS) {
        delete session.pendingVerifiedAuth;
        return null;
    }
    return pending;
}
