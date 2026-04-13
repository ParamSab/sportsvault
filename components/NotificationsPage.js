'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { SPORTS, getPlayer, getInitials, formatDate } from '@/lib/mockData';

function notifIcon(notif) {
    const title = (notif.title || '').toLowerCase();
    const msg = (notif.message || notif.desc || '').toLowerCase();
    if (title.includes('friend request') || title.includes('new friend')) return '👋';
    if (title.includes('accepted') || title.includes('confirmed') || msg.includes("you're in")) return '✅';
    if (title.includes('join request') || title.includes('request')) return '🤝';
    if (title.includes('game') || msg.includes('game')) return '⚽';
    if (title.includes('reminder')) return '⏰';
    if (title.includes('rating') || title.includes('rated')) return '⭐';
    return '🔔';
}

export default function NotificationsPage({ onViewGame }) {
    const { state, dispatch } = useStore();
    const [activeTab, setActiveTab] = useState('alerts');
    const [actionLoading, setActionLoading] = useState(null);

    const notifications = state.notifications || [];
    const unread = notifications.filter(n => !n.read);
    const read = notifications.filter(n => n.read);
    const pendingFriends = (state.pendingFriends || []).filter(f => !f.isSender);

    const myUserId = state.currentUser?.dbId || state.currentUser?.id;
    const myGames = (state.games || []).filter(g => g.organizerId === myUserId);
    const pendingApprovals = myGames
        .flatMap(g => (g.rsvps || []).filter(r => r.status === 'pending').map(r => ({ ...r, game: g })))
        .sort((a, b) => new Date(b.game.date) - new Date(a.game.date));

    const totalAlertsCount = unread.length + pendingFriends.length;

    const handleClick = (notif) => {
        dispatch({ type: 'READ_NOTIFICATION', payload: notif.id });
        if (notif.gameId) { onViewGame(notif.gameId); return; }
        if (notif.action?.includes('game=')) { onViewGame(notif.action.split('game=')[1]); }
    };

    const handleHostAction = async (gameId, playerId, status) => {
        const key = `${gameId}-${playerId}-${status}`;
        setActionLoading(key);

        const game = state.games.find(g => String(g.id) === String(gameId));
        const existingRsvp = game?.rsvps?.find(r => r.playerId === playerId);
        const pos = existingRsvp?.position || '';
        const p = existingRsvp?.player || getPlayer(playerId) || (state.players || []).find(pl => pl.id === playerId);
        const actualPlayerId = p?.dbId || p?.id || playerId;

        dispatch({ type: 'RSVP', payload: { gameId, playerId: actualPlayerId, status, position: pos } });

        try {
            await fetch('/api/games/rsvp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameId, playerId: actualPlayerId, status, position: pos }),
            });
            if (status === 'yes') {
                fetch('/api/games/reminder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ gameId, playerId: actualPlayerId, type: 'approval' }),
                }).catch(() => {});
            }
        } catch (err) {
            console.error('Host action failed:', err);
        }

        try {
            const res = await fetch(`/api/games/${gameId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.game) dispatch({ type: 'MERGE_GAME', payload: data.game });
            }
        } catch (_) {}

        setActionLoading(null);
    };

    const handleFriendAction = async (friendId, action) => {
        setActionLoading(`friend-${friendId}-${action}`);
        try {
            await fetch('/api/friends/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ friendId, action }),
            });
            const fRes = await fetch('/api/friends');
            if (fRes.ok) {
                const fData = await fRes.json();
                const tiers = {};
                (fData.tiers || []).forEach(t => { if (!tiers[t.friendId]) tiers[t.friendId] = {}; tiers[t.friendId][t.sport] = t.tier; });
                dispatch({ type: 'LOAD_STATE', payload: {
                    friends: (fData.friends || []).map(f => f.id || f),
                    pendingFriends: fData.pendingRequests || [],
                    players: [...(fData.friends || []), ...(fData.pendingRequests || []), ...(state.players || [])].filter(
                        (p, i, arr) => p && arr.findIndex(x => x && String(x.id) === String(p.id)) === i
                    ),
                    friendTiers: tiers,
                }});
            }
        } catch (err) {
            console.error('Friend action failed:', err);
        }
        setActionLoading(null);
    };

    // Mark all unread as read when alerts tab is visible
    useEffect(() => {
        if (activeTab !== 'alerts' || unread.length === 0) return;
        const timer = setTimeout(async () => {
            try {
                await fetch('/api/notifications', { method: 'POST' });
                unread.forEach(n => dispatch({ type: 'READ_NOTIFICATION', payload: n.id }));
            } catch (_) {}
        }, 1500);
        return () => clearTimeout(timer);
    }, [activeTab, unread.length]); // eslint-disable-line react-hooks/exhaustive-deps

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

    const tabBtn = (id, label, count) => (
        <button
            onClick={() => setActiveTab(id)}
            style={{
                background: 'none', border: 'none', padding: '10px 4px', fontSize: '0.9375rem', cursor: 'pointer',
                fontWeight: activeTab === id ? 700 : 500,
                color: activeTab === id ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === id ? '2px solid var(--primary-color)' : '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: 6,
            }}
        >
            {label}
            {count > 0 && (
                <span style={{
                    background: id === 'approvals' ? 'var(--warning)' : 'var(--primary-color)',
                    color: id === 'approvals' ? '#000' : '#fff',
                    fontSize: '0.65rem', padding: '1px 6px', borderRadius: 99, fontWeight: 700,
                }}>{count}</span>
            )}
        </button>
    );

    return (
        <div className="animate-fade-in">
            <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', marginBottom: 4 }}>Notifications</h1>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, borderBottom: '1px solid var(--border-color)' }}>
                {tabBtn('alerts', 'Alerts', totalAlertsCount)}
                {tabBtn('approvals', 'Approvals', pendingApprovals.length)}
            </div>

            {/* ─── ALERTS TAB ─── */}
            {activeTab === 'alerts' && (
                <>
                    {notifications.length === 0 && pendingFriends.length === 0 && (
                        <div className="glass-card no-hover text-center" style={{ padding: 48 }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔔</div>
                            <h3 style={{ marginBottom: 8 }}>All caught up!</h3>
                            <p className="text-muted text-sm">No notifications right now.</p>
                        </div>
                    )}

                    {/* Friend Requests */}
                    {pendingFriends.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                            <div className="text-xs font-semibold" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--primary-color)' }}>
                                Friend Requests · {pendingFriends.length}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {pendingFriends.map(player => {
                                    const isLoading = actionLoading?.startsWith(`friend-${player.id}`);
                                    return (
                                        <div key={player.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
                                            <div
                                                className="avatar"
                                                style={{ flexShrink: 0, background: player.photo ? `url(${player.photo}) center/cover` : undefined, fontSize: player.photo ? '0' : undefined }}
                                            >
                                                {player.photo ? '' : getInitials(player.name || 'Unknown')}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name || 'Unknown'}</div>
                                                <div className="text-xs text-muted">Sent you a friend request</div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                                <button
                                                    className="btn btn-sm btn-ghost"
                                                    style={{ padding: '5px 10px', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
                                                    disabled={!!isLoading}
                                                    onClick={() => handleFriendAction(player.id, 'reject')}
                                                >Ignore</button>
                                                <button
                                                    className="btn btn-sm btn-primary"
                                                    style={{ padding: '5px 14px' }}
                                                    disabled={!!isLoading}
                                                    onClick={() => handleFriendAction(player.id, 'accept')}
                                                >{isLoading ? '…' : 'Accept'}</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Unread notifications */}
                    {unread.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                            <div className="text-xs font-semibold text-muted" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>New</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {unread.map(notif => (
                                    <button
                                        key={notif.id}
                                        className="notif-card unread"
                                        onClick={() => handleClick(notif)}
                                        style={{ cursor: 'pointer', textAlign: 'left', width: '100%' }}
                                    >
                                        <div className="notif-icon" style={{ background: 'rgba(99,102,241,0.15)', fontSize: '1.25rem' }}>
                                            {notifIcon(notif)}
                                        </div>
                                        <div className="notif-content">
                                            <div className="notif-title">{notif.title}</div>
                                            <div className="notif-desc">{notif.message || notif.desc}</div>
                                            <div className="notif-time">{formatTime(notif.createdAt || notif.time)}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Read notifications */}
                    {read.length > 0 && (
                        <div>
                            <div className="text-xs font-semibold text-muted" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Earlier</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {read.map(notif => (
                                    <button
                                        key={notif.id}
                                        className="notif-card"
                                        onClick={() => handleClick(notif)}
                                        style={{ cursor: 'pointer', textAlign: 'left', width: '100%', opacity: 0.6 }}
                                    >
                                        <div className="notif-icon" style={{ background: 'var(--bg-input)', fontSize: '1.25rem' }}>
                                            {notifIcon(notif)}
                                        </div>
                                        <div className="notif-content">
                                            <div className="notif-title">{notif.title}</div>
                                            <div className="notif-desc">{notif.message || notif.desc}</div>
                                            <div className="notif-time">{formatTime(notif.createdAt || notif.time)}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ─── APPROVALS TAB ─── */}
            {activeTab === 'approvals' && (
                <>
                    {pendingApprovals.length === 0 && (
                        <div className="glass-card no-hover text-center" style={{ padding: 48 }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🙌</div>
                            <h3 style={{ marginBottom: 8 }}>No pending requests</h3>
                            <p className="text-muted text-sm">Join requests for your games will appear here.</p>
                        </div>
                    )}

                    {pendingApprovals.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {pendingApprovals.map(r => {
                                const p = r.player || getPlayer(r.playerId) || (state.players || []).find(pl => String(pl.id) === String(r.playerId));
                                const displayName = p?.name || r.playerName || 'Unknown Player';
                                const sport = r.game?.sport;
                                const sportObj = SPORTS[sport];
                                const actionKey = `${r.game.id}-${r.playerId}`;
                                const isLoading = actionLoading?.startsWith(actionKey);
                                return (
                                    <div key={actionKey} className="glass-card no-hover" style={{ padding: 16 }}>
                                        <div
                                            className="text-xs text-muted"
                                            style={{ marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                                            onClick={() => onViewGame(r.game.id)}
                                        >
                                            <span>{sportObj?.emoji || '🏅'}</span>
                                            <span style={{ textDecoration: 'underline', textUnderlineOffset: 2 }}>
                                                {r.game.title}
                                            </span>
                                            <span>·</span>
                                            <span>{formatDate(r.game.date)}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div
                                                className="avatar"
                                                style={{
                                                    width: 44, height: 44, flexShrink: 0,
                                                    background: p?.photo ? `url(${p.photo}) center/cover` : (sportObj ? `${sportObj.color}20` : 'var(--bg-input)'),
                                                    border: `2px solid ${sportObj?.color || 'var(--border-color)'}`,
                                                }}
                                            >
                                                {p?.photo ? '' : getInitials(displayName)}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                                                <div className="text-xs text-muted">
                                                    {r.position && <span>{r.position} · </span>}
                                                    Wants to join
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                                <button
                                                    className="btn btn-sm btn-ghost"
                                                    style={{ color: 'var(--danger)', border: '1px solid var(--border-color)', padding: '6px 12px' }}
                                                    disabled={!!isLoading}
                                                    onClick={() => handleHostAction(r.game.id, r.playerId, 'no')}
                                                >Deny</button>
                                                <button
                                                    className="btn btn-sm btn-primary"
                                                    style={{ padding: '6px 16px' }}
                                                    disabled={!!isLoading}
                                                    onClick={() => handleHostAction(r.game.id, r.playerId, 'yes')}
                                                >{isLoading ? '…' : 'Accept'}</button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
