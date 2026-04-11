'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { SPORTS, getPlayer, getInitials, getTrustTier, formatDate } from '@/lib/mockData';

function GameRow({ g, onClick }) {
    const sport = SPORTS[g.sport];
    return (
        <div onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '12px 14px', borderLeft: `3px solid ${sport?.color || '#6366f1'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>{sport?.emoji} {g.title}</div>
                    <div className="text-xs text-muted">{g.game_date} · {g.game_time} · {g.location || g.address || 'Location TBD'}</div>
                </div>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'var(--bg-card)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {g.status === 'completed' ? 'completed' : 'saved'}
                </span>
            </div>
            {g.max_players && <div className="text-xs text-muted" style={{ marginTop: 4 }}>{g.format} · Up to {g.max_players} players · {g.skill_level}</div>}
        </div>
    );
}

export default function ProfilePage({ playerId, isOwn, onBack, onViewCV, onViewGame, onRateGame }) {
    const { state, dispatch } = useStore();
    const [activeSport, setActiveSport] = useState(null);
    const [thoughtText, setThoughtText] = useState('');
    const [gameHistory, setGameHistory] = useState([]);
    const [savedGames, setSavedGames] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [fetchedPlayer, setFetchedPlayer] = useState(null);
    const [isLoadingPlayer, setIsLoadingPlayer] = useState(false);
    const [friendLoading, setFriendLoading] = useState(false);
    const [toast, setToast] = useState('');

    const player = isOwn
        ? (state.currentUser || getPlayer('p1'))
        : (getPlayer(playerId) || (state.players || []).find(p => p && String(p.id) === String(playerId)) || fetchedPlayer);

    // Fetch DB player if not found in mock/store data — MUST be before any early return.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (isOwn) return;
        if (getPlayer(playerId) || (state.players || []).find(p => p && String(p.id) === String(playerId))) return;
        if (!playerId) return;
        setIsLoadingPlayer(true);
        fetch(`/api/users?id=${playerId}`)
            .then(r => r.json())
            .then(data => {
                if (data.user) {
                    const p = { ...data.user, gamesPlayed: data.user.gamesPlayed ?? 0, wins: data.user.wins ?? 0, losses: data.user.losses ?? 0 };
                    setFetchedPlayer(p);
                    // Put into global store so FriendsPage can find this player after an ADD_FRIEND
                    dispatch({ type: 'LOAD_STATE', payload: { players: [...(state.players || []).filter(x => x.id !== p.id), p] } });
                }
            })
            .catch(() => {})
            .finally(() => setIsLoadingPlayer(false));
    // Intentionally omit state.players — including it causes an infinite re-fetch loop.
    // playerId/isOwn are the only values that should trigger a re-fetch.
    }, [playerId, isOwn]); // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch game history from DB (own profile only) — MUST be before any early return
    useEffect(() => {
        if (!isOwn || !player?.dbId) return;
        setHistoryLoading(true);
        fetch(`/api/games/history?userId=${player.dbId}`)
            .then(r => r.json())
            .then(data => { setSavedGames(data.saved || []); setGameHistory(data.history || []); })
            .catch(() => { setSavedGames([]); setGameHistory([]); })
            .finally(() => setHistoryLoading(false));
    }, [isOwn, player?.dbId]);

    if (!player) {
        if (isLoadingPlayer) return <div className="glass-card no-hover text-center" style={{ padding: 48 }}><h3>Loading profile…</h3></div>;
        return (
            <div className="glass-card no-hover text-center" style={{ padding: 48 }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>👤</div>
                <h3>Player not found</h3>
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={onBack}>← Back</button>
            </div>
        );
    }

    const trust = getTrustTier(player.trustScore || 0);
    let sports = [];
    try { sports = Array.isArray(player.sports) ? player.sports : JSON.parse(player.sports || '[]'); } catch { sports = []; }
    if (!Array.isArray(sports)) sports = sports ? [sports] : [];
    const currentSport = activeSport || sports[0] || 'football';
    let rawRatings = {};
    try { rawRatings = typeof player.ratings === 'string' ? JSON.parse(player.ratings || '{}') : (player.ratings || {}); } catch { rawRatings = {}; }
    const rating = rawRatings[currentSport];
    let rawPositions = {};
    try { rawPositions = typeof player.positions === 'string' ? JSON.parse(player.positions || '{}') : (player.positions || {}); } catch { rawPositions = {}; }
    const playerPosition = rawPositions[currentSport] || 'Not set';
    const hasRating = rating && rating.count >= 10;
    const thoughts = Array.isArray(player.thoughts) ? player.thoughts : [];
    const playerGames = (state.games || []).filter(g => (g.rsvps || []).some(r => String(r.playerId) === String(player.id)));
    const pastGames = playerGames.filter(g => g.status === 'completed');
    const isFriend = !isOwn && (state.friends || []).some(fId => String(fId) === String(player.id));

    const handleToggleFriend = async () => {
        setFriendLoading(true);
        try {
            if (isFriend) {
                await fetch('/api/friends', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'remove', friendId: player.id }),
                });
                dispatch({ type: 'REMOVE_FRIEND', payload: player.id });
                setToast('Friend removed');
            } else {
                // Use direct 'add' (accepted status) so the friend appears immediately
                const res = await fetch('/api/friends', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'add', friendId: player.id }),
                });
                const data = await res.json();
                if (data.success || data.friendship) {
                    // Ensure the player object is in state.players so FriendsPage can render their card
                    dispatch({ type: 'LOAD_STATE', payload: {
                        friends: [...new Set([...(state.friends || []).map(String), String(player.id)])],
                        players: (state.players || []).some(p => String(p.id) === String(player.id))
                            ? state.players
                            : [...(state.players || []), player],
                    }});
                    setToast('Friend added!');
                } else {
                    setToast(data.error || 'Could not add friend');
                }
            }
        } catch (_) {
            setToast('Something went wrong');
        }
        setFriendLoading(false);
        setTimeout(() => setToast(''), 3000);
    };

    const handleAddThought = () => {
        if (!thoughtText.trim()) return;
        dispatch({ type: 'ADD_THOUGHT', payload: { playerId: player.id, thought: { from: state.currentUser?.id || 'current', text: thoughtText, date: new Date().toISOString().split('T')[0] } } });
        setThoughtText('');
    };

    return (
        <div className="animate-fade-in">
            {toast && (
                <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 99, padding: '10px 20px', fontWeight: 600, fontSize: '0.875rem', zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', whiteSpace: 'nowrap' }}>
                    {toast}
                </div>
            )}
            {!isOwn && <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 12, padding: '8px 0' }}>← Back</button>}

            <div className="glass-card no-hover" style={{ textAlign: 'center', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80, background: sports[0] ? SPORTS[sports[0]]?.gradient : 'linear-gradient(135deg, #6366f1, #8b5cf6)', opacity: 0.3 }} />
                <div style={{ position: 'relative', paddingTop: 24 }}>
                    <div className="avatar avatar-xl" style={{ margin: '0 auto 12px', borderColor: trust.color, background: player.photo ? `url(${player.photo}) center/cover` : `linear-gradient(135deg, ${trust.color}30, var(--bg-card))`, fontSize: player.photo ? '0' : '1.75rem' }}>
                        {player.photo ? '' : getInitials(player.name || 'U')}
                    </div>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: 2 }}>{player.name || 'Unknown'}</h2>
                    {(player.createdAt || player.joined) && <p className="text-sm text-muted">Member since {formatDate(player.createdAt || player.joined)}</p>}
                    <p className="text-sm text-muted" style={{ marginBottom: 8 }}>📍 {player.location || 'Unknown'}</p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                        <span className={`trust-badge ${trust.css}`}>🛡️ {trust.name}</span>
                        {sports.map(s => <span key={s} className={`sport-badge ${s}`}>{SPORTS[s]?.emoji}</span>)}
                    </div>
                    {!isOwn && state.isAuthenticated && (
                        <div style={{ marginBottom: 16 }}>
                            <button className={`btn btn-sm ${isFriend ? 'btn-outline' : 'btn-primary'}`} onClick={handleToggleFriend} disabled={friendLoading} style={{ minWidth: 120 }}>
                                {friendLoading ? '…' : isFriend ? '✓ Friends' : '+ Add Friend'}
                            </button>
                        </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                        <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: 12 }}><div style={{ fontWeight: 800, fontSize: '1.25rem' }}>{player.gamesPlayed ?? 0}</div><div className="text-xs text-muted">Games</div></div>
                        <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: 12 }}><div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--success)' }}>{player.wins ?? 0}</div><div className="text-xs text-muted">Wins</div></div>
                        <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: 12 }}><div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--danger)' }}>{player.losses ?? 0}</div><div className="text-xs text-muted">Losses</div></div>
                    </div>
                </div>
            </div>

            {sports.length > 0 && (
                <div className="tab-bar" style={{ marginBottom: 16 }}>
                    {sports.map(s => <button key={s} className={`tab-item ${currentSport === s ? 'active' : ''}`} onClick={() => setActiveSport(s)} style={currentSport === s ? { color: SPORTS[s]?.color } : {}}>{SPORTS[s]?.emoji} {SPORTS[s]?.name}</button>)}
                </div>
            )}

            <div className="glass-card no-hover" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ fontSize: '1rem' }}>{SPORTS[currentSport]?.emoji || '🏅'} {SPORTS[currentSport]?.name || currentSport} Rating</h3>
                    <span className="text-xs text-muted">Position: <span style={{ color: SPORTS[currentSport]?.color || 'var(--primary-color)', fontWeight: 600 }}>{playerPosition}</span></span>
                </div>
                {hasRating ? (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                            <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--warning)', lineHeight: 1 }}>{rating.overall}</span>
                            <div><div style={{ fontSize: '1.25rem', fontWeight: 700 }}>/ 10</div><div className="text-xs text-muted">{rating.count} ratings</div></div>
                        </div>
                        {rating.attrs && Object.keys(rating.attrs).length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {Object.entries(rating.attrs).map(([attr, val]) => (
                                    <div key={attr} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span className="text-xs" style={{ width: 100, color: 'var(--text-secondary)' }}>{attr}</span>
                                        <div style={{ flex: 1, height: 8, background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${(val / 10) * 100}%`, height: '100%', background: SPORTS[currentSport]?.gradient || 'var(--primary-color)', borderRadius: 4, transition: 'width 0.5s ease' }} /></div>
                                        <span className="text-xs font-semibold" style={{ width: 32, textAlign: 'right' }}>{!isNaN(Number(val)) && val !== null ? Number(val).toFixed(1) : 'N/A'}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: 24, background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🔒</div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Rating Pending</div>
                        <div className="text-xs text-muted">{rating?.count || 0}/10 ratings received. Need {10 - (rating?.count || 0)} more.</div>
                    </div>
                )}
            </div>

            <div className="glass-card no-hover" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>🛡️ Trust Score</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: `conic-gradient(${trust.color} ${player.trustScore || 0}%, var(--bg-input) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', color: trust.color }}>{player.trustScore || 0}</div>
                    </div>
                    <div><div style={{ fontWeight: 700, color: trust.color, marginBottom: 4 }}>{trust.name} Tier</div><div className="text-xs text-muted">Based on attendance, reliability, and community feedback</div></div>
                </div>
            </div>

            <div className="glass-card no-hover" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>💬 Written Thoughts</h3>
                {thoughts.length === 0 ? <p className="text-sm text-muted">No thoughts yet.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {thoughts.map((t, i) => {
                            const from = getPlayer(t.from) || state.currentUser;
                            return (
                                <div key={i} style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                                    <p className="text-sm" style={{ marginBottom: 8 }}>"{t.text}"</p>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>— {t.fromName || from?.name || 'Unknown'}</span>
                                        <span className="text-xs text-muted">{t.date}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {!isOwn && state.isAuthenticated && (
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                        <input type="text" placeholder="Leave a thought..." value={thoughtText} onChange={e => setThoughtText(e.target.value)} style={{ flex: 1, fontSize: '0.8125rem', padding: '10px 14px' }} />
                        <button className={`btn btn-sm btn-${currentSport}`} onClick={handleAddThought} disabled={!thoughtText.trim()}>Send</button>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => onViewCV(player.id)}>📄 Sports CV</button>
                {isOwn && pastGames.length > 0 && <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => onRateGame(pastGames[0]?.id)}>⭐ Rate Players</button>}
                {isOwn && <button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem('sportsvault_state'); dispatch({ type: 'LOGOUT' }); }}>🚪</button>}
            </div>

            {isOwn && (
                <>
                    <div className="glass-card no-hover" style={{ marginBottom: 16 }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>📌 Saved Games</h3>
                        {historyLoading ? <p className="text-sm text-muted">Loading…</p> : savedGames.length === 0 ? <p className="text-sm text-muted">No active saved games. Games you create appear here instantly.</p> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{savedGames.map((g, i) => <GameRow key={g.game_id || i} g={g} onClick={() => onViewGame?.(g.game_id)} />)}</div>
                        )}
                    </div>
                    <div className="glass-card no-hover" style={{ marginBottom: 16 }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>🕒 Game History</h3>
                        {historyLoading ? <p className="text-sm text-muted">Loading history…</p> : gameHistory.length === 0 ? <p className="text-sm text-muted">No past games yet. Games move here 24 hours after their scheduled time.</p> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{gameHistory.map((g, i) => <GameRow key={g.game_id || i} g={g} onClick={() => onViewGame?.(g.game_id)} />)}</div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
