import { prisma } from '@/lib/prisma';
import { getSupabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/lib/session';
import { isDevOtpBypass } from '@/lib/auth';

function normalizePhone(phone) {
    const cleaned = phone.trim();
    if (cleaned.startsWith('+')) return cleaned.replace(/\s/g, '');
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    return null;
}

async function findUserByPhone(normalized) {
    try {
        const user = await prisma.user.findUnique({ where: { phone: normalized } });
        if (user) return { user, source: 'prisma' };
    } catch (_) { /* fall through */ }
    try {
        const supabase = getSupabase();
        if (supabase) {
            const { data } = await supabase.from('users').select('*').eq('phone', normalized).maybeSingle();
            if (data) return { user: data, source: 'supabase' };
        }
    } catch (_) { /* ignore */ }
    return { user: null, source: null };
}

export async function POST(req) {
    try {
        let phone, code, newPassword, rememberMe;
        try {
            ({ phone, code, newPassword, rememberMe } = await req.json());
        } catch {
            return Response.json({ error: 'Invalid request body' }, { status: 400 });
        }
        if (!phone || !code || !newPassword) {
            return Response.json({ error: 'Phone, code and new password are required.' }, { status: 400 });
        }
        if (newPassword.length < 6) {
            return Response.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
        }

        const normalized = normalizePhone(phone);
        if (!normalized) return Response.json({ error: 'Invalid phone number.' }, { status: 400 });

        // Verify the SMS code (same logic as phone/verify, incl. env-gated dev bypass)
        if (!isDevOtpBypass(code)) {
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;
            const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
            if (!accountSid || !authToken || !serviceSid) {
                return Response.json({ error: 'SMS service not configured' }, { status: 500 });
            }
            const client = require('twilio')(accountSid, authToken);
            const check = await client.verify.v2.services(serviceSid)
                .verificationChecks.create({ to: normalized, code });
            if (check.status !== 'approved') {
                return Response.json({ error: 'Incorrect verification code. Please try again.' }, { status: 401 });
            }
        }

        const { user, source } = await findUserByPhone(normalized);
        if (!user) {
            return Response.json({ error: 'No account is registered with this phone number.' }, { status: 404 });
        }

        const hashed = await bcrypt.hash(newPassword, 10);

        // Persist the new password
        if (source === 'prisma') {
            try {
                await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
            } catch (_) {
                const supabase = getSupabase();
                if (supabase) await supabase.from('users').update({ password: hashed }).eq('id', user.id);
            }
        } else {
            const supabase = getSupabase();
            if (supabase) await supabase.from('users').update({ password: hashed }).eq('id', user.id);
        }

        // Log them straight in
        const userData = {
            ...user,
            sports: Array.isArray(user.sports) ? user.sports : (typeof user.sports === 'string' ? JSON.parse(user.sports || '[]') : []),
            positions: typeof user.positions === 'object' && user.positions !== null ? user.positions : (typeof user.positions === 'string' ? JSON.parse(user.positions || '{}') : {}),
            ratings: typeof user.ratings === 'object' && user.ratings !== null ? user.ratings : (typeof user.ratings === 'string' ? JSON.parse(user.ratings || '{}') : {}),
            dbId: user.id,
        };
        delete userData.password;

        const cookieStore = await cookies();
        const opts = { ...sessionOptions };
        if (!rememberMe) {
            opts.cookieOptions = { ...opts.cookieOptions };
            delete opts.cookieOptions.maxAge;
        }
        const session = await getIronSession(cookieStore, opts);
        session.user = userData;
        session.isLoaded = true;
        await session.save();

        return Response.json({ success: true, user: userData });
    } catch (err) {
        console.error('[PASSWORD RESET ERROR]', err);
        return Response.json({ error: err.message || 'Failed to reset password.' }, { status: 500 });
    }
}
