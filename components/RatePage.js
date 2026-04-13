'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { SPORTS, RATING_ATTRIBUTES, getPlayer, getInitials } from '@/lib/mockData';

export default function RatePage({ gameId, onBack }) {
    const { state, dispatch } = useStore();
    const [currentIdx, setCurrentIdx] = useState(0);
    const [ratings, setRatings] = useState({});
    const [thought, setThought] = useState('');
    const [submitted, setSubmitted] = useState([]);
    const [skipped, setSkipped] = useState(new Set()); // already-rated players
    const [submitting, setSubmitting] = useState(false);

    // Try fresh fetch if game not in state (e.g. navigated directly)
    const [freshGame, setFreshGame] = useState(null);
    useEffect(() => {
        if (!state.games.find(g => String(g.id) === String(gameId))) {
            fetch(`/api/games/${gameId}`)
                .then(r => r.json())
                .then(d => { if (d.game) setFreshGame(d.game); })
                .catch(() => {});
        }
    }, [gameId]);

    const game = freshGame || state.games.find(g => String(g.id) === String(gameId));
    if (!game) return (
        <div className="glass-card no-hover text-center" style={{ padding: 48 }}>
            <h3>Game not found</h3>
            <button className="btn btn-outline mt-md" onClick={onBack}>← Back</button>
        </div>
    );

    const currentUserId = state.currentUser?.dbId || state.currentUser?.id || 'current';
    const sport = game.sport;
    const attrs = RATING_ATTRIBUTES[sport] || [];

    const playersToRate = (game.rsvps || [])
        .filter(r => (r.status === 'yes' || r.status === 'checked_in') && String(r.playerId) !== String(currentUserId))
        .map(r => {
            const p = r.player
                || getPlayer(r.playerId)
                || (state.players || []).find(pl =>
                    String(pl.id) === String(r.playerId) || String(pl.dbId) === String(r.playerId)
                );
            return p ? { ...p, rsvpPosition: r.position } : null;
        })
        .filter(Boolean);

    // Advance past already-skipped players
    const effectiveIdx = (() => {
        let idx = currentIdx;
        while (idx < playersToRate.length && skipped.has(playersToRate[idx]?.id)) idx++;
        return idx;
    })();

    const player = playersToRate[effectiveIdx];
    const remaining = playersToRate.filter(p => !skipped.has(p.id) && !submitted.includes(p.id));

    if (!player || effectiveIdx >= playersToRate.length) {
        return (
            <div className="animate-fade-in text-center" style={{ padding: '48px 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
                <h2 style={{ marginBottom: 8 }}>All Done!</h2>
                <p className="text-muted text-sm" style={{ marginBottom: 8 }}>
                    You rated {submitted.length} player{submitted.length !== 1 ? 's' : ''}.
                </p>
                {skipped.size > 0 && (
                    <p className="text-muted text-sm" style={{ marginBottom: 24 }}>
                        {skipped.size} already rated from this game.
                    </p>
                )}
                <p className="text-muted text-sm" style={{ marginBottom: 24 }}>
                    All skill ratings are anonymous.
                </p>
                <button className="btn btn-primary" onClick={onBack}>← Back</button>
            </div>
        );
    }

    const currentRatings = ratings[player.id] || {};
    const allAttrsRated = attrs.length > 0 && attrs.every(a => currentRatings[a]);

    const setAttrRating = (attr, value) => {
        setRatings(prev => ({
            ...prev,
            [player.id]: { ...(prev[player.id] || {}), [attr]: value },
        }));
    };

    const handleSubmit = async () => {
        if (!allAttrsRated || submitting) return;
        setSubmitting(true);

        const attrValues = Object.values(currentRatings);
        const avg = attrValues.reduce((s, v) => s + v, 0) / attrValues.length;

        dispatch({ type: 'SUBMIT_RATING', payload: { playerId: player.id, sport, rating: avg } });

        try {
            const res = await fetch('/api/users/rate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId: player.dbId || player.id,
                    sport,
                    rating: avg,
                    attrs: currentRatings,
                    gameId,
                    thought: thought.trim() || undefined,
                    fromId: state.currentUser?.dbId || state.currentUser?.id,
                }),
            });
            const data = await res.json();
            if (data.alreadyRated) {
                setSkipped(prev => new Set([...prev, player.id]));
                setSubmitting(false);
                setCurrentIdx(effectiveIdx + 1);
                return;
            }
        } catch (err) {
            console.error('Rating sync error:', err);
        }

        if (thought.trim()) {
            dispatch({
                type: 'ADD_THOUGHT',
                payload: {
                    playerId: player.id,
                    thought: { from: currentUserId, text: thought, date: new Date().toISOString().split('T')[0] },
                },
            });
        }

        setSubmitted(prev => [...prev, player.id]);
        setThought('');
        setSubmitting(false);
        setCurrentIdx(effectiveIdx + 1);
    };

    const handleSkipPlayer = () => {
        setCurrentIdx(effectiveIdx + 1);
    };

    const sportColor = SPORTS[sport]?.color || '#6366f1';
    const rated = playersToRate.length - remaining.length;

    return (
        <div className="animate-fade-in">
            <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 12, padding: '8px 0' }}>
                ← Back
            </button>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Rate Players</h2>
                    <div className="text-xs text-muted" style={{ marginTop: 2 }}>{game.title}</div>
                </div>
                <span className="text-sm text-muted">{rated + 1} of {playersToRate.length}</span>
            </div>

            {/* Progress dots */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
                {playersToRate.map((p, i) => {
                    const isDone = submitted.includes(p.id) || skipped.has(p.id);
                    const isCurrent = p.id === player.id;
                    return (
                        <div key={i} style={{
                            flex: 1, height: 4, borderRadius: 2,
                            background: isDone ? sportColor : isCurrent ? `${sportColor}60` : 'var(--border-color)',
                            transition: 'background 0.3s',
                        }} />
                    );
                })}
            </div>

            {/* Player card */}
            <div className="glass-card no-hover" style={{ textAlign: 'center', marginBottom: 16, padding: '20px 16px' }}>
                <div className="avatar avatar-lg" style={{
                    margin: '0 auto 12px',
                    borderColor: sportColor,
                    background: player.photo ? `url(${player.photo}) center/cover` : undefined,
                    fontSize: player.photo ? '0' : undefined,
                }}>
                    {player.photo ? '' : getInitials(player.name)}
                </div>
                <h3 style={{ margin: '0 0 4px' }}>{player.name}</h3>
                <div className="text-sm text-muted">
                    {player.rsvpPosition && <span>{player.rsvpPosition} · </span>}
                    {SPORTS[sport]?.emoji} {SPORTS[sport]?.name}
                </div>
            </div>

            {/* Attribute star ratings */}
            <div className="glass-card no-hover" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontSize: '0.9375rem', margin: 0 }}>
                        {SPORTS[sport]?.emoji} Skill Ratings
                    </h3>
                    <span className="text-xs text-muted">anonymous</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {attrs.map(attr => (
                        <div key={attr}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span className="text-sm" style={{ fontWeight: 500 }}>{attr}</span>
                                <span className="text-sm" style={{ fontWeight: 700, color: currentRatings[attr] ? 'var(--warning)' : 'var(--text-secondary)' }}>
                                    {currentRatings[attr] ? `${currentRatings[attr]} / 5` : '—'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {[1, 2, 3, 4, 5].map(star => {
                                    const filled = star <= (currentRatings[attr] || 0);
                                    return (
                                        <button
                                            key={star}
                                            onClick={() => setAttrRating(attr, star)}
                                            style={{
                                                flex: 1, padding: '10px 0',
                                                borderRadius: 8,
                                                border: `1.5px solid ${filled ? sportColor : 'var(--border-color)'}`,
                                                background: filled ? `${sportColor}20` : 'var(--bg-input)',
                                                color: filled ? sportColor : 'var(--text-secondary)',
                                                cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem',
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            {star}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Written thought */}
            <div className="glass-card no-hover" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '0.9375rem', marginBottom: 8 }}>
                    💬 Leave a Thought <span className="text-xs text-muted">(shows your name)</span>
                </h3>
                <textarea
                    value={thought}
                    onChange={e => setThought(e.target.value)}
                    placeholder={`What did you think of ${player.name.split(' ')[0]}'s game?`}
                    rows={3}
                    style={{ resize: 'vertical', fontSize: '0.875rem', width: '100%' }}
                />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
                <button
                    className="btn btn-outline btn-sm"
                    style={{ flex: '0 0 auto' }}
                    onClick={handleSkipPlayer}
                >
                    Skip
                </button>
                <button
                    className="btn btn-primary btn-block"
                    onClick={handleSubmit}
                    disabled={!allAttrsRated || submitting}
                    style={{ opacity: (!allAttrsRated || submitting) ? 0.5 : 1, flex: 1 }}
                >
                    {submitting ? 'Saving…' : effectiveIdx < playersToRate.filter(p => !skipped.has(p.id)).length - 1 ? 'Submit & Next →' : 'Submit & Finish ✓'}
                </button>
            </div>
        </div>
    );
}
