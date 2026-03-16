const fs = require('fs');
const path = 'c:\\Users\\Param\\Downloads\\New folder\\sportsvault\\components\\CreateGamePage.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Update initial state
content = content.replace(
    /approvalRequired: false,/,
    'approvalRequired: false,\n        bookingImage: null,'
);

// 2. Update handleCreate payload
content = content.replace(
    /approvalRequired: game\.approvalRequired,/,
    'approvalRequired: game.approvalRequired,\n            bookingImage: game.bookingImage,'
);

// 3. Define the new Booking step
const bookingStep = `        // 4: Booking Confirmation
        <div key="booking" className="animate-fade-in">
            <h2 style={{ marginBottom: 8 }}>Booking Receipt</h2>
            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>Upload a photo of your turf booking to build trust.</p>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <label style={{ cursor: 'pointer', position: 'relative', width: '100%' }}>
                    <div style={{
                        width: '100%', height: 200, borderRadius: 16,
                        background: game.bookingImage ? \`url(\${game.bookingImage}) center/cover\` : 'var(--bg-input)',
                        border: '2px dashed var(--border-color)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: game.bookingImage ? '0' : '2.5rem',
                        overflow: 'hidden'
                    }}>
                        {game.bookingImage ? '' : '📸'}
                    </div>
                    <input 
                        type="file" 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => update('bookingImage', reader.result);
                                reader.readAsDataURL(file);
                            }
                        }} 
                    />
                </label>
                <div className="text-sm text-secondary">Tap to upload proof (Receipt, Email, etc.)</div>
                <div className="text-xs text-muted">This is optional but highly recommended.</div>
            </div>
        </div>,
`;

// 4. Insert before Preview
content = content.replace(/\/\/ 4: Preview/, bookingStep + '\n        // 5: Preview');

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated CreateGamePage.js');
