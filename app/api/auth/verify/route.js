export async function POST() {
    return Response.json({ error: 'Use /api/auth/phone/verify with an OTP code.' }, { status: 410 });
}
