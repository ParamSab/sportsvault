'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { SPORTS, POSITIONS, PLAYERS } from '@/lib/mockData';

export default function AuthPage() {
    const { dispatch } = useStore();
    const [step, setStep] = useState('email'); // email, otp, onboarding
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [expectedOtp, setExpectedOtp] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [onboardStep, setOnboardStep] = useState(0);
    const [stepError, setStepError] = useState('');
    const [profile, setProfile] = useState({
        name: '', phone: '', photo: null, location: '', sports: [], positions: {},
    });

    const handlePhotoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfile(prev => ({ ...prev, photo: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSendOTP = async () => {
        if (!email.includes('@')) return alert("Enter a valid email");

        setIsSending(true);
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        setExpectedOtp(code);

        try {
            const res = await fetch('/api/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'send-otp', to: email, code })
            });
            if (!res.ok) throw new Error("Failed to send email");
            setStep('otp');
        } catch (err) {
            console.error(err);
            alert("Could not send code. Defaulting to 123456");
            setExpectedOtp("123456");
            setStep('otp');
        } finally {
            setIsSending(false);
        }
    };

    const handleVerifyOTP = async () => {
        const entered = otp.join('');
        if (entered !== expectedOtp) {
            alert("Incorrect code");
            return;
        }

        // Check if this email already has an account — skip onboarding if so
        try {
            const res = await fetch(`/api/users?email=${encodeURIComponent(email)}`);
            const data = await res.json();
            if (data.user && data.user.name) {
                // Returning user — log them in directly
                const existingUser = {
                    id: 'current',
                    dbId: data.user.id,
                    name: data.user.name,
                    email: data.user.email || email,
                    phone: data.user.phone || '',
                    photo: data.user.photo || null,
                    location: data.user.location || '',
                    sports: data.user.sports || [],
                    positions: data.user.positions || {},
                    ratings: data.user.ratings || {},
                    trustScore: data.user.trustScore || 50,
                    gamesPlayed: data.user.gamesPlayed || 0,
                    wins: data.user.wins || 0,
                    losses: data.user.losses || 0,
                    draws: data.user.draws || 0,
                    thoughts: [],
                    privacy: data.user.privacy || 'public',
                    joined: data.user.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
                };
                // Save session (strip photo — cookies have a 4KB limit)
                const { photo: _photo, ...sessionUser } = existingUser;
                await fetch('/api/auth/session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user: sessionUser, rememberMe }),
                });
                dispatch({ type: 'LOGIN', payload: existingUser });
                return;
            }
        } catch (_) { /* fall through to onboarding */ }

        // New user — proceed to onboarding
        setStep('onboarding');
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

    const setPosition = (sport, pos) => {
        setProfile(prev => ({
            ...prev,
            positions: { ...prev.positions, [sport]: pos },
        }));
    };

    const validateOnboardStep = (idx) => {
        if (idx === 0 && profile.name.trim().length < 2) { setStepError('Please enter your full name (at least 2 characters)'); return false; }
        if (idx === 1 && (profile.phone.length < 10)) { setStepError('Please enter a valid phone number'); return false; }
        if (idx === 2 && !profile.photo) { setStepError('A profile photo is required'); return false; }
        if (idx === 3 && !profile.location.trim()) { setStepError('Please enter your city or neighbourhood'); return false; }
        if (idx === 4 && profile.sports.length === 0) { setStepError('Select at least one sport'); return false; }
        if (idx === 5) {
            const missing = profile.sports.filter(s => !profile.positions[s]);
            if (missing.length > 0) { setStepError(`Select your position for: ${missing.join(', ')}`); return false; }
        }
        setStepError('');
        return true;
    };

    const handleComplete = async () => {
        const basePlayer = PLAYERS[0];
        const newUser = {
            ...basePlayer,
            id: 'current',
            name: profile.name || 'Player',
            email: email,
            phone: profile.phone.startsWith('+91') ? profile.phone : `+91${profile.phone}`,
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

        // Save to DB + session cookie
        try {
            const dbRes = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newUser.name, email: newUser.email, phone: newUser.phone,
                    photo: newUser.photo, location: newUser.location,
                    sports: newUser.sports, positions: newUser.positions,
                }),
            });
            const dbData = await dbRes.json();
            if (dbData.user) newUser.dbId = dbData.user.id;

            // Strip photo (base64) from session cookie — cookies have a 4KB limit
            const { photo: _photo, ...sessionUser } = newUser;
            await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: sessionUser, rememberMe }),
            });
        } catch (_) { /* continue with localStorage fallback */ }

        dispatch({ type: 'LOGIN', payload: newUser });
    };

    const onboardingSteps = [
        // Step 0: Name
        <div key="name" className="animate-fade-in">
            <h2 style={{ marginBottom: 8 }}>What should we call you?</h2>
            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>This is how other players will see you.</p>
            <input
                type="text" placeholder="Your name"
                value={profile.name}
                onChange={e => setProfile(prev => ({ ...prev, name: e.target.value }))}
                style={{ fontSize: '1.125rem', padding: '16px 20px' }}
                autoFocus
            />
        </div>,
        // Step 1: Phone
        <div key="phone" className="animate-fade-in">
            <h2 style={{ marginBottom: 8 }}>Your Phone Number</h2>
            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>Needed for game invites via Text Blast.</p>
            <div style={{ display: 'flex', gap: 8 }}>
                <div style={{
                    padding: '16px', background: 'var(--bg-input)', borderRadius: 12,
                    border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center',
                    fontWeight: 600, color: 'var(--text-secondary)', minWidth: 64, justifyContent: 'center'
                }}>+91</div>
                <input
                    type="tel" placeholder="10-digit mobile number"
                    value={profile.phone}
                    onChange={e => setProfile(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                    style={{ fontSize: '1.125rem', padding: '16px 20px', flex: 1 }}
                    autoFocus
                />
            </div>
        </div>,
        // Step 1: Photo
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
                    }}>
                        {profile.photo ? '' : '📷'}
                    </div>
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                </label>
                <div className="text-sm text-secondary">Tap to upload</div>
                {!profile.photo && onboardStep === 1 && (
                    <div className="text-xs" style={{ color: 'var(--danger)', marginTop: 8 }}>
                        * Profile photo is required
                    </div>
                )}
            </div>
        </div>,
        // Step 2: Location
        <div key="location" className="animate-fade-in">
            <h2 style={{ marginBottom: 8 }}>Where are you based?</h2>
            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>We'll show you games nearby.</p>
            <input
                type="text" placeholder="e.g. Bandra West, Mumbai"
                value={profile.location}
                onChange={e => setProfile(prev => ({ ...prev, location: e.target.value }))}
                style={{ fontSize: '1.125rem', padding: '16px 20px' }}
            />
        </div>,
        // Step 2: Sports
        <div key="sports" className="animate-fade-in">
            <h2 style={{ marginBottom: 8 }}>Which sports do you play?</h2>
            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>Select all that apply.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Object.entries(SPORTS).map(([key, sport]) => (
                    <button
                        key={key}
                        onClick={() => toggleSport(key)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 16,
                            padding: '20px 24px', borderRadius: 16,
                            background: profile.sports.includes(key) ? `${sport.color}20` : 'var(--bg-card)',
                            border: `2px solid ${profile.sports.includes(key) ? sport.color : 'var(--border-color)'}`,
                            transition: 'all 0.25s ease', cursor: 'pointer',
                        }}
                    >
                        <span style={{ fontSize: '2rem' }}>{sport.emoji}</span>
                        <span style={{ fontSize: '1.125rem', fontWeight: 600 }}>{sport.name}</span>
                        {profile.sports.includes(key) && (
                            <span style={{ marginLeft: 'auto', color: sport.color, fontSize: '1.25rem' }}>✓</span>
                        )}
                    </button>
                ))}
            </div>
        </div>,
        // Step 3: Positions
        <div key="positions" className="animate-fade-in">
            <h2 style={{ marginBottom: 8 }}>What's your position?</h2>
            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>Choose your preferred role for each sport.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {profile.sports.map(sport => (
                    <div key={sport}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <span>{SPORTS[sport].emoji}</span>
                            <span style={{ fontWeight: 600, color: SPORTS[sport].color }}>{SPORTS[sport].name}</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {POSITIONS[sport].map(pos => (
                                <button
                                    key={pos}
                                    onClick={() => setPosition(sport, pos)}
                                    className="chip"
                                    style={{
                                        background: profile.positions[sport] === pos ? `${SPORTS[sport].color}25` : undefined,
                                        borderColor: profile.positions[sport] === pos ? SPORTS[sport].color : undefined,
                                        color: profile.positions[sport] === pos ? SPORTS[sport].color : undefined,
                                    }}
                                >
                                    {pos}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>,
    ];

    return (
        <div style={{
            minHeight: '100dvh', display: 'flex', flexDirection: 'column',
            justifyContent: 'center', padding: '24px',
            background: 'radial-gradient(ellipse at top, #1a1f35 0%, #0a0e1a 60%)',
        }}>
            <div style={{ maxWidth: 420, width: '100%', margin: '0 auto' }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: step === 'onboarding' ? 32 : 48 }}>
                    <div style={{
                        fontSize: '3rem', marginBottom: 12,
                        animation: 'float 3s ease-in-out infinite',
                    }}>
                        {step === 'onboarding' ? '🏆' : '⚡'}
                    </div>
                    <h1 style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: step === 'onboarding' ? '1.5rem' : '2.25rem',
                        fontWeight: 900,
                        background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: 8,
                    }}>
                        SportsVault
                    </h1>
                    {step === 'email' && (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
                            Find players. Join games. Build your rep.
                        </p>
                    )}
                </div>

                {/* Email Step */}
                {step === 'email' && (
                    <div className="animate-fade-in">
                        <div className="glass-card no-hover" style={{ padding: 32 }}>
                            <h3 style={{ marginBottom: 4 }}>Enter your email</h3>
                            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>
                                We'll send you a secure login code
                            </p>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                                <div style={{
                                    padding: '16px', background: 'var(--bg-input)', borderRadius: 12,
                                    border: '1px solid var(--border-color)', display: 'flex',
                                    alignItems: 'center', fontWeight: 600, color: 'var(--text-secondary)',
                                    minWidth: 48, justifyContent: 'center', fontSize: '1.25rem'
                                }}>
                                    ✉️
                                </div>
                                <input
                                    type="email" placeholder="player@example.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value.toLowerCase())}
                                    style={{ fontSize: '1.125rem', padding: '16px 20px', flex: 1 }}
                                    autoFocus
                                />
                            </div>
                            <label style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                marginBottom: 20, cursor: 'pointer',
                                color: 'var(--text-secondary)', fontSize: '0.9rem',
                            }}>
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={e => setRememberMe(e.target.checked)}
                                    style={{ width: 16, height: 16, accentColor: '#6366f1', cursor: 'pointer' }}
                                />
                                Remember me for 30 days
                            </label>
                            <button className="btn btn-primary btn-block btn-lg" onClick={handleSendOTP} disabled={isSending}>
                                {isSending ? 'Sending...' : 'Send Code →'}
                            </button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 32 }}>
                            {Object.values(SPORTS).map(s => (
                                <span key={s.name} style={{ fontSize: '1.5rem', opacity: 0.4, animation: 'float 3s ease-in-out infinite', animationDelay: `${Math.random()}s` }}>
                                    {s.emoji}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* OTP Step */}
                {step === 'otp' && (
                    <div className="animate-fade-in">
                        <div className="glass-card no-hover" style={{ padding: 32 }}>
                            <h3 style={{ marginBottom: 4 }}>Check your inbox</h3>
                            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>
                                Enter the 6-digit code sent to {email}
                            </p>
                            <div className="otp-container" style={{ marginBottom: 24 }}>
                                {otp.map((digit, i) => (
                                    <input
                                        key={i} id={`otp-${i}`}
                                        type="text" inputMode="numeric"
                                        className="otp-input"
                                        value={digit}
                                        onChange={e => handleOtpChange(i, e.target.value)}
                                        onKeyDown={e => handleOtpKeyDown(i, e)}
                                        maxLength={1}
                                        autoFocus={i === 0}
                                    />
                                ))}
                            </div>
                            <button className="btn btn-primary btn-block btn-lg" onClick={handleVerifyOTP}>
                                Verify →
                            </button>
                            <button
                                className="btn btn-ghost btn-block"
                                style={{ marginTop: 12 }}
                                onClick={() => setStep('email')}
                            >
                                Change email
                            </button>
                        </div>
                        <p className="text-muted text-xs text-center" style={{ marginTop: 16 }}>
                            💡 Wait a few seconds for the email to arrive
                        </p>
                    </div>
                )}

                {/* Onboarding Step */}
                {step === 'onboarding' && (
                    <div className="animate-fade-in">
                        {/* Progress */}
                        <div className="step-indicator">
                            {onboardingSteps.map((_, i) => (
                                <div
                                    key={i}
                                    className={`step-dot ${i < onboardStep ? 'completed' : i === onboardStep ? 'active' : ''}`}
                                />
                            ))}
                        </div>

                        <div className="glass-card no-hover" style={{ padding: 32 }}>
                            {onboardingSteps[onboardStep]}
                            {stepError && (
                                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', fontSize: '0.8125rem' }}>
                                    ⚠️ {stepError}
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                                {onboardStep > 0 && (
                                    <button
                                        className="btn btn-outline"
                                        style={{ flex: 1 }}
                                        onClick={() => setOnboardStep(prev => prev - 1)}
                                    >
                                        ← Back
                                    </button>
                                )}
                                <button
                                    className="btn btn-primary"
                                    style={{ flex: 1 }}
                                    onClick={() => {
                                        if (onboardStep < onboardingSteps.length - 1) {
                                            if (validateOnboardStep(onboardStep)) {
                                                setOnboardStep(prev => prev + 1);
                                            }
                                        } else {
                                            if (validateOnboardStep(onboardStep)) handleComplete();
                                        }
                                    }}
                                >
                                    {onboardStep < onboardingSteps.length - 1 ? 'Continue →' : "Let's Go! 🚀"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
