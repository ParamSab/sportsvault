const fs = require('fs');

// 1. Update /api/games/route.js
const apiPath = 'c:\\Users\\Param\\Downloads\\New folder\\sportsvault\\app\\api\\games\\route.js';
let apiContent = fs.readFileSync(apiPath, 'utf8');
apiContent = apiContent.replace(
    /approvalRequired: !!game\.approvalRequired,/,
    'approvalRequired: !!game.approvalRequired,\n                bookingImage: game.bookingImage || null,'
);
fs.writeFileSync(apiPath, apiContent, 'utf8');
console.log('Updated /api/games/route.js');

// 2. Update GameDetailPage.js
const detailPath = 'c:\\Users\\Param\\Downloads\\New folder\\sportsvault\\components\\GameDetailPage.js';
let detailContent = fs.readFileSync(detailPath, 'utf8');

// Add "Verified" badge in the header section
const badgeInsert = `                {game.bookingImage && (
                    <div style={{ 
                        marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, 
                        padding: '6px 12px', background: 'rgba(34,197,94,0.15)', 
                        border: '1px solid rgba(34,197,94,0.3)', borderRadius: 99,
                        color: '#4ade80', fontSize: '0.75rem', fontWeight: 700 
                    }}>
                        ✅ BOOKING VERIFIED
                    </div>
                )}`;

// Find the header section and insert the badge
detailContent = detailContent.split('<h1 style={{ fontSize: \'1.75rem\', fontWeight: 900, marginBottom: 8 }}>{game.title}</h1>').join('<h1 style={{ fontSize: \'1.75rem\', fontWeight: 900, marginBottom: 8 }}>{game.title}</h1>' + badgeInsert);

// Add "Message Attendees" button for WhatsApp coordination
const waButtonInsert = `
                {isOrganizer && confirmedPlayers.length > 0 && (
                    <div style={{ marginTop: 24 }}>
                        <h4 style={{ marginBottom: 12, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>HOST COORDINATION</h4>
                        <a 
                            href={\`https://wa.me/?text=\${encodeURIComponent(\`Hey! Venue booked for our \${game.sport} game at \${game.location}. Check the receipt here: \${window.location.href}\`)}\`}
                            target="_blank"
                            className="btn btn-outline btn-block"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderColor: '#25d366', color: '#25d366' }}
                        >
                            <span>💬</span> WhatsApp Attendees
                        </a>
                    </div>
                )}`;

// Insert before the RSVPs section or similar
detailContent = detailContent.split('<div className="rsvp-section"').join(waButtonInsert + '\n                <div className="rsvp-section"');

// Show the receipt if it exists
const receiptInsert = `
                {game.bookingImage && (
                    <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-input)', borderRadius: 16, border: '1px solid var(--border-color)' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                            📜 Booking Receipt
                        </div>
                        <img 
                            src={game.bookingImage} 
                            style={{ width: '100%', borderRadius: 12, border: '1px solid var(--border-color)', pointerEvents: 'none' }} 
                            alt="Booking Proof" 
                        />
                    </div>
                )}`;

detailContent = detailContent.split('</p>').join('</p>' + receiptInsert); // Simple insertion after descriptions

fs.writeFileSync(detailPath, detailContent, 'utf8');
console.log('Updated GameDetailPage.js');
