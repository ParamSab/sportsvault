const fs = require('fs');

// Fix GameDetailPage.js nesting
const detailPath = 'c:\\Users\\Param\\Downloads\\New folder\\sportsvault\\components\\GameDetailPage.js';
let content = fs.readFileSync(detailPath, 'utf8');

// The receipt is currently inside the organizer div or the list div.
// I'll extract it and place it after the list div.

const receiptBlockRegex = /\{game\.bookingImage && \(\s*<div style=\{\{ marginTop: 24, padding: 16, background: 'var\(--bg-input\)', borderRadius: 16, border: '1px solid var\(--border-color\)' \}\}>[\s\S]*?<\/div>\s*\)\}/;
const match = content.match(receiptBlockRegex);

if (match) {
    const extracted = match[0];
    content = content.replace(receiptBlockRegex, '');

    // Find the end of the info list
    // The list starts at: <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    // And ends with two </div></div>

    const listEnd = `                        </div>
                    </div>
                </div>`;

    // I'll place it right before the Embedded Mini-Map
    content = content.replace('                {/* Embedded Mini-Map */}', extracted + '\n                {/* Embedded Mini-Map */}');
}

fs.writeFileSync(detailPath, content, 'utf8');
console.log('Fixed nesting in GameDetailPage.js');
