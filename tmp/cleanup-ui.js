const fs = require('fs');

// 1. Cleanup AuthPage.js (Remove duplicate email step parts)
const authPath = 'c:\\Users\\Param\\Downloads\\New folder\\sportsvault\\components\\AuthPage.js';
let authContent = fs.readFileSync(authPath, 'utf8');

// The script accidentally left the old structure after the </div> of the new one.
// I'll find the double-definition of the email step and clean it.
const authCleanupRegex = /<button[\s\S]*?disabled=\{isSending\}>\s*\{isSending \? 'Please wait\.\.\.' : authMode === 'login' \? 'Log In â†’' : 'Send Code â†’'\}\s*<\/button>\s*<\/div>\s*<div>[\s\S]*?Send Code â†’'\}\s*<\/button>\s*<\/div>/;

// Actually, simpler: I'll just look for the specific duplicated block.
const duplicatePart = `                                <div>
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
                            <button className="btn btn-primary btn-block btn-lg" onClick={handleSendOTP} disabled={isSending}>
                                {isSending ? 'Sending...' : 'Send Code →'}
                            </button>
                        </div>`;

authContent = authContent.replace(duplicatePart, '');
fs.writeFileSync(authPath, authContent, 'utf8');
console.log('Cleaned up AuthPage.js');

// 2. Cleanup GameDetailPage.js (Fix receipt placement)
const detailPath = 'c:\\Users\\Param\\Downloads\\New folder\\sportsvault\\components\\GameDetailPage.js';
let detailContent = fs.readFileSync(detailPath, 'utf8');

// The previous script replaced ALL </p> with </p> + receipt. 
// I'll remove all instances of the receipt first, then place it ONCE in the right spot.
const receiptHeader = `<div style={{ marginTop: 24, padding: 16, background: 'var(--bg-input)', borderRadius: 16, border: '1px solid var(--border-color)' }}>`;
const receiptFooter = `alt="Booking Proof" \n                        />\n                    </div>`;

// Remove all occurrences
const receiptBlock = /\{game\.bookingImage && \(\s*<div style=\{\{ marginTop: 24, padding: 16, background: 'var\(--bg-input\)', borderRadius: 16, border: '1px solid var\(--border-color\)' \}\}>[\s\S]*?<\/div>\s*\)\}/g;
detailContent = detailContent.replace(receiptBlock, '');

// Place it properly after the "Organized by" section (line 220 roughly)
const searchMarker = `<span className="text-sm">Organized by <span style={{ fontWeight: 600, color: sport?.color, cursor: 'pointer' }} onClick={() => onViewProfile(game.organizer)}>{getPlayer(game.organizer)?.name || state.currentUser?.name || 'You'}</span></span>`;
const properReceiptInsert = `
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

detailContent = detailContent.split(searchMarker).join(searchMarker + properReceiptInsert);

fs.writeFileSync(detailPath, detailContent, 'utf8');
console.log('Cleaned up GameDetailPage.js');
