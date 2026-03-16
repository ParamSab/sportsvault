const fs = require('fs');

const authPath = 'c:\\Users\\Param\\Downloads\\New folder\\sportsvault\\components\\AuthPage.js';
let content = fs.readFileSync(authPath, 'utf8');

// 1. Clean up THAT duplicated block again just in case (lines 421-436)
const dirtyRegex = /<\/div>\s*<div>\s*<label style=\{\{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var\(--text-secondary\)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' \}\}>Password<\/label>\s*<input\s*type="password"\s*placeholder="••••••••"\s*value=\{password\}\s*onChange=\{\(e\) => setPassword\(e\.target\.value\)\}\s*style=\{\{ width: '100%', fontSize: '1rem', padding: '14px 16px' \}\}\s*\/>\s*<\/div>\s*<\/div>\s*<button className="btn btn-primary btn-block btn-lg" onClick=\{handleSendOTP\} disabled=\{isSending\}>\s*\{isSending \? 'Sending\.\.\.' : 'Send Code →'\}\s*<\/button>\s*<\/div>/;

content = content.replace(dirtyRegex, '');

// 2. Add phone input to Signup flow
const emailBlockTarget = `                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                                    <input 
                                        type="password" 
                                        placeholder="••••••••" 
                                        value={password} 
                                        onChange={(e) => setPassword(e.target.value)}
                                        style={{ width: '100%', fontSize: '1rem', padding: '14px 16px' }}
                                    />
                                </div>
                            </div>`;

const newEmailBlockTarget = `                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                                    <input 
                                        type="password" 
                                        placeholder="••••••••" 
                                        value={password} 
                                        onChange={(e) => setPassword(e.target.value)}
                                        style={{ width: '100%', fontSize: '1rem', padding: '14px 16px' }}
                                    />
                                </div>
                                {authMode === 'signup' && (
                                    <div style={{ marginTop: 16 }}>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>WhatsApp Number</label>
                                        <input 
                                            type="tel" 
                                            placeholder="+91 99999 99999" 
                                            value={profile.phone} 
                                            onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                                            style={{ width: '100%', fontSize: '1rem', padding: '14px 16px' }}
                                        />
                                    </div>
                                )}
                            </div>`;

content = content.replace(emailBlockTarget, newEmailBlockTarget);

// 3. Update handleSendOTP to use WhatsApp
const oldHandleSendOtp = `    const handleSendOTP = async () => {
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
    };`;

const newHandleSendOtp = `    const handleSendOTP = async () => {
        if (!email.includes('@')) return alert("Enter a valid email");
        if (authMode === 'signup' && profile.phone.length < 10) return alert("Enter a valid WhatsApp number");

        setIsSending(true);
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        setExpectedOtp(code);

        try {
            const endpoint = '/api/auth/otp/send';
            const payload = { to: profile.phone, code };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to send WhatsApp OTP");
            }
            setStep('otp');
        } catch (err) {
            console.error(err);
            alert("Could not send WhatsApp code. Defaulting to 123456 for testing.");
            setExpectedOtp("123456");
            setStep('otp');
        } finally {
            setIsSending(false);
        }
    };`;

content = content.replace(oldHandleSendOtp, newHandleSendOtp);

// 4. Update the text strings for the OTP step
content = content.replace(
    /{authMode === 'login' \? 'Log in with your email and password' : "We'll send you a secure signup code"}/,
    `{authMode === 'login' ? 'Log in with your email and password' : "We'll send a code to your WhatsApp"}`
);
content = content.replace(
    /<h3 style={{ marginBottom: 4 }}>Check your inbox<\/h3>/,
    `<h3 style={{ marginBottom: 4 }}>Check WhatsApp</h3>`
);
content = content.replace(
    /<p className="text-muted text-sm" style={{ marginBottom: 24 }}>\s*We've sent a 6-digit code to <strong style={{ color: 'var\(--text-primary\)' }}>\{email\}<\/strong>\s*<\/p>/,
    `<p className="text-muted text-sm" style={{ marginBottom: 24 }}>
                                We've sent a 6-digit code via WhatsApp to <strong style={{ color: 'var(--text-primary)' }}>{profile.phone}</strong>
                            </p>`
);

fs.writeFileSync(authPath, content, 'utf8');
console.log('Successfully updated AuthPage.js for WhatsApp OTPs');
