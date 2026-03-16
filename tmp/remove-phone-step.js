const fs = require('fs');
const authPath = 'c:\\Users\\Param\\Downloads\\New folder\\sportsvault\\components\\AuthPage.js';
let content = fs.readFileSync(authPath, 'utf8');

// 1. Update validation
const oldValidation = `    const validateOnboardStep = (idx) => {
        if (idx === 0 && profile.name.trim().length < 2) { setStepError('Please enter your full name (at least 2 characters)'); return false; }
        if (idx === 1 && (profile.phone && profile.phone.length < 10)) { setStepError('Please enter a valid phone number'); return false; }
        // Photo is now optional
        if (idx === 2) { /* skip photo skip check */ }
        if (idx === 3 && !profile.location.trim()) { setStepError('Please enter your city or neighbourhood'); return false; }
        if (idx === 4 && profile.sports.length === 0) { setStepError('Select at least one sport'); return false; }
        if (idx === 5) {
            const missing = profile.sports.filter(s => !profile.positions[s]);
            if (missing.length > 0) { setStepError(\`Select your position for: \${missing.join(', ')}\`); return false; }
        }
        setStepError('');
        return true;
    };`;

const newValidation = `    const validateOnboardStep = (idx) => {
        if (idx === 0 && profile.name.trim().length < 2) { setStepError('Please enter your full name (at least 2 characters)'); return false; }
        // Photo is now optional (idx 1)
        if (idx === 2 && !profile.location.trim()) { setStepError('Please enter your city or neighbourhood'); return false; }
        if (idx === 3 && profile.sports.length === 0) { setStepError('Select at least one sport'); return false; }
        if (idx === 4) {
            const missing = profile.sports.filter(s => !profile.positions[s]);
            if (missing.length > 0) { setStepError(\`Select your position for: \${missing.join(', ')}\`); return false; }
        }
        setStepError('');
        return true;
    };`;

content = content.replace(oldValidation, newValidation);

// 2. Remove Phone Step from onboardingSteps
const phoneStepRegex = /\/\/ Step 1: Phone\s*<div key="phone" className="animate-fade-in">[\s\S]*?<\/div>,\s*\/\/ Step 1: Photo/;
content = content.replace(phoneStepRegex, '// Step 1: Photo');

fs.writeFileSync(authPath, content, 'utf8');
console.log('Successfully removed redundant phone step from AuthPage.js onboarding');
