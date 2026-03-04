const fs = require('fs');
const path = 'c:\\Users\\Param\\Downloads\\New folder\\sportsvault\\components\\GameDetailPage.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Update RSVP variable definitions
content = content.replace(
    /const sport = SPORTS\[game\.sport\];\n    const confirmedRsvps = game\.rsvps\.filter\(r => r\.status === 'yes'\);\n    const backupRsvps = game\.rsvps\.filter\(r => r\.status === 'backup'\);\n    const maybeRsvps = game\.rsvps\.filter\(r => r\.status === 'maybe'\);\n    const spots = spotsLeft\(game\);/,
    `const sport = SPORTS[game.sport];
    const confirmedRsvps = game.rsvps.filter(r => r.status === 'yes' || r.status === 'checked_in');
    const backupRsvps = game.rsvps.filter(r => r.status === 'backup');
    const maybeRsvps = game.rsvps.filter(r => r.status === 'maybe');
    const pendingRsvps = game.rsvps.filter(r => r.status === 'pending');
    const spots = Math.max(0, game.maxPlayers - confirmedRsvps.length);`
);

// 2. Update handleRSVP logic
const handleRsvpRegex = /const handleRSVP = async \(status\) => \{[\s\S]*?dispatch\({ type: 'RSVP', payload: { gameId, playerId: currentUserId, status, position: pos } }\);/;
const newHandleRsvp = `const handleRSVP = async (status) => {
        let finalStatus = status;

        // Check dropout penalty
        if ((myRsvp?.status === 'yes' || myRsvp?.status === 'checked_in') && status === 'no') {
            const gameStart = new Date(\`\${game.date}T\${game.time || '00:00'}\`);
            const hoursUntil = (gameStart - new Date()) / (1000 * 60 * 60);
            if (hoursUntil < 24 && hoursUntil > 0) {
                if (!window.confirm("Dropping out within 24 hours of the game will negatively affect your Reliability Score. Are you sure you want to drop out?")) {
                    return;
                }
            }
        }

        if (status === 'yes') {
            if (spots <= 0 && myRsvp?.status !== 'yes' && myRsvp?.status !== 'checked_in') {
                finalStatus = 'backup';
            } else if (game.approvalRequired && myRsvp?.status !== 'yes' && myRsvp?.status !== 'checked_in') {
                finalStatus = 'pending';
            }
        }

        const pos = selectedPosition || state.currentUser?.positions?.[game.sport] || POSITIONS[game.sport]?.[0] || '';
        dispatch({ type: 'RSVP', payload: { gameId, playerId: currentUserId, status: finalStatus, position: pos } });`;

content = content.replace(handleRsvpRegex, newHandleRsvp);

// 2.5 Ensure the finalStatus is passed to the DB fetch as well
content = content.replace(
    /body: JSON\.stringify\(\{ gameId, playerId: state\.currentUser\.dbId, status, position: pos \}\),/,
    `body: JSON.stringify({ gameId, playerId: state.currentUser.dbId, status: finalStatus, position: pos }),`
);

// 3. Add helper functions
const getYesButtonTextHelpers = `
    const getYesButtonText = () => {
        if (myRsvp?.status === 'yes') return '✅ Yes!';
        if (myRsvp?.status === 'checked_in') return '🏟️ Checked In';
        if (myRsvp?.status === 'pending') return '⏳ Requested';
        if (myRsvp?.status !== 'yes' && myRsvp?.status !== 'checked_in' && spots <= 0) return '📝 Join Waitlist';
        if (myRsvp?.status !== 'yes' && myRsvp?.status !== 'checked_in' && game.approvalRequired) return '✋ Request to Join';
        return '✅ Yes';
    };

    const handleHostAction = async (playerId, status) => {
        dispatch({ type: 'RSVP', payload: { gameId, playerId, status } });
        if (state.currentUser?.dbId) {
            const dbPlayer = state.players?.find(p => p.id === playerId);
            if (dbPlayer && dbPlayer.dbId) {
                fetch('/api/games/rsvp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ gameId, playerId: dbPlayer.dbId, status })
                }).catch(()=>{});
            }
        }
    };
    
    const cancelGame = async () => {
        if (!window.confirm("Are you sure you want to cancel this game? This will notify all players.")) return;
        dispatch({ type: 'UPDATE_GAME', payload: { id: game.id, status: 'cancelled' } });
        if (state.currentUser?.dbId) {
             // For a real app, you'd hit a PUT /api/games endpoint here.
             // We'll leave the local dispatch for prototype visualization.
        }
        onBack();
    };
`;

content = content.replace(
    /const buildBlastMessage = \(\) => \{/,
    `${getYesButtonTextHelpers}\n\n    const buildBlastMessage = () => {`
);

// 4. Update RSVP buttons UI
const rsvpButtonsRegex = /<div style=\{\{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 \}\}>\s*<button className=\{`btn btn-sm \$\{myRsvp\?\.status === 'yes' \? 'btn-rsvp-yes' : 'btn-outline'\}`\} onClick=\{\(\) => handleRSVP\('yes'\)\}>\s*✅ Yes\{myRsvp\?\.status === 'yes' \? '!' : ''\}\s*<\/button>/;
const newRsvpButtons = `<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                <button className={\`btn btn-sm \${(myRsvp?.status === 'yes' || myRsvp?.status === 'checked_in' || myRsvp?.status === 'pending') ? 'btn-rsvp-yes' : 'btn-outline'}\`} onClick={() => handleRSVP('yes')}>
                    {getYesButtonText()}
                </button>`;
content = content.replace(rsvpButtonsRegex, newRsvpButtons);


// 5. Approvals List UI for host
const pendingRequestsUI = `
            {/* Host Approvals */}
            {isOrganizer && pendingRsvps.length > 0 && (
                <div className="glass-card no-hover animate-fade-in" style={{ marginBottom: 16, border: '1px solid var(--warning)' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 12, color: 'var(--warning)' }}>
                        ✋ Pending Approvals ({pendingRsvps.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {pendingRsvps.map(r => {
                            const p = getPlayer(r.playerId) || state.players?.find(pl => pl.id === r.playerId);
                            if (!p) return null;
                            return (
                                <div key={r.playerId} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-body)', padding: '10px 12px', borderRadius: 8 }}>
                                    <div className="avatar" style={{ width: 32, height: 32, background: p.photo ? \`url(\${p.photo}) center/cover\` : undefined, fontSize: p.photo ? '0' : '0.6875rem' }}>
                                        {p.photo ? '' : getInitials(p.name)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.name}</div>
                                        {p.ratings?.[game.sport]?.count >= 1 && <div className="text-xs text-muted">⭐ {p.ratings[game.sport].overall} Reliability</div>}
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)', padding: '4px 8px' }} onClick={() => handleHostAction(r.playerId, 'no')}>Deny</button>
                                        <button className="btn btn-sm btn-primary" style={{ padding: '4px 12px' }} onClick={() => handleHostAction(r.playerId, 'yes')} disabled={spots <= 0}>Accept</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
`;

content = content.replace(
    /\{\/\* Attendee Lists \*\/\}/,
    `${pendingRequestsUI}\n            {/* Attendee Lists */}`
);

// 6. Check In buttons for confirmed list
content = content.replace(
    /\{p\.ratings\?\.\[game\.sport\]\?\.count >= 10 && <span className="text-xs" style=\{\{ color: 'var\(--warning\)' \}\}>⭐ \{p\.ratings\[game\.sport\]\.overall\}<\/span>\}/,
    `{p.ratings?.[game.sport]?.count >= 10 && <span className="text-xs" style={{ color: 'var(--warning)' }}>⭐ {p.ratings[game.sport].overall}</span>}
                                    {isOrganizer && r.status !== 'checked_in' && (
                                        <button className="btn btn-sm btn-outline" style={{ padding: '4px 10px', fontSize: '0.7rem' }} onClick={() => handleHostAction(r.playerId, 'checked_in')}>Check In</button>
                                    )}
                                    {r.status === 'checked_in' && (
                                        <span className="text-xs" style={{ color: 'var(--success)', fontWeight: 700, padding: '4px 8px', background: 'rgba(34,197,94,0.1)', borderRadius: 4 }}>✓ Checked In</span>
                                    )}`
);

// 7. Cancel Game button at the very bottom
content = content.replace(
    /<\/div>\n    \);\n\}\n$/,
    `
                {isOrganizer && (
                    <button className="btn btn-block btn-ghost" style={{ color: 'var(--danger)', marginTop: 24, padding: '16px' }} onClick={cancelGame}>
                        Cancel Game
                    </button>
                )}
            </div>
    );
}
`
);

fs.writeFileSync(path, content, 'utf8');
console.log('done');
