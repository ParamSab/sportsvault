const fs = require('fs');
const path = 'c:\\Users\\Param\\Downloads\\New folder\\sportsvault\\components\\AuthPage.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /\{!profile\.photo && onboardStep === 1 && \(\s*<div className="text-xs" style=\{\{ color: 'var\(--danger\)', marginTop: 8 \}\}>\s*\* Profile photo is required\s*<\/div>\s*\)\}/g;

content = content.replace(regex, '');
content = content.replace('<div className="text-sm text-secondary">Tap to upload</div>', '<div className="text-sm text-secondary">Tap to upload (Optional)</div>');

fs.writeFileSync(path, content, 'utf8');
console.log('done');
