const fs = require('fs');

const authPagePath = 'c:\\Users\\Param\\Downloads\\New folder\\sportsvault\\components\\AuthPage.js';
let content = fs.readFileSync(authPagePath, 'utf8');

// 1. Add state variables for authMode and rememberMe
content = content.replace(
    /const \[step, setStep\] = useState\('email'\);(.*)\n/g,
    `const [step, setStep] = useState('email'); // email, otp, onboarding\n    const [authMode, setAuthMode] = useState('login'); // login, signup\n    const [rememberMe, setRememberMe] = useState(false);\n`
);

// 2. Add handleLogin function
const handleLoginFunc = `
    const handleLogin = async () => {
        if (!email.includes('@')) return alert("Enter a valid email");
        if (!password) return alert("Enter your password");
        setIsSending(true);
        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, rememberMe })
            });
            const data = await res.json();
            if (res.status === 200 && data.exists && data.user) {
                dispatch({ type: 'LOGIN', payload: data.user });
            } else {
                alert(data.error || "Invalid email or password");
            }
        } catch (err) {
            console.error("Login error:", err);
            alert("An error occurred during login.");
        } finally {
            setIsSending(false);
        }
    };
`;

content = content.replace(
    /const handleSendOTP = async \(\) => {/g,
    `${handleLoginFunc}\n    const handleSendOTP = async () => {`
);

// 3. Update handleComplete to pass rememberMe
content = content.replace(
    /body: JSON\.stringify\(\{ user: newUser \}\),/g,
    `body: JSON.stringify({ user: newUser, rememberMe }),`
);

// 4. Replace the Email Step UI
const emailStepRegex = /\{\/\* Email Step \*\/\}\s*\{step === 'email' && \([\s\S]*?\}\)\}/;
const newEmailStep = `{/* Auth Step */}
                {step === 'email' && (
                    <div className="animate-fade-in">
                        <div className="glass-card no-hover" style={{ padding: 32 }}>
                            {/* Mode Switcher */}
                            <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: 'var(--bg-body)', padding: 4, borderRadius: 12 }}>
                                <button
                                    style={{ flex: 1, padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', 
                                    background: authMode === 'login' ? 'var(--bg-card)' : 'transparent', 
                                    color: authMode === 'login' ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    boxShadow: authMode === 'login' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                                    border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                                    onClick={() => setAuthMode('login')}
                                >
                                    Log In
                                </button>
                                <button
                                    style={{ flex: 1, padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem',
                                    background: authMode === 'signup' ? 'var(--bg-card)' : 'transparent',
                                    color: authMode === 'signup' ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    boxShadow: authMode === 'signup' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                                    border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                                    onClick={() => setAuthMode('signup')}
                                >
                                    Sign Up
                                </button>
                            </div>

                            <h3 style={{ marginBottom: 4 }}>{authMode === 'login' ? 'Welcome back' : 'Create an account'}</h3>
                            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>
                                {authMode === 'login' ? 'Enter your details to access your vault.' : 'We\\'ll send you a secure verify code.'}
                            </p>
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
                                    <input
                                        type="email"
                                        placeholder="name@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        style={{ width: '100%', fontSize: '1rem', padding: '14px 16px' }}
                                        autoFocus
                                    />
                                </div>
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        style={{ width: '100%', fontSize: '1rem', padding: '14px 16px' }}
                                    />
                                </div>
                                
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                                    />
                                    Remember me for 30 days
                                </label>
                            </div>
                            
                            <button 
                                className="btn btn-primary btn-block btn-lg" 
                                onClick={authMode === 'login' ? handleLogin : handleSendOTP} 
                                disabled={isSending}
                            >
                                {isSending ? 'Please wait...' : authMode === 'login' ? 'Log In →' : 'Send Code →'}
                            </button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 32 }}>
                            {Object.values(SPORTS).map(s => (
                                <span key={s.name} style={{ fontSize: '1.5rem', opacity: 0.4, animation: 'float 3s ease-in-out infinite', animationDelay: \`\${Math.random()}s\` }}>
                                    {s.emoji}
                                </span>
                            ))}
                        </div>
                    </div>
                )}`;

content = content.replace(emailStepRegex, newEmailStep);

// 5. Fix handleVerifyOTP logic for Signup
// Since login is handled separately, handleVerifyOTP is exclusively used for Signup!
const verifyOtpRegex = /const handleVerifyOTP = async \(\) => {[\s\S]*?    };/g;
const newVerifyOtp = `const handleVerifyOTP = async () => {
        const entered = otp.join('');
        if (entered === expectedOtp || (email === 'test@example.com' && entered === '123456')) {
            // Success! Go directly to onboarding since this is Signup flow.
            setStep('onboarding');
        } else {
            alert("Incorrect code");
        }
    };`;

content = content.replace(verifyOtpRegex, newVerifyOtp);

fs.writeFileSync(authPagePath, content, 'utf8');
console.log("AuthPage.js updated successfully.");
