const fs = require('fs');
const path = 'c:\\Users\\Param\\Downloads\\New folder\\sportsvault\\components\\AuthPage.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Add state
const stateInsert = `    const [step, setStep] = useState('email'); // email, otp, onboarding
    const [authMode, setAuthMode] = useState('login'); // login, signup
    const [rememberMe, setRememberMe] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [expectedOtp, setExpectedOtp] = useState('');`;

content = content.replace(/const \[step, setStep\] = useState\('email'\);[\s\S]*?const \[expectedOtp, setExpectedOtp\] = useState\(''\);/, stateInsert);

// 2. Wrap Email Step in Tabs
const emailStepRegex = /\{step === 'email' && \(\s*<div className="animate-fade-in">\s*<div className="glass-card no-hover" style=\{\{ padding: 32 \}\}>[\s\S]*?<\/div>/;
const newEmailStep = `{step === 'email' && (
                    <div className="animate-fade-in">
                        <div className="glass-card no-hover" style={{ padding: 32 }}>
                            {/* Tabs */}
                            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 12, marginBottom: 24 }}>
                                <button 
                                    onClick={() => setAuthMode('login')}
                                    style={{ 
                                        flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                        background: authMode === 'login' ? 'var(--bg-card)' : 'transparent',
                                        color: authMode === 'login' ? 'var(--text-primary)' : 'var(--text-muted)',
                                        fontWeight: 600, fontSize: '0.875rem', transition: 'all 0.2s'
                                    }}
                                >
                                    Log In
                                </button>
                                <button 
                                    onClick={() => setAuthMode('signup')}
                                    style={{ 
                                        flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                        background: authMode === 'signup' ? 'var(--bg-card)' : 'transparent',
                                        color: authMode === 'signup' ? 'var(--text-primary)' : 'var(--text-muted)',
                                        fontWeight: 600, fontSize: '0.875rem', transition: 'all 0.2s'
                                    }}
                                >
                                    Sign Up
                                </button>
                            </div>

                            <h3 style={{ marginBottom: 4 }}>{authMode === 'login' ? 'Welcome back' : 'Create account'}</h3>
                            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>
                                {authMode === 'login' ? 'Log in with your email and password' : "We'll send you a secure signup code"}
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
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                                    <input 
                                        type="password" 
                                        placeholder="••••••••" 
                                        value={password} 
                                        onChange={(e) => setPassword(e.target.value)}
                                        style={{ width: '100%', fontSize: '1rem', padding: '14px 16px' }}
                                    />
                                </div>
                            </div>

                            {authMode === 'login' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                                    <input 
                                        type="checkbox" 
                                        id="rememberMe" 
                                        checked={rememberMe} 
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                                    />
                                    <label htmlFor="rememberMe" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                        Remember me for 30 days
                                    </label>
                                </div>
                            )}

                            <button 
                                className="btn btn-primary btn-block btn-lg" 
                                onClick={authMode === 'login' ? handleLogin : handleSendOTP} 
                                disabled={isSending}
                            >
                                {isSending ? 'Please wait...' : authMode === 'login' ? 'Log In →' : 'Send Code →'}
                            </button>
                        </div>`;

content = content.replace(emailStepRegex, newEmailStep);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated AuthPage.js');
