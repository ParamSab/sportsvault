'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { SPORTS, RATING_ATTRIBUTES, getPlayer, getInitials } from '@/lib/mockData';

const GAME_FEEDBACK_TAGS = [
    { label: '🎉 Great atmosphere', value: 'great_atmosphere' },
    { label: '📋 Well organised', value: 'well_organised' },
    { label: '🤝 Friendly players', value: 'friendly_players' },
    { label: '⚽ Good skill level', value: 'good_skill' },
    { label: '🔁 Would return', value: 'would_return' },
    { label: '⏰ On time', value: 'on_time' },
    { label: '🏟️ Great venue', value: 'great_venue' },
    { label: '🎽 Kit provided', value: 'kit_provided' },
];

const ISSUE_OPTIONS = [
    { label: '❌ Game cancelled late', value: 'late_cancel' },
    { label: '😤 Poor organiser', value: 'poor_organiser' },
    { label: '🔢 Wrong number of players', value: 'wrong_numbers' },
    { label: '📍 Wrong venue listed', value: 'wrong_venue' },
];

export default function RatePage({ gameId, onBack }) {
    const { state, dispatch } = useStore();
    const [currentIdx, setCurrentIdx] = useState(0);
    const [ratings, setRatings] = useState({});
    const [thought, setThought] = useState('');
    const [submitted, setSubmitted] = useState([]);

    // Game-level feedback (done once, at the end)
    const [gameFeedbackTags, setGameFeedbackTags] = useState([]);
    const [issueTag, setIssueTag] = useState('');
    const [feedbackComment, setFeedbackComment] = useState('');
    const [showGameFeedback, setShowGameFeedback] = useState(false);
    const [gameFeedbackSubmitted, setGameFeedbackSubmitted] = useState(false);

    const game = state.games.find(g => g.id === gameId);
    if (!game) return <div className="glass-card no-hover text-center" style={{ padding: 48 }}><h3>Game not found</h3><button className="btn btn-outline mt-md" onClick={onBack}>← Back</button></div>;

    const currentUserId = state.currentUser?.id || 'current';
    const playersToRate = game.rsvps
        .filter(r => r.status === 'yes' && r.playerId !== currentUserId)
        .map(r => ({ ...getPlayer(r.playerId), rsvpPosition: r.position }))
        .filter(Boolean);

    const sport = game.sport;
    const attrs = RATING_ATTRIBUTES[sport] || [];
    const player = playersToRate[currentIdx];
    const sportColor = SPORTS[sport]?.color || '#6366f1';

    // Game feedback screen
    if (showGameFeedback) {
        return (
            <div className="animate-fade-in">
                <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 12, padding: '8px 0' }}>← Back</button>
                <h2 style={{ marginBottom: 4 }}>Rate the Game</h2>
                <p className="text-muted text-sm" style={{ marginBottom: 24 }}>How was the overall experience?</p>

                {!gameFeedbackSubmitted ? (
                    <>
                        {/* Quick tags */}
                        <div className="glass-card no-hover" style={{ marginBottom: 16 }}>
                            <h3 style={{ fontSize: '0.9375rem', marginBottom: 12 }}>What went well?</h3>
                            <div className="feedback-tags">
                                {GAME_FEEDBACK_TAGS.map(tag => (
                                    <button
                                        key={tag.value}
                                        className={`feedback-tag ${gameFeedbackTags.includes(tag.value) ? 'selected' : ''}`}
                                        onClick={() => setGameFeedbackTags(prev =>
                                            prev.includes(tag.value) ? prev.filter(t => t !== tag.value) : [...prev, tag.value]
                                        )}
                                    >
                                        {tag.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Issue report */}
                        <div className="glass-card no-hover" style={{ marginBottom: 16 }}>
                            <h3 style={{ fontSize: '0.9375rem', marginBottom: 12 }}>Any issues? <span className="text-xs text-muted">(optional)</span></h3>
                            <div className="feedback-tags">
                                {ISSUE_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        className={`feedback-tag ${issueTag === opt.value ? 'selected' : ''}`}
                                        style={{ ...(issueTag === opt.value ? { borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239,68,68,0.1)' } : {}) }}
                                        onClick={() => setIssueTag(prev => prev === opt.value ? '' : opt.value)}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Comment */}
                        <div className="glass-card no-hover" style={{ marginBottom: 16 }}>
                            <h3 style={{ fontSize: '0.9375rem', marginBottom: 8 }}>💬 Add a comment <span className="text-xs text-muted">(optional)</span></h3>
                            <textarea
                                value={feedbackComment}
                                onChange={e => setFeedbackComment(e.target.value)}
                                placeholder="Anything else to share about this game?"
                                rows={3}
                                style={{ resize: 'vertical', fontSize: '0.875rem' }}
                            />
                        </div>

                        <button
                            className="btn btn-primary btn-block btn-lg"
                            onClick={() => setGameFeedbackSubmitted(true)}
                        >
                            Submit Game Feedback ✓
                        </button>
                        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={onBack}>Skip</button>
                    </>
                ) : (
                    <div className="animate-fade-in text-center" style={{ padding: '48px 0' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
                        <h2 style={{ marginBottom: 8 }}>Thanks for the feedback!</h2>
                        <p className="text-muted text-sm" style={{ marginBottom: 24 }}>Your input helps keep SportsVault games top quality.</p>
                        <button className="btn btn-primary" onClick={onBack}>← Back to Profile</button>
                    </div>
                )}
            </div>
        );
    }

    if (!player || currentIdx >= playersToRate.length) {
        return (
            <div className="animate-fade-in text-center" style={{ padding: '48px 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
                <h2 style={{ marginBottom: 8 }}>Players Rated!</h2>
                <p className="text-muted text-sm" style={{ marginBottom: 24 }}>
                    You rated {submitted.length} player{submitted.length !== 1 ? 's' : ''}. Your ratings are anonymous.
                </p>
                <button className="btn btn-primary btn-block btn-lg" style={{ marginBottom: 12 }} onClick={() => setShowGameFeedback(true)}>
                    Rate the Game Experience 🏟️
                </button>
                <button className="btn btn-ghost btn-block" onClick={onBack}>Skip → Back to Profile</button>
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

        try {
            await fetch('/api/users/rate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId: player.id,
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
            <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 12, padding: '8px 0' }}>← Back</button>

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
                <div className="avatar avatar-lg" style={{ margin: '0 auto 12px', borderColor: sportColor }}>
                    {getInitials(player.name)}
                </div>
                <h3>{player.name}</h3>
                <div className="text-sm text-muted">{player.rsvpPosition} · {SPORTS[sport]?.emoji} {SPORTS[sport]?.name}</div>
            </div>

            {/* Attribute Ratings */}
            <div className="glass-card no-hover" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '1.125rem', marginBottom: 20, textAlign: 'center' }}>
                    {SPORTS[sport]?.emoji} Performance <span className="text-xs text-muted" style={{ display: 'block', marginTop: 4 }}>(out of 10, anonymous)</span>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {attrs.map(attr => (
                        <div key={attr}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                                <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{attr}</span>
                                <span style={{
                                    fontSize: '1.125rem', fontWeight: 800,
                                    color: currentRatings[attr] >= 8 ? 'var(--success)' : (currentRatings[attr] >= 5 ? 'var(--warning)' : 'var(--danger)'),
                                    background: 'var(--bg-input)', padding: '2px 10px', borderRadius: 8
                                }}>
                                    {currentRatings[attr] ? `${currentRatings[attr]}/10` : '-/10'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => {
                                    const isFilled = val <= (currentRatings[attr] || 0);
                                    let color = '#3b82f6';
                                    if (currentRatings[attr] >= 8) color = '#22c55e';
                                    else if (currentRatings[attr] >= 5) color = '#eab308';
                                    else if (currentRatings[attr] > 0) color = '#ef4444';
                                    return (
                                        <button
                                            key={val}
                                            onClick={() => setAttrRating(attr, val)}
                                            style={{
                                                flex: 1, height: 36,
                                                background: isFilled ? color : 'var(--bg-input)',
                                                border: `1px solid ${isFilled ? color : 'var(--border-color)'}`,
                                                borderRadius: 6, cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                transform: isFilled && val === currentRatings[attr] ? 'scale(1.05)' : 'scale(1)',
                                            }}
                                        />
                                    );
                                })}
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
