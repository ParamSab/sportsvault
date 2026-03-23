'use client';
import { useState, useRef } from 'react';
import { useStore } from '@/lib/store';
import { SPORTS, POSITIONS, PLAYERS } from '@/lib/mockData';

export default function AuthPage() {
    const { dispatch } = useStore();
    const [step, setStep] = useState('phone'); // phone, otp, onboarding
    const [phone, setPhone] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');
    const [resendCountdown, setResendCountdown] = useState(0);
    const countdownRef = useRef(null);

    // Onboarding
    const [onboardStep, setOnboardStep] = useState(0);
    const [stepError, setStepError] = useState('');
    const [profile, setProfile] = useState({
        name: '', photo: null, location: '', sports: [], positions: {},
    });

    const startResendTimer = () => {
        setResendCountdown(30);
        clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
            setResendCountdown(prev => {
                if (prev <= 1) { clearInterval(countdownRef.current); return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    const handlePhotoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setProfile(prev => ({ ...prev, photo: reader.result }));
            reader.readAsDataURL(file);
        }
    };

    const handleSendOTP = async () => {
        setError('');
        const trimmed = phone.trim();
        if (!trimmed) return setError('Please enter your phone number.');
        const digits = trimmed.replace(/\D/g, '');
        if (digits.length < 10) return setError('Enter a valid phone number with country code (e.g. +91 98765 43210).');

        setIsSending(true);
        try {
            const res = await fetch('/api/auth/otp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: trimmed }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send verification code.');
            setStep('otp');
            startResendTimer();
        } catch (err) {
            setError(err.message || 'Could not send verification code. Please try again.');
        } finally {
            setIsSending(false);
        }
    };

    const handleVerifyOTP = async () => {
        setError('');
        const entered = otp.join('');
        if (entered.length < 6) return setError('Enter the full 6-digit code.');

        setIsSending(true);
        try {
            const res = await fetch('/api/auth/otp/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: phone.trim(), code: entered, rememberMe }),
            });
            const data = await res.json();
            if (res.status === 200) {
                if (data.exists && data.user) {
                    dispatch({ type: 'LOGIN', payload: data.user });
                } else {
                    setStep('onboarding');
                }
            } else {
                setError(data.error || 'Incorrect code. Please try again.');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setIsSending(false);
        }
    };

    const handleResend = async () => {
        if (resendCountdown > 0) return;
        setError('');
        setOtp(['', '', '', '', '', '']);
        setIsSending(true);
        try {
            const res = await fetch('/api/auth/otp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: phone.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to resend code.');
            startResendTimer();
        } catch (err) {
            setError(err.message || 'Could not resend code.');
        } finally {
            setIsSending(false);
        }
    };

    const handleOtpChange = (index, value) => {
        // Handle paste of full code
        if (value.length > 1) {
            const digits = value.replace(/\D/g, '').slice(0, 6);
            if (digits.length >= 6) {
                const newOtp = digits.split('');
                setOtp(newOtp);
                document.getElementById(`otp-5`)?.focus();
                return;
            }
        }
        if (!/^\d*$/.test(value)) return; // numeric only
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
        if (e.key === 'Enter') handleVerifyOTP();
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
        if (idx === 2 && !profile.location.trim()) { setStepError('Please enter your city or neighbourhood'); return false; }
        if (idx === 3 && profile.sports.length === 0) { setStepError('Select at least one sport'); return false; }
        if (idx === 4) {
            const missing = profile.sports.filter(s => !profile.positions[s]);
            if (missing.length > 0) { setStepError(`Select your position for: ${missing.join(', ')}`); return false; }
        }
        setStepError('');
        return true;
    };

    const handleComplete = async () => {
        const newUser = {
            id: 'current',
            name: profile.name || 'Player',
            phone: phone.trim(),
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
                    name: newUser.name, phone: newUser.phone, photo: newUser.photo,
                    location: newUser.location, sports: newUser.sports, positions: newUser.positions,
                }),
            });
            const dbData = await dbRes.json();
            if (dbData.user) newUser.dbId = dbData.user.id;

            await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: newUser, rememberMe }),
            });
        } catch (_) { /* continue fallback */ }

        dispatch({ type: 'LOGIN', payload: newUser });
    };

    const onboardingSteps = [
        <div key="name" className="animate-fade-in">
            <h2 style={{ marginBottom: 8 }}>What should we call you?</h2>
            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>This is how other players will see you.</p>
            <input type="text" placeholder="Your name" value={profile.name} onChange={e => setProfile(prev => ({ ...prev, name: e.target.value }))} style={{ fontSize: '1.125rem', padding: '16px 20px' }} autoFocus />
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
    ];

    // ─── Inline error box ────────────────────────────────────────────────────
    const ErrorBox = ({ msg }) => msg ? (
        <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: 12, padding: '12px 16px', background: 'rgba(239,68,68,0.08)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)' }}>
            ⚠️ {msg}
        </div>
    ) : null;

    return (
        <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px', background: 'radial-gradient(ellipse at top, #1a1f35 0%, #0a0e1a 60%)' }}>
            <div style={{ maxWidth: 420, width: '100%', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: step === 'onboarding' ? 32 : 48 }}>
                    <div style={{ fontSize: '3rem', marginBottom: 12, animation: 'float 3s ease-in-out infinite' }}>
                        {step === 'onboarding' ? '🏆' : '⚡'}
                    </div>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: step === 'onboarding' ? '1.5rem' : '2.25rem', fontWeight: 900, background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>
                        SportsVault
                    </h1>
                    {step === 'phone' && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>Find players. Join games. Build your rep.</p>}
                </div>

                {step === 'phone' && (
                    <div className="animate-fade-in">
                        <div className="glass-card no-hover" style={{ padding: 32 }}>
                            <h3 style={{ marginBottom: 4 }}>Welcome</h3>
                            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>Enter your phone number to log in or sign up.</p>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone Number</label>
                                <input
                                    type="tel"
                                    placeholder="+91 98765 43210"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
                                    style={{ fontSize: '1rem', padding: '14px 16px', width: '100%' }}
                                    autoFocus
                                />
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>Include country code, e.g. +91 for India</p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                                <input type="checkbox" id="rememberMe" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                                <label htmlFor="rememberMe" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>Remember me for 30 days</label>
                            </div>
                            <button className="btn btn-primary btn-block btn-lg" onClick={handleSendOTP} disabled={isSending} style={{ opacity: isSending ? 0.7 : 1, cursor: isSending ? 'not-allowed' : 'pointer' }}>
                                {isSending ? '⏳ Sending Code…' : 'Send Code via SMS →'}
                            </button>
                            <ErrorBox msg={error} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 32 }}>
                            {Object.values(SPORTS).map(s => <span key={s.name} style={{ fontSize: '1.5rem', opacity: 0.4, animation: 'float 3s ease-in-out infinite', animationDelay: `${Math.random()}s` }}>{s.emoji}</span>)}
                        </div>
                    </div>
                )}

                {step === 'otp' && (
                    <div className="animate-fade-in">
                        <div className="glass-card no-hover" style={{ padding: 32 }}>
                            <h3 style={{ marginBottom: 4 }}>Check your texts</h3>
                            <p className="text-muted text-sm" style={{ marginBottom: 6 }}>We sent a 6-digit code to</p>
                            <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 24, color: 'var(--text-accent)' }}>{phone}</p>

                            <div className="otp-container" style={{ marginBottom: 24 }}>
                                {otp.map((digit, i) => (
                                    <input
                                        key={i}
                                        id={`otp-${i}`}
                                        type="text"
                                        inputMode="numeric"
                                        className="otp-input"
                                        style={{ borderColor: digit ? '#6366f1' : undefined }}
                                        value={digit}
                                        onChange={e => handleOtpChange(i, e.target.value)}
                                        onKeyDown={e => handleOtpKeyDown(i, e)}
                                        onPaste={e => { e.preventDefault(); handleOtpChange(i, e.clipboardData.getData('text')); }}
                                        maxLength={6}
                                        autoFocus={i === 0}
                                    />
                                ))}
                            </div>

                            <button
                                className="btn btn-primary btn-block btn-lg"
                                onClick={handleVerifyOTP}
                                disabled={isSending}
                                style={{ opacity: isSending ? 0.7 : 1, cursor: isSending ? 'not-allowed' : 'pointer' }}
                            >
                                {isSending ? '⏳ Verifying…' : 'Verify →'}
                            </button>

                            <ErrorBox msg={error} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
                                <button className="btn btn-ghost" style={{ fontSize: '0.875rem', padding: '8px 0' }} onClick={() => { setStep('phone'); setError(''); setOtp(['','','','','','']); }}>
                                    ← Change number
                                </button>
                                <button
                                    className="btn btn-ghost"
                                    style={{ fontSize: '0.875rem', padding: '8px 0', opacity: resendCountdown > 0 ? 0.5 : 1, cursor: resendCountdown > 0 ? 'not-allowed' : 'pointer' }}
                                    onClick={handleResend}
                                    disabled={resendCountdown > 0 || isSending}
                                >
                                    {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend Code'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'onboarding' && (
                    <div className="animate-slide-up">
                        <div className="glass-card no-hover" style={{ padding: 32 }}>
                            {/* Progress bar */}
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step {onboardStep + 1} of 5</div>
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {onboardingSteps.map((_, i) => (
                                        <div key={i} style={{
                                            flex: 1, height: 4, borderRadius: 2,
                                            background: i < onboardStep ? '#6366f1' : i === onboardStep ? 'linear-gradient(90deg, #6366f1, #a855f7)' : 'var(--border-color)',
                                            transition: 'all 0.3s',
                                        }} />
                                    ))}
                                </div>
                            </div>

                            {onboardingSteps[onboardStep]}

                            {stepError && <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: 16, padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)' }}>⚠️ {stepError}</div>}

                            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                                {onboardStep > 0 && <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setOnboardStep(s => s - 1); setStepError(''); }}>← Back</button>}
                                <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => { if (validateOnboardStep(onboardStep)) { if (onboardStep < onboardingSteps.length - 1) setOnboardStep(s => s + 1); else handleComplete(); } }}>
                                    {onboardStep < onboardingSteps.length - 1 ? 'Next →' : 'Complete Profile 🚀'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
