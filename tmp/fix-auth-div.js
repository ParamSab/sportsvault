const fs = require('fs');

const authPath = 'c:\\Users\\Param\\Downloads\\New folder\\sportsvault\\components\\AuthPage.js';
let content = fs.readFileSync(authPath, 'utf8');

// Looking for the specific line 412
const target = `                            </button>\r\n                        \r\n                        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 32 }}>`;
const targetMac = `                            </button>\n                        \n                        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 32 }}>`;

const replacement = `                            </button>\n                        </div>\n                        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 32 }}>`;

if (content.includes('</button>\r\n                        \r\n                        <div style={{ display: \'flex\', justifyContent: \'center\', gap: 24, marginTop: 32 }}>')) {
    content = content.replace('</button>\r\n                        \r\n                        <div style={{ display: \'flex\', justifyContent: \'center\', gap: 24, marginTop: 32 }}>', replacement);
} else if (content.includes('</button>\n                        \n                        <div style={{ display: \'flex\', justifyContent: \'center\', gap: 24, marginTop: 32 }}>')) {
    content = content.replace('</button>\n                        \n                        <div style={{ display: \'flex\', justifyContent: \'center\', gap: 24, marginTop: 32 }}>', replacement);
} else {
    // Regex fallback
    content = content.replace(/<\/button>\s*<div style=\{\{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 32 \}\}>/g, replacement);
}

fs.writeFileSync(authPath, content, 'utf8');
console.log('Fixed div in AuthPage.js');
