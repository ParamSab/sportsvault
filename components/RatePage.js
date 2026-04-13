'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { SPORTS, RATING_ATTRIBUTES, getPlayer, getInitials } from '@/lib/mockData';

export default function RatePage({ gameId, onBack }) {
    const { state, dispatch } = useStore();
    const [currentIdx, setCurrentIdx] = useState(0);
    const [ratings, setRatings] = useState({});
    const [thought, setThought] = useState('');
    const [submitted, setSubmitted] = useState([]);

    const game = state.games.find(g => String(g.id) === String(gameId));
    if (!game) return <div className="glass-card no-hover text-center" style={{ padding: 48 }}><h3>Game not found</h3><button className="btn btn-outline mt-md" onClick={onBack}>← Back</button></div>;

    const currentUserId = state.currentUser?.dbId || state.currentUser?.id || 'current';
    const playersToRate = (game.rsvps || [])
        .filter(r => r.status === 'yes' && String(r.playerId) !== String(currentUserId))
        .map(r => {
            const p = r.player || getPlayer(r.playerId) || (state.players || []).find(pl => String(pl.id) === String(r.playerId) || String(pl.dbId) === String(r.playerId));
            return p ? { ...p, rsvpPosition: r.position } : null;
        })
        .filter(Boolean);

    const sport = game.sport;
    const attrs = RATING_ATTRIBUTES[sport] || [];
    const player = playersToRate[currentIdx];

    if (!player || currentIdx >= playersToRate.length) {
        return (
            <div className="animate-fade-in text-center" style={{ padding: '48px 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
                <h2 style={{ marginBottom: 8 }}>All Done!</h2>
                <p className="text-muted text-sm" style={{ marginBottom: 24 }}>
                    Thanks for rating {submitted.length} player{submitted.length !== 1 ? 's' : ''}.
                    Your ratings are anonymous.
                </p>
                <button className="btn btn-primary" onClick={onBack}>← Back to Profile</button>
            </div>
        );
    }

    const currentRatings = ratings[player.id] || {};

    const setAttrRating = (attr, value) => {
        setRatings(prev => ({
            ...prev,
            [player.id]: { ...prev[player.id], [attr]: value },
        }));
    };

    const handleSubmit = async () => {
        const attrValues = Object.values(currentRatings);
        if (attrValues.length === 0) return;
        const avg = attrValues.reduce((s, v) => s + v, 0) / attrValues.length;

        dispatch({ type: 'SUBMIT_RATING', payload: { playerId: player.id, sport, rating: avg } });

        // Save to DB
        try {
            await fetch('/api/users/rate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId: player.dbId || player.id,
                    sport,
                    rating: avg,
                    thought: thought.trim(),
                    fromId: state.currentUser?.dbId || state.currentUser?.id
                })
            });
        } catch (err) { console.error('Rating sync error:', err); }

        if (thought.trim()) {
            dispatch({
                type: 'ADD_THOUGHT',
                payload: {
                    playerId: player.id,
                    thought: {
                        from: currentUserId,
                        text: thought,
                        date: new Date().toISOString().split('T')[0],
                    },
                },
            });
        }

        setSubmitted(prev => [...prev, player.id]);
        setThought('');
        setCurrentIdx(prev => prev + 1);
    };

    return (
        <div className="animate-fade-in">
            <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 12, padding: '8px 0' }}>
                ← Back
            </button>

            {/* Progress */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: '1.25rem' }}>Rate Players</h2>
                <span className="text-sm text-muted">{currentIdx + 1} of {playersToRate.length}</span>
            </div>
            <div className="step-indicator" style={{ marginBottom: 24 }}>
                {playersToRate.map((_, i) => (
                    <div key={i} className={`step-dot ${i < currentIdx ? 'completed' : i === currentIdx ? 'active' : ''}`} />
                ))}
            </div>

            {/* Player being rated */}
            <div className="glass-card no-hover" style={{ textAlign: 'center', marginBottom: 16 }}>
                <div className="avatar avatar-lg" style={{ margin: '0 auto 12px', borderColor: SPORTS[sport]?.color }}>
                    {getInitials(player.name)}
                </div>
                <h3>{player.name}</h3>
                <div className="text-sm text-muted">{player.rsvpPosition} · {SPORTS[sport]?.emoji} {SPORTS[sport]?.name}</div>
            </div>

            {/* Attribute Ratings */}
            <div className="glass-card no-hover" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '0.9375rem', marginBottom: 16 }}>
                    {SPORTS[sport]?.emoji} Skill Ratings <span className="text-xs text-muted">(anonymous)</span>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {attrs.map(attr => (
                        <div key={attr}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span className="text-sm">{attr}</span>
                                <span className="text-sm font-semibold" style={{ color: 'var(--warning)' }}>
                                    {currentRatings[attr] || 0}/5
                                </span>
                            </div>
                            <div className="stars" style={{ fontSize: '1.5rem' }}>
                                {[1, 2, 3, 4, 5].map(star => (
                                    <span
                                        key={star}
                                        className={`star ${star <= (currentRatings[attr] || 0) ? 'filled' : ''}`}
                                        onClick={() => setAttrRating(attr, star)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        ★
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Written Thought */}
            <div className="glass-card no-hover" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '0.9375rem', marginBottom: 8 }}>
                    💬 Leave a Thought <span className="text-xs text-muted">(shows your name)</span>
                </h3>
                <textarea
                    value={thought}
                    onChange={e => setThought(e.target.value)}
                    placeholder={`What did you think of ${player.name.split(' ')[0]}'s game?`}
                    rows={3}
                    style={{ resize: 'vertical', fontSize: '0.875rem' }}
                />
            </div>

            {/* Submit */}
            <button
                className={`btn btn-${sport} btn-block btn-lg`}
                onClick={handleSubmit}
                disabled={Object.keys(currentRatings).length === 0}
                style={{ opacity: Object.keys(currentRatings).length === 0 ? 0.5 : 1 }}
            >
                Submit & {currentIdx < playersToRate.length - 1 ? 'Next →' : 'Finish ✓'}
            </button>
        </div>
    );
}
