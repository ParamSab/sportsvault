'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { SPORTS, POSITIONS, FORMATS } from '@/lib/mockData';

// Dynamic import for Leaflet (SSR-safe)
import dynamic from 'next/dynamic';
const MapPicker = dynamic(() => import('./MapPicker'), {
    ssr: false, loading: () => (
        <div style={{ height: 280, borderRadius: 12, background: '#1a2540', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            🗺️ Loading map...
        </div>
    )
});

const PRIVACY_OPTIONS = [
    { value: 'public', emoji: '🌍', label: 'Public', desc: 'Anyone can discover and join' },
    { value: 'friends', emoji: '👥', label: 'Friends Only', desc: 'Only your friends can see this game' },
    { value: 'private', emoji: '🔒', label: 'Private', desc: 'Invite-only via your Text Blast' },
];

const SKILL_LEVELS = ['All Levels', 'Beginner-Friendly', 'Intermediate', 'Advanced'];

export default function CreateGamePage({ onComplete }) {
    const { state, dispatch } = useStore();
    const [step, setStep] = useState(0);
    const [errors, setErrors] = useState({});
    const [game, setGame] = useState({
        sport: '', format: '', title: '',
        location: '', address: '',
        date: '', time: '', duration: 90,
        skillLevel: 'All Levels', maxPlayers: 10,
        lat: 19.076, lng: 72.877,
        visibility: 'public',
    });

    const update = (key, val) => setGame(prev => ({ ...prev, [key]: val }));

    const validate = (currentStep) => {
        const e = {};
        if (currentStep === 0 && !game.sport) e.sport = 'Pick a sport to continue';
        if (currentStep === 1) {
            if (!game.format) e.format = 'Select a format';
            if (!game.title.trim()) e.title = 'Give your game a title';
        }
        if (currentStep === 2) {
            if (!game.location.trim()) e.location = 'Set a venue name';
            if (!game.date) e.date = 'Set a date';
            if (!game.time) e.time = 'Set a time';
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleNext = () => {
        if (validate(step)) setStep(s => s + 1);
    };

    const handleCreate = async () => {
        const newGame = {
            ...game,
            id: `g${Date.now()}`,
            organizer: state.currentUser?.id || 'current',
            rsvps: [{
                playerId: state.currentUser?.id || 'current',
                status: 'yes',
                position: state.currentUser?.positions?.[game.sport] || 'Unknown',
            }],
            status: 'open',
        };

        // Save to DB if user has a real DB id
        if (state.currentUser?.dbId) {
            try {
                await fetch('/api/games', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ game: newGame, userId: state.currentUser.dbId }),
                });
            } catch (_) { /* fall through to local */ }
        }

        dispatch({ type: 'CREATE_GAME', payload: newGame });
        onComplete();
    };

    const inputStyle = { width: '100%', marginBottom: 0 };
    const labelStyle = { display: 'block', marginBottom: 6, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase' };
    const errorStyle = { color: '#ef4444', fontSize: '0.75rem', marginTop: 4 };

    const steps = [
        // 0: Sport
        <div key="sport" className="animate-fade-in">
            <h2 style={{ marginBottom: 8 }}>Pick a sport</h2>
            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>What are we playing?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Object.entries(SPORTS).map(([key, sport]) => (
                    <button key={key}
                        onClick={() => { update('sport', key); update('format', ''); setErrors({}); setStep(1); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 16,
                            padding: '24px', borderRadius: 16,
                            background: game.sport === key ? `${sport.color}20` : 'var(--bg-card)',
                            border: `2px solid ${game.sport === key ? sport.color : 'var(--border-color)'}`,
                            cursor: 'pointer', transition: 'all 0.25s ease',
                        }}>
                        <span style={{ fontSize: '2.5rem' }}>{sport.emoji}</span>
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>{sport.name}</div>
                            <div className="text-muted text-xs">{FORMATS[key]?.join(' · ')}</div>
                        </div>
                        {game.sport === key && <span style={{ marginLeft: 'auto', color: sport.color, fontSize: '1.25rem' }}>✓</span>}
                    </button>
                ))}
            </div>
            {errors.sport && <div style={errorStyle}>{errors.sport}</div>}
        </div>,

        // 1: Format + Title
        <div key="format" className="animate-fade-in">
            <h2 style={{ marginBottom: 8 }}>Format & title</h2>
            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>
                {SPORTS[game.sport]?.emoji} {SPORTS[game.sport]?.name}
            </p>
            <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Game Format</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {(FORMATS[game.sport] || []).map(fmt => (
                        <button key={fmt} onClick={() => update('format', fmt)} className="chip"
                            style={{
                                background: game.format === fmt ? `${SPORTS[game.sport]?.color}25` : undefined,
                                borderColor: game.format === fmt ? SPORTS[game.sport]?.color : undefined,
                                color: game.format === fmt ? SPORTS[game.sport]?.color : undefined,
                            }}>
                            {fmt}
                        </button>
                    ))}
                </div>
                {errors.format && <div style={errorStyle}>{errors.format}</div>}
            </div>
            <div>
                <label style={labelStyle}>Game Title</label>
                <input type="text" placeholder="e.g. Friday Night Lights"
                    value={game.title} onChange={e => update('title', e.target.value)} style={inputStyle} />
                {errors.title && <div style={errorStyle}>{errors.title}</div>}
            </div>
        </div>,

        // 2: Location + DateTime
        <div key="details" className="animate-fade-in">
            <h2 style={{ marginBottom: 8 }}>When & where</h2>
            <p className="text-muted text-sm" style={{ marginBottom: 20 }}>Pin your venue and set the time</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                {/* Interactive Leaflet Map */}
                <div>
                    <label style={labelStyle}>📍 Drop a Pin</label>
                    <MapPicker
                        lat={game.lat} lng={game.lng}
                        onLocationChange={({ lat, lng, address, name }) => {
                            setGame(prev => ({
                                ...prev, lat, lng,
                                address: address || prev.address,
                                location: name || prev.location,
                            }));
                        }}
                    />
                </div>

                <div>
                    <label style={labelStyle}>Venue Name</label>
                    <input type="text" placeholder="e.g. AstroPark Bandra"
                        value={game.location} onChange={e => update('location', e.target.value)} style={inputStyle} />
                    {errors.location && <div style={errorStyle}>{errors.location}</div>}
                </div>

                <div>
                    <label style={labelStyle}>Full Address</label>
                    <input type="text" placeholder="Street, area, city"
                        value={game.address} onChange={e => update('address', e.target.value)} style={inputStyle} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <label style={labelStyle}>📅 Date</label>
                        <input type="date" value={game.date} onChange={e => update('date', e.target.value)} style={inputStyle} />
                        {errors.date && <div style={errorStyle}>{errors.date}</div>}
                    </div>
                    <div>
                        <label style={labelStyle}>🕐 Time</label>
                        <input type="time" value={game.time} onChange={e => update('time', e.target.value)} style={inputStyle} />
                        {errors.time && <div style={errorStyle}>{errors.time}</div>}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <label style={labelStyle}>Duration (mins)</label>
                        <input type="number" value={game.duration} min={30} step={15}
                            onChange={e => update('duration', +e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Max Players</label>
                        <input type="number" value={game.maxPlayers} min={2} max={100}
                            onChange={e => update('maxPlayers', +e.target.value)} style={inputStyle} />
                    </div>
                </div>

                <div>
                    <label style={labelStyle}>Skill Level</label>
                    <select value={game.skillLevel} onChange={e => update('skillLevel', e.target.value)} style={inputStyle}>
                        {SKILL_LEVELS.map(l => <option key={l}>{l}</option>)}
                    </select>
                </div>
            </div>
        </div>,

        // 3: Privacy
        <div key="privacy" className="animate-fade-in">
            <h2 style={{ marginBottom: 8 }}>Who can see this?</h2>
            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>Control who discovers your game</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {PRIVACY_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => update('visibility', opt.value)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 16,
                            padding: '20px 24px', borderRadius: 16, textAlign: 'left',
                            background: game.visibility === opt.value ? `${SPORTS[game.sport]?.color || '#6366f1'}18` : 'var(--bg-card)',
                            border: `2px solid ${game.visibility === opt.value ? (SPORTS[game.sport]?.color || '#6366f1') : 'var(--border-color)'}`,
                            cursor: 'pointer', transition: 'all 0.25s ease',
                        }}>
                        <span style={{ fontSize: '2rem' }}>{opt.emoji}</span>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{opt.label}</div>
                            <div className="text-muted text-xs">{opt.desc}</div>
                        </div>
                        {game.visibility === opt.value && (
                            <span style={{ marginLeft: 'auto', color: SPORTS[game.sport]?.color || '#6366f1', fontSize: '1.25rem' }}>✓</span>
                        )}
                    </button>
                ))}
            </div>
        </div>,

        // 4: Preview
        <div key="preview" className="animate-fade-in">
            <h2 style={{ marginBottom: 20 }}>Looks good? 🔥</h2>
            <div className="glass-card no-hover" style={{ overflow: 'hidden', padding: 0 }}>
                <div style={{ height: 4, background: SPORTS[game.sport]?.gradient }} />
                <div style={{ padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span className={`sport-badge ${game.sport}`}>{SPORTS[game.sport]?.emoji} {game.format}</span>
                        <span style={{
                            fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px',
                            borderRadius: 99, background: 'rgba(255,255,255,0.08)',
                            color: 'var(--text-secondary)',
                        }}>
                            {PRIVACY_OPTIONS.find(p => p.value === game.visibility)?.emoji}{' '}
                            {PRIVACY_OPTIONS.find(p => p.value === game.visibility)?.label}
                        </span>
                    </div>
                    <h3 style={{ marginBottom: 16, fontSize: '1.25rem' }}>{game.title || 'Untitled Game'}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div className="text-sm text-muted">📍 {game.location || 'No venue set'}</div>
                        <div className="text-sm text-muted">📅 {game.date || 'No date'} at {game.time || '--:--'}</div>
                        <div className="text-sm text-muted">⏱️ {game.duration} minutes · {game.maxPlayers} players</div>
                        <div className="text-sm text-muted">⭐ {game.skillLevel}</div>
                    </div>
                </div>
            </div>
        </div>,
    ];

    return (
        <div className="animate-fade-in">
            <div className="step-indicator" style={{ marginBottom: 24 }}>
                {steps.map((_, i) => (
                    <div key={i} className={`step-dot ${i < step ? 'completed' : i === step ? 'active' : ''}`}
                        onClick={() => i < step && setStep(i)} style={{ cursor: i < step ? 'pointer' : 'default' }} />
                ))}
            </div>

            {steps[step]}

            {step > 0 && (
                <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
                    <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setStep(s => s - 1)}>
                        ← Back
                    </button>
                    {step < steps.length - 1 ? (
                        <button className={`btn btn-${game.sport || 'primary'}`} style={{ flex: 1 }} onClick={handleNext}>
                            Continue →
                        </button>
                    ) : (
                        <button className={`btn btn-${game.sport || 'primary'}`} style={{ flex: 1 }} onClick={handleCreate}>
                            Create Game 🚀
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
