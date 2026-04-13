'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { SPORTS, POSITIONS, PLAYERS } from '@/lib/mockData';

export default function AuthPage() {
    const { state, dispatch } = useStore();
    const router = useRouter();
    const [step, setStep] = useState('login'); // login, otp, onboarding, setup-credentials
    const [authMode, setAuthMode] = useState('phone'); // email, phone, password
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    // Verified identifiers returned from server
    const [verifiedPhone, setVerifiedPhone] = useState('');
    const [verifiedEmail, setVerifiedEmail] = useState('');
    // Credentials setup
    const [setupEmail, setSetupEmail] = useState('');
    const [setupPassword, setSetupPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [credError, setCredError] = useState('');
    const [authError, setAuthError] = useState('');

    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [isSending, setIsSending] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);
    const [isDevMode, setIsDevMode] = useState(false);
    const countdownRef = useRef(null);

    // Onboarding
    const [onboardStep, setOnboardStep] = useState(0);
    const [stepError, setStepError] = useState('');
    const [profile, setProfile] = useState({
        name: '', phone: '', password: '', photo: null, location: '', sports: [], positions: {},
    });

    const startResendCountdown = () => {
        setResendCountdown(60);
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
            setResendCountdown(prev => {
                if (prev <= 1) { clearInterval(countdownRef.current); return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

    const handlePhotoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setProfile(prev => ({ ...prev, photo: reader.result }));
            reader.readAsDataURL(file);
        }
    };

    const handleSendOTP = async () => {
        setIsSending(true);
        try {
            if (authMode === 'email') {
                if (!email.includes('@')) {
                    setAuthError("Enter a valid email address");
                    setIsSending(false);
                    return;
                }
                const res = await fetch('/api/auth/otp/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Failed to send verification code");
                if (data.devMode) setIsDevMode(true);
            } else {
                if (!phone || phone.replace(/\D/g, '').length < 10) {
                    setAuthError("Enter a valid phone number");
                    setIsSending(false);
                    return;
                }
                const res = await fetch('/api/auth/phone/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Failed to send verification code");
                if (data.devMode) setIsDevMode(true);
            }
            setStep('otp');
            startResendCountdown();
        } catch (err) {
            console.error(err);
            setAuthError(err.message || "Could not send verification code.");
        } finally {
            setIsSending(false);
        }
    };

    const handlePasswordLogin = async () => {
        setAuthError('');
        if (!email.includes('@')) { setAuthError("Enter a valid email address"); return; }
        if (!loginPassword) { setAuthError("Enter your password"); return; }
        setIsSending(true);
        try {
            const res = await fetch('/api/auth/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: loginPassword, rememberMe })
            });
            const data = await res.json();
            if (res.ok && data.user) {
                dispatch({ type: 'LOGIN', payload: data.user });
                router.push('/invite');
            } else {
                setAuthError(data.error || "Incorrect email or password");
            }
        } catch (err) {
            console.error(err);
            setAuthError("Login failed. Check your connection.");
        } finally {
            setIsSending(false);
        }
    };

    const handleVerifyOTP = async () => {
        setAuthError('');
        const entered = otp.join('');
        if (entered.length < 6) { setAuthError("Enter the full 6-digit code"); return; }

        setIsSending(true);
        try {
            let res, data;
            if (authMode === 'email') {
                res = await fetch('/api/auth/otp/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, code: entered, rememberMe })
                });
            } else {
                res = await fetch('/api/auth/phone/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone, code: entered, rememberMe })
                });
            }
            data = await res.json();
            if (res.status === 200) {
                if (data.exists && data.user) {
                    dispatch({ type: 'LOGIN', payload: data.user });
                    if (data.needsPasswordSetup) {
                        // Pre-fill email for setup if we know it
                        if (authMode === 'email') setSetupEmail(email);
                        setStep('setup-credentials');
                    } else {
                        router.push('/invite');
                    }
                } else {
                    if (data.phone) setVerifiedPhone(data.phone);
                    if (data.email) setVerifiedEmail(data.email);
                    setStep('onboarding');
                }
            } else {
                setAuthError(data.error || "Incorrect code");
            }
        } catch (err) {
            console.error("Verification error:", err);
            setAuthError("An error occurred verifying your account.");
        } finally {
            setIsSending(false);
        }
    };

    const handleSaveCredentials = async () => {
        setCredError('');
        const credEmail = authMode === 'email' ? (verifiedEmail || email) : setupEmail;
        if (!credEmail || !credEmail.includes('@')) { setCredError('Enter a valid email address'); return; }
        if (!setupPassword || setupPassword.length < 6) { setCredError('Password must be at least 6 characters'); return; }
        if (setupPassword !== confirmPassword) { setCredError('Passwords do not match'); return; }

        setIsSending(true);
        try {
            const user = state.currentUser;
            await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: user?.name,
                    email: credEmail,
                    phone: verifiedPhone || user?.phone || null,
                    photo: user?.photo || null,
                    location: user?.location || null,
                    sports: user?.sports || [],
                    positions: user?.positions || {},
                    password: setupPassword,
                }),
            });
            router.push('/invite');
        } catch (err) {
            setCredError('Failed to save. Please try again.');
        } finally {
            setIsSending(false);
        }
    };

    const handleOtpChange = (index, value) => {
        if (value.length > 1) return;
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        if (value && index < 5) {
            document.getElementById(`otp-${index + 1}`)?.focus();
        }
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasted) return;
        const newOtp = [...otp];
        for (let i = 0; i < 6; i++) newOtp[i] = pasted[i] || '';
        setOtp(newOtp);
        const nextEmpty = pasted.length < 6 ? pasted.length : 5;
        document.getElementById(`otp-${nextEmpty}`)?.focus();
    };

    const handleResend = async () => {
        if (resendCountdown > 0 || isSending) return;
        setIsSending(true);
        try {
            const endpoint = authMode === 'email' ? '/api/auth/otp/send' : '/api/auth/phone/send';
            const body = authMode === 'email' ? { email } : { phone };
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to resend code');
            startResendCountdown();
            document.getElementById('otp-0')?.focus();
        } catch (err) {
            setAuthError(err.message || 'Could not resend code.');
        } finally {
            setIsSending(false);
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            document.getElementById(`otp-${index - 1}`)?.focus();
        }
    };

    const toggleSport = (sport) => {
        setProfile(prev => ({
            ...prev,
            sports: prev.sports.includes(sport)
                ? prev.sports.filter(s => s !== sport)
                : [...prev.sports, sport],
        }));
    };

    const setPosition = (rsport, pos) => {
        setProfile(prev => ({ ...prev, positions: { ...prev.positions, [rsport]: pos } }));
    };

    const validateOnboardStep = (idx) => {
        if (idx === 0 && profile.name.trim().length < 2) { setStepError('Please enter your full name (at least 2 characters)'); return false; }
        if (idx === 1 && authMode === 'email' && (!profile.phone || profile.phone.replace(/\D/g, '').length < 10)) { setStepError('Please enter a valid phone number for game reminders'); return false; }
        // idx 2 is photo (optional)
        if (idx === 3 && !profile.location.trim()) { setStepError('Please enter your city or neighbourhood'); return false; }
        if (idx === 4 && profile.sports.length === 0) { setStepError('Select at least one sport'); return false; }
        if (idx === 5) {
            const missing = profile.sports.filter(s => !profile.positions[s]);
            if (missing.length > 0) { setStepError(`Select your position for: ${missing.join(', ')}`); return false; }
        }
        if (idx === 6) {
            // Credentials step
            const credEmail = authMode === 'email' ? (verifiedEmail || email) : setupEmail;
            if (!credEmail || !credEmail.includes('@')) { setStepError('Enter a valid email address'); return false; }
            if (!setupPassword || setupPassword.length < 6) { setStepError('Password must be at least 6 characters'); return false; }
            if (setupPassword !== confirmPassword) { setStepError('Passwords do not match'); return false; }
        }
        setStepError('');
        return true;
    };

    const handleComplete = async () => {
        const basePlayer = PLAYERS[0];
        const credEmail = authMode === 'email' ? (verifiedEmail || email) : setupEmail;
        const newUser = {
            ...basePlayer,
            id: 'current',
            name: profile.name || 'Player',
            email: credEmail || (authMode === 'email' ? email : null),
            phone: authMode === 'phone' ? (verifiedPhone || phone) : (profile.phone || null),
            photo: profile.photo,
            location: profile.location || 'Mumbai',
            sports: profile.sports.length > 0 ? profile.sports : ['football'],
            positions: profile.positions,
            ratings: {},
            trustScore: 50,
            gamesPlayed: 0, wins: 0, losses: 0, draws: 0,
            thoughts: [], privacy: 'public',
            joined: new Date().toISOString().split('T')[0],
        };

        try {
            const dbRes = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newUser.name,
                    email: newUser.email,
                    phone: newUser.phone,
                    photo: newUser.photo,
                    location: newUser.location,
                    sports: newUser.sports,
                    positions: newUser.positions,
                    password: setupPassword,
                }),
            });
            const dbData = await dbRes.json();
            if (dbData.user) {
                newUser.dbId = dbData.user.id;
                newUser.id = dbData.user.id; // use real DB id so games/rsvps link correctly
            }

            await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: newUser, rememberMe }),
            });
        } catch (_) { /* continue fallback */ }

        dispatch({ type: 'LOGIN', payload: newUser });
        router.push('/invite');
    };

    const switchMode = (mode) => {
        setAuthMode(mode);
        setEmail('');
        setPhone('');
        setOtp(['', '', '', '', '', '']);
        setAuthError('');
        setStep('login');
    };

    const onboardingSteps = [
        <div key="name" className="animate-fade-in">
            <h2 style={{ marginBottom: 8 }}>What should we call you?</h2>
            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>This is how other players will see you.</p>
            <input type="text" placeholder="Your name" value={profile.name} onChange={e => setProfile(prev => ({ ...prev, name: e.target.value }))} style={{ fontSize: '1.125rem', padding: '16px 20px', width: '100%' }} autoFocus />
        </div>,
        <div key="phone-capture" className="animate-fade-in">
            {authMode === 'phone' ? (
                // Phone already verified — show confirmation and let them continue
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
                    <h2 style={{ marginBottom: 8 }}>Phone Verified!</h2>
                    <p className="text-muted text-sm" style={{ marginBottom: 8 }}>
                        <strong>{verifiedPhone}</strong> is confirmed.
                    </p>
                    <p className="text-muted text-sm">
                        We'll send game reminders to this number. Tap Next to continue.
                    </p>
                </div>
            ) : (
                <>
                    <h2 style={{ marginBottom: 8 }}>Game Reminders</h2>
                    <p className="text-muted text-sm" style={{ marginBottom: 24 }}>We'll send you SMS game reminders. Enter your WhatsApp/Mobile number.</p>
                    <input
                        type="tel"
                        placeholder="e.g. 917904008139"
                        value={profile.phone}
                        onChange={e => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                        style={{ fontSize: '1.25rem', padding: '16px 20px', width: '100%', border: '1px solid var(--primary-color)' }}
                        autoFocus
                    />
                    <p className="text-xs text-muted" style={{ marginTop: 12 }}>Include country code (e.g. 91 for India).</p>
                </>
            )}
        </div>,
        <div key="photo" className="animate-fade-in">
            <h2 style={{ marginBottom: 8 }}>Add a Profile Photo</h2>
            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>A photo helps friends recognize you on the turf.</p>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <label style={{ cursor: 'pointer', position: 'relative' }}>
                    <div style={{
                        width: 120, height: 120, borderRadius: '50%',
                        background: profile.photo ? `url(${profile.photo}) center/cover` : 'var(--bg-card)',
                        border: '2px dashed var(--border-color)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: profile.photo ? '0' : '2rem',
                    }}>{profile.photo ? '' : '📷'}</div>
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                </label>
                <div className="text-sm text-secondary">Tap to upload (Optional)</div>
            </div>
        </div>,
        <div key="location" className="animate-fade-in">
            <h2 style={{ marginBottom: 8 }}>Where are you based?</h2>
            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>We'll show you games nearby.</p>
            <input type="text" placeholder="e.g. Bandra West, Mumbai" value={profile.location} onChange={e => setProfile(prev => ({ ...prev, location: e.target.value }))} style={{ fontSize: '1.125rem', padding: '16px 20px' }} />
            <button
                type="button"
                onClick={async () => {
                    if (!navigator.geolocation) { setStepError('Geolocation not supported on this device'); return; }
                    setStepError('Detecting location…');
                    navigator.geolocation.getCurrentPosition(async (pos) => {
                        const { latitude, longitude } = pos.coords;
                        try {
                            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`, { headers: { 'Accept-Language': 'en' } });
                            const data = await res.json();
                            const addr = data.address || {};
                            const locality = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || addr.town || addr.city || addr.county || '';
                            const city = addr.city || addr.town || addr.county || '';
                            const label = locality && city && locality !== city ? `${locality}, ${city}` : city || locality || data.display_name?.split(',')[0] || '';
                            setProfile(prev => ({ ...prev, location: label, lat: latitude, lng: longitude }));
                            setStepError('');
                        } catch {
                            setProfile(prev => ({ ...prev, lat: latitude, lng: longitude }));
                            setStepError('');
                        }
                    }, () => setStepError('Could not detect location — please type it manually'));
                }}
                style={{ marginTop: 12, width: '100%', padding: '13px 16px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
                📍 Detect my location automatically
            </button>
            {profile.lat && profile.lng && (
                <a
                    href={`https://maps.google.com/?q=${profile.lat},${profile.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'block', marginTop: 10, fontSize: '0.8rem', color: 'var(--primary-color)', textAlign: 'center' }}
                >
                    📌 Confirm on Google Maps →
                </a>
            )}
        </div>,
        <div key="sports" className="animate-fade-in">
            <h2 style={{ marginBottom: 8 }}>Which sports do you play?</h2>
            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>Select all that apply.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Object.entries(SPORTS).map(([key, sportObj]) => (
                    <button key={key} onClick={() => toggleSport(key)} style={{
                        display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', borderRadius: 16,
                        background: profile.sports.includes(key) ? `${sportObj.color}20` : 'var(--bg-card)',
                        border: `2px solid ${profile.sports.includes(key) ? sportObj.color : 'var(--border-color)'}`,
                        transition: 'all 0.25s ease', cursor: 'pointer',
                    }}>
                        <span style={{ fontSize: '2rem' }}>{sportObj.emoji}</span>
                        <span style={{ fontSize: '1.125rem', fontWeight: 600 }}>{sportObj.name}</span>
                        {profile.sports.includes(key) && <span style={{ marginLeft: 'auto', color: sportObj.color, fontSize: '1.25rem' }}>✓</span>}
                    </button>
                ))}
            </div>
        </div>,
        <div key="positions" className="animate-fade-in">
            <h2 style={{ marginBottom: 8 }}>What's your position?</h2>
            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>Choose your preferred role for each sport.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {profile.sports.map(s => (
                    <div key={s}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <span>{SPORTS[s].emoji}</span>
                            <span style={{ fontWeight: 600, color: SPORTS[s].color }}>{SPORTS[s].name}</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {POSITIONS[s].map(pos => (
                                <button key={pos} onClick={() => setPosition(s, pos)} className="chip" style={{
                                    background: profile.positions[s] === pos ? `${SPORTS[s].color}25` : undefined,
                                    borderColor: profile.positions[s] === pos ? SPORTS[s].color : undefined,
                                    color: profile.positions[s] === pos ? SPORTS[s].color : undefined,
                                }}>{pos}</button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>,
        <div key="credentials" className="animate-fade-in">
            <h2 style={{ marginBottom: 8 }}>
                {authMode === 'phone' ? 'Set up your login' : 'Secure your account'}
            </h2>
            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>
                {authMode === 'phone'
                    ? 'Create an email & password so you can log in next time without needing an SMS code.'
                    : 'Set a password to log in next time without needing a code.'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
                    {authMode === 'email'
                        ? <input type="email" value={verifiedEmail || email} readOnly style={{ fontSize: '1rem', padding: '14px 16px', width: '100%', opacity: 0.7 }} />
                        : <input type="email" placeholder="name@example.com" value={setupEmail} onChange={e => setSetupEmail(e.target.value)} style={{ fontSize: '1rem', padding: '14px 16px', width: '100%' }} autoFocus />
                    }
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                    <div style={{ position: 'relative' }}>
                        <input type={showPassword ? 'text' : 'password'} placeholder="Min. 6 characters" value={setupPassword} onChange={e => setSetupPassword(e.target.value)} style={{ fontSize: '1rem', padding: '14px 48px 14px 16px', width: '100%' }} />
                        <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-secondary)' }}>{showPassword ? '🙈' : '👁'}</button>
                    </div>
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confirm Password</label>
                    <input type={showPassword ? 'text' : 'password'} placeholder="Repeat password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ fontSize: '1rem', padding: '14px 16px', width: '100%' }} />
                </div>
            </div>

            {/* Code of Conduct */}
            <div style={{ marginTop: 24, padding: '16px 18px', background: 'var(--bg-input)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>📜</span> Community Rules
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    <div className="conduct-rule"><span className="conduct-icon">⏰</span><span>Arrive on time. Late no-shows affect other players.</span></div>
                    <div className="conduct-rule"><span className="conduct-icon">🤝</span><span>Respect all players regardless of skill level.</span></div>
                    <div className="conduct-rule"><span className="conduct-icon">⚠️</span><span>Cancel at least 12h before to avoid a reliability hit.</span></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="checkbox" id="conductAgree" style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#6366f1' }} />
                    <label htmlFor="conductAgree" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: 1.5 }}>
                        I agree to the community rules and will be a good sport. 🏅
                    </label>
                </div>
            </div>
        </div>,

    ];

    return (
        <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', padding: '20px 20px 32px', background: 'radial-gradient(ellipse at top, #1a1f35 0%, #0a0e1a 60%)', overflowY: 'auto' }}>
            <div style={{ maxWidth: 420, width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: step === 'onboarding' ? 20 : 28 }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 8, animation: 'float 3s ease-in-out infinite' }}>
                        {step === 'onboarding' ? '🏆' : '⚡'}
                    </div>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: step === 'onboarding' ? '1.375rem' : 'clamp(1.75rem, 5vw, 2.25rem)', fontWeight: 900, background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 6 }}>
                        SportsVault
                    </h1>
                    {step === 'login' && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Find players. Join games. Build your rep.</p>}
                </div>

                {step === 'login' && (
                    <div className="animate-fade-in">
                        <div className="glass-card no-hover" style={{ padding: '24px 20px' }}>
                            <h3 style={{ marginBottom: 4 }}>Welcome back</h3>
                            <p className="text-muted text-sm" style={{ marginBottom: 16 }}>Log in or sign up to get started.</p>

                            {/* Auth mode toggle */}
                            <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: 'var(--bg-secondary)', borderRadius: 12, padding: 4 }}>
                                <button
                                    onClick={() => switchMode('email')}
                                    style={{
                                        flex: 1, padding: '9px 4px', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600,
                                        background: authMode === 'email' ? 'var(--primary-color)' : 'transparent',
                                        color: authMode === 'email' ? '#fff' : 'var(--text-secondary)',
                                        border: 'none', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
                                    }}
                                >
                                    Email Code
                                </button>
                                <button
                                    onClick={() => switchMode('phone')}
                                    style={{
                                        flex: 1, padding: '9px 4px', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600,
                                        background: authMode === 'phone' ? 'var(--primary-color)' : 'transparent',
                                        color: authMode === 'phone' ? '#fff' : 'var(--text-secondary)',
                                        border: 'none', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
                                    }}
                                >
                                    SMS Code
                                </button>
                                <button
                                    onClick={() => switchMode('password')}
                                    style={{
                                        flex: 1, padding: '9px 4px', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600,
                                        background: authMode === 'password' ? 'var(--primary-color)' : 'transparent',
                                        color: authMode === 'password' ? '#fff' : 'var(--text-secondary)',
                                        border: 'none', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
                                    }}
                                >
                                    Password
                                </button>
                            </div>

                            {authError && (
                                <div style={{
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    color: '#ef4444',
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    fontSize: '0.8125rem',
                                    marginBottom: 16,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    animation: 'shake 0.4s ease-in-out'
                                }}>
                                    <span style={{ fontSize: '1rem' }}>⚠️</span>
                                    {authError}
                                </div>
                            )}

                            {authMode === 'password' ? (
                                <div style={{ marginBottom: 20 }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
                                    <input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ fontSize: '1rem', padding: '14px 16px', width: '100%', marginBottom: 16 }} autoFocus />
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <input type={showPassword ? 'text' : 'password'} placeholder="Your password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} style={{ fontSize: '1rem', padding: '14px 48px 14px 16px', width: '100%' }} />
                                        <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-secondary)' }}>{showPassword ? '🙈' : '👁'}</button>
                                    </div>
                                </div>
                            ) : authMode === 'email' ? (
                                <div style={{ marginBottom: 20 }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
                                    <input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ fontSize: '1rem', padding: '14px 16px', width: '100%' }} autoFocus />
                                </div>
                            ) : (
                                <div style={{ marginBottom: 20 }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone Number</label>
                                    <input type="tel" placeholder="e.g. 9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ fontSize: '1rem', padding: '14px 16px', width: '100%' }} autoFocus />
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>India numbers auto-prefixed with +91. Include country code for others (e.g. +1 for US).</p>
                                </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                <input type="checkbox" id="rememberMe" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                                <label htmlFor="rememberMe" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>Remember me for 30 days</label>
                            </div>

                            {authMode === 'password' ? (
                                <button className="btn btn-primary btn-block btn-lg" onClick={handlePasswordLogin} disabled={isSending}>
                                    {isSending ? 'Logging in...' : 'Login →'}
                                </button>
                            ) : (
                                <button className="btn btn-primary btn-block btn-lg" onClick={handleSendOTP} disabled={isSending}>
                                    {isSending ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                                            <div className="spinner-inline" /> Sending...
                                        </div>
                                    ) : (
                                        authMode === 'email' ? 'Send Magic Code →' : 'Send SMS Code →'
                                    )}
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 24 }}>
                            {Object.values(SPORTS).map(s => <span key={s.name} style={{ fontSize: '1.375rem', opacity: 0.35, animation: 'float 3s ease-in-out infinite' }}>{s.emoji}</span>)}
                        </div>
                    </div>
                )}

                {step === 'otp' && (
                    <div className="animate-fade-in">
                        <div className="glass-card no-hover" style={{ padding: '24px 20px' }}>
                            <h3 style={{ marginBottom: 4 }}>
                                {authMode === 'email' ? 'Check your inbox' : 'Check your messages'}
                            </h3>
                            <p className="text-muted text-sm" style={{ marginBottom: isDevMode ? 8 : 24 }}>
                                Enter the 6-digit code sent to {authMode === 'email' ? email : phone}
                            </p>
                            {isDevMode && (
                                <div style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: '0.82rem', color: '#92400e' }}>
                                    <strong>Dev mode</strong> — SMS service not configured. Use code <strong style={{ letterSpacing: 2 }}>990770</strong> to continue.
                                </div>
                            )}
                            <div className="otp-container" style={{ marginBottom: 24 }}>
                                {otp.map((digit, i) => (
                                    <input key={i} id={`otp-${i}`} type="text" inputMode="numeric" className="otp-input" value={digit} onChange={e => handleOtpChange(i, e.target.value)} onKeyDown={e => handleOtpKeyDown(i, e)} onPaste={handleOtpPaste} maxLength={1} autoFocus={i === 0} />
                                ))}
                            </div>
                            <button className="btn btn-primary btn-block btn-lg" onClick={handleVerifyOTP} disabled={isSending}>
                                {isSending ? 'Verifying...' : 'Verify →'}
                            </button>
                            <button
                                className="btn btn-ghost btn-block"
                                style={{ marginTop: 12 }}
                                onClick={handleResend}
                                disabled={resendCountdown > 0 || isSending}
                            >
                                {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend code'}
                            </button>
                            <button className="btn btn-ghost btn-block" style={{ marginTop: 4, fontSize: '0.8rem', opacity: 0.7 }} onClick={() => { setStep('login'); setOtp(['', '', '', '', '', '']); setResendCountdown(0); setIsDevMode(false); if (countdownRef.current) clearInterval(countdownRef.current); }}>
                                ← Change {authMode === 'email' ? 'email' : 'phone'}
                            </button>
                        </div>
                    </div>
                )}

                {step === 'onboarding' && (
                    <div className="animate-slide-up">
                        <div className="glass-card no-hover" style={{ padding: '20px 18px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>STEP {onboardStep + 1} OF {onboardingSteps.length}</div>
                                <div style={{ display: 'flex', gap: 4 }}>{onboardingSteps.map((_, i) => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i === onboardStep ? 'var(--primary-color)' : i < onboardStep ? 'rgba(99,102,241,0.3)' : 'var(--border-color)', transition: 'all 0.3s' }} />)}</div>
                            </div>
                            {onboardingSteps[onboardStep]}
                            {stepError && <div style={{ color: '#ef4444', fontSize: '0.8125rem', marginTop: 12, padding: '10px 12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)' }}>⚠️ {stepError}</div>}
                            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                                {onboardStep > 0 && <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setOnboardStep(s => s - 1); setStepError(''); }}>← Back</button>}
                                <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => { if (validateOnboardStep(onboardStep)) { if (onboardStep < onboardingSteps.length - 1) setOnboardStep(s => s + 1); else handleComplete(); } }}>{onboardStep < onboardingSteps.length - 1 ? 'Next →' : 'Create Account 🚀'}</button>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'setup-credentials' && (
                    <div className="animate-slide-up">
                        <div className="glass-card no-hover" style={{ padding: '24px 20px' }}>
                            <h3 style={{ marginBottom: 4 }}>Set your email & password</h3>
                            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>All your games and profile are linked to this.</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
                                    {authMode === 'email'
                                        ? <input type="email" value={verifiedEmail || email} readOnly style={{ fontSize: '1rem', padding: '14px 16px', width: '100%', opacity: 0.7 }} />
                                        : <input type="email" placeholder="name@example.com" value={setupEmail} onChange={e => setSetupEmail(e.target.value)} autoFocus style={{ fontSize: '1rem', padding: '14px 16px', width: '100%' }} />
                                    }
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <input type={showPassword ? 'text' : 'password'} placeholder="Min. 6 characters" value={setupPassword} onChange={e => setSetupPassword(e.target.value)} style={{ fontSize: '1rem', padding: '14px 48px 14px 16px', width: '100%' }} />
                                        <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-secondary)' }}>{showPassword ? '🙈' : '👁'}</button>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confirm Password</label>
                                    <input type={showPassword ? 'text' : 'password'} placeholder="Repeat password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ fontSize: '1rem', padding: '14px 16px', width: '100%' }} />
                                </div>
                            </div>
                            {credError && <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: 16, padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)' }}>⚠️ {credError}</div>}
                            <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 24 }} onClick={handleSaveCredentials} disabled={isSending}>
                                {isSending ? 'Saving...' : 'Save & Continue →'}
                            </button>
                            <button className="btn btn-ghost btn-block" style={{ marginTop: 8, fontSize: '0.8rem', opacity: 0.6 }} onClick={() => router.push('/invite')}>
                                Skip for now
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
