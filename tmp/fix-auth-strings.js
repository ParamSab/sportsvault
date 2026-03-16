const fs = require('fs');
const authPath = 'c:\\Users\\Param\\Downloads\\New folder\\sportsvault\\components\\AuthPage.js';
let content = fs.readFileSync(authPath, 'utf8');

content = content.replace(
    /Enter the 6-digit code sent to \{email\}/,
    `Enter the 6-digit code sent to {authMode === 'signup' ? profile.phone : email}`
);

content = content.replace(
    /Change email<\/button>/,
    `Change {authMode === 'signup' ? 'number' : 'email'}</button>`
);

content = content.replace(
    /💡 Wait a few seconds for the email to arrive/,
    `💡 Wait a few seconds for the {authMode === 'signup' ? 'WhatsApp message' : 'email'} to arrive`
);

fs.writeFileSync(authPath, content, 'utf8');
console.log('Fixed WhatsApp text strings in AuthPage.js');
