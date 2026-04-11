'use client';
import { getInitials } from '@/lib/mockData';

// Maps each position label → row index on pitch (0 = GK end, higher = attacking end)
const FOOTBALL_ROWS = {
    'Goalkeeper':  0,
    'Centre-Back': 1, 'Full-Back': 1,
    'CDM':         2,
    'CM':          3, 'CAM': 3,
    'Winger':      4,
    'Striker':     5,
};

const CRICKET_ROWS = {
    'Wicketkeeper': 0, 'Wicketkeeper-Batsman': 0,
    'Batsman':      1,
    'All-Rounder':  2,
    'Bowler':       3,
};

const PADEL_ROWS = {
    'Drive (Right)': 0,
    'Revés (Left)':  1,
};

function getRow(sport, position) {
    const map = sport === 'football' ? FOOTBALL_ROWS : sport === 'cricket' ? CRICKET_ROWS : PADEL_ROWS;
    return map[position] ?? 99; // unknown → bottom
}

function groupByRow(players, sport) {
    const groups = {};
    players.forEach(p => {
        const row = getRow(sport, p.rsvpPosition);
        if (!groups[row]) groups[row] = [];
        groups[row].push(p);
    });
    // Sort groups by row descending (top of pitch first visually)
    return Object.entries(groups)
        .sort(([a], [b]) => Number(b) - Number(a))
        .map(([, ps]) => ps);
}

// Small player token — avatar circle + name + position badge
function PlayerToken({ player, color, onClick }) {
    const initials = getInitials(player.name || '?');
    return (
        <div
            onClick={() => onClick && onClick(player.id)}
            style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                cursor: onClick ? 'pointer' : 'default',
                width: 58,
            }}
        >
            {/* Circle */}
            <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: player.photo ? `url(${player.photo}) center/cover` : `${color}30`,
                border: `2.5px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: player.photo ? 0 : '0.75rem',
                fontWeight: 800, color,
                boxShadow: `0 0 0 2px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)`,
                flexShrink: 0,
            }}>
                {player.photo ? '' : initials}
            </div>
            {/* Name plate */}
            <div style={{
                background: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(4px)',
                border: `1px solid ${color}50`,
                borderRadius: 4,
                padding: '2px 5px',
                maxWidth: 58,
                textAlign: 'center',
            }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#fff', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {(player.name || '?').split(' ')[0]}
                </div>
                {player.rsvpPosition && (
                    <div style={{ fontSize: '0.5rem', color, fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {player.rsvpPosition}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Football pitch markings ────────────────────────────────────────────────
function FootballPitch() {
    const line = { position: 'absolute', background: 'rgba(255,255,255,0.25)' };
    return (
        <>
            {/* Halfway line */}
            <div style={{ ...line, left: '8%', right: '8%', height: 1, top: '50%' }} />
            {/* Centre circle */}
            <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                width: 70, height: 70, borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.25)',
            }} />
            {/* Centre spot */}
            <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                width: 4, height: 4, borderRadius: '50%',
                background: 'rgba(255,255,255,0.4)',
            }} />
            {/* Top penalty box */}
            <div style={{ ...line, left: '20%', right: '20%', height: 1, top: '14%' }} />
            <div style={{ ...line, width: 1, left: '20%', top: '5%', height: '9%' }} />
            <div style={{ ...line, width: 1, right: '20%', top: '5%', height: '9%' }} />
            {/* Top 6-yard box */}
            <div style={{ ...line, left: '33%', right: '33%', height: 1, top: '7%' }} />
            <div style={{ ...line, width: 1, left: '33%', top: '5%', height: '2%' }} />
            <div style={{ ...line, width: 1, right: '33%', top: '5%', height: '2%' }} />
            {/* Top penalty spot */}
            <div style={{ position: 'absolute', left: '50%', top: '11%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
            {/* Bottom penalty box */}
            <div style={{ ...line, left: '20%', right: '20%', height: 1, bottom: '14%' }} />
            <div style={{ ...line, width: 1, left: '20%', bottom: '5%', height: '9%' }} />
            <div style={{ ...line, width: 1, right: '20%', bottom: '5%', height: '9%' }} />
            {/* Bottom 6-yard box */}
            <div style={{ ...line, left: '33%', right: '33%', height: 1, bottom: '7%' }} />
            <div style={{ ...line, width: 1, left: '33%', bottom: '5%', height: '2%' }} />
            <div style={{ ...line, width: 1, right: '33%', bottom: '5%', height: '2%' }} />
            {/* Bottom penalty spot */}
            <div style={{ position: 'absolute', left: '50%', bottom: '11%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
        </>
    );
}

// ─── Padel court markings ────────────────────────────────────────────────────
function PadelCourt() {
    const line = { position: 'absolute', background: 'rgba(255,255,255,0.3)' };
    return (
        <>
            {/* Service boxes - horizontal middle */}
            <div style={{ ...line, left: '8%', right: '8%', height: 1, top: '50%' }} />
            {/* Centre service line */}
            <div style={{ ...line, width: 1, left: '50%', top: '20%', height: '60%' }} />
            {/* Service lines top/bottom */}
            <div style={{ ...line, left: '8%', right: '8%', height: 1, top: '20%' }} />
            <div style={{ ...line, left: '8%', right: '8%', height: 1, bottom: '20%' }} />
        </>
    );
}

// ─── Cricket pitch markings ─────────────────────────────────────────────────
function CricketPitch() {
    const line = { position: 'absolute', background: 'rgba(255,255,255,0.25)' };
    return (
        <>
            {/* Pitch rectangle */}
            <div style={{
                position: 'absolute', left: '38%', right: '38%', top: '25%', bottom: '25%',
                border: '1px solid rgba(255,255,255,0.3)', borderRadius: 2,
                background: 'rgba(255,255,255,0.05)',
            }} />
            {/* Crease lines */}
            <div style={{ ...line, left: '38%', right: '38%', height: 1, top: '32%' }} />
            <div style={{ ...line, left: '38%', right: '38%', height: 1, bottom: '32%' }} />
            {/* Circle outline */}
            <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                width: 140, height: 140, borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.2)',
            }} />
        </>
    );
}

// ─── Empty slot placeholder ──────────────────────────────────────────────────
function EmptySlot({ color }) {
    return (
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: `2px dashed ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.1rem', opacity: 0.3 }}>＋</span>
        </div>
    );
}

export default function PitchView({ players, sport, maxPlayers, color, onViewProfile }) {
    const rows = groupByRow(players, sport);
    const filled = players.length;
    const empty = Math.max(0, maxPlayers - filled);

    // Pick pitch gradient + markings
    const pitchBg = sport === 'padel'
        ? 'linear-gradient(180deg, #1a6b3c 0%, #1e7a45 40%, #1e7a45 60%, #1a6b3c 100%)'
        : sport === 'cricket'
        ? 'linear-gradient(180deg, #2d5a1b 0%, #3a7223 100%)'
        : 'linear-gradient(180deg, #1a5c2e 0%, #1e6e36 35%, #1e6e36 65%, #1a5c2e 100%)';

    const pitchMarkings = sport === 'padel' ? <PadelCourt /> : sport === 'cricket' ? <CricketPitch /> : <FootballPitch />;

    return (
        <div>
            {/* Pitch */}
            <div style={{
                position: 'relative',
                background: pitchBg,
                borderRadius: 16,
                border: `2px solid ${color}40`,
                overflow: 'hidden',
                padding: '20px 12px',
                minHeight: rows.length > 0 ? (rows.length * 90 + 40) : 240,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-around',
                gap: 4,
            }}>
                {/* Pitch border lines */}
                <div style={{ position: 'absolute', inset: 8, border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 10, pointerEvents: 'none' }} />
                {pitchMarkings}

                {rows.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: 32, position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '2rem', marginBottom: 8 }}>👟</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>No confirmed players yet</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>RSVP to be the first on the pitch</div>
                    </div>
                ) : (
                    rows.map((rowPlayers, i) => (
                        <div key={i} style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 8,
                            flexWrap: 'wrap',
                            position: 'relative',
                            zIndex: 1,
                            padding: '4px 0',
                        }}>
                            {rowPlayers.map(p => (
                                <PlayerToken key={p.id} player={p} color={color} onClick={onViewProfile} />
                            ))}
                        </div>
                    ))
                )}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, padding: '0 4px' }}>
                <div style={{ display: 'flex', gap: 16 }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, marginRight: 4, opacity: 0.8 }} />
                        {filled} confirmed
                    </span>
                    {empty > 0 && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: `1.5px dashed ${color}60`, marginRight: 4 }} />
                            {empty} open
                        </span>
                    )}
                </div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Tap a player to view profile
                </span>
            </div>
        </div>
    );
}
