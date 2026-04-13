'use client';
import { useState, useCallback } from 'react';
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

function relativeTime(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
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
        const existingRsvp = game?.rsvps?.find(r => String(r.playerId) === String(playerId));
        const pos = existingRsvp?.position || '';
        const p = existingRsvp?.player || getPlayer(playerId) || (state.players || []).find(pl => String(pl.id) === String(playerId));
        const actualPlayerId = p?.dbId || p?.id || playerId;

        dispatch({ type: 'RSVP', payload: { gameId, playerId: actualPlayerId, status, position: pos } });

        try {
            await fetch('/api/games/rsvp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameId, playerId: actualPlayerId, status, position: pos }),
            });
            // Only send approval SMS if not already approved (prevents duplicate texts)
            if (status === 'yes' && existingRsvp?.status !== 'yes') {
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

    const markAllRead = async () => {
        try {
            await fetch('/api/notifications', { method: 'POST' });
            notifications.forEach(n => {
                if (!n.read) dispatch({ type: 'READ_NOTIFICATION', payload: n.id });
            });
        } catch (_) {}
    };

    const tabStyle = (tab) => ({
        flex: 1, padding: '10px 0', border: 'none', borderRadius: 10,
        background: activeTab === tab ? 'var(--bg-card)' : 'transparent',
        color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
        fontWeight: activeTab === tab ? 700 : 500,
        fontSize: '0.875rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
        position: 'relative',
    });

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                    <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', marginBottom: 2 }}>Notifications</h1>
                    <p className="text-muted text-sm">{totalAlertsCount > 0 ? `${totalAlertsCount} need attention` : 'All caught up!'}</p>
                </div>
                {unread.length > 0 && (
                    <button className="btn btn-ghost text-sm" onClick={markAllRead} style={{ padding: '6px 12px' }}>
                        Mark all read
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-input)', borderRadius: 12, padding: 4, marginBottom: 20 }}>
                <button style={tabStyle('alerts')} onClick={() => setActiveTab('alerts')}>
                    Alerts {totalAlertsCount > 0 && <span style={{ marginLeft: 6, background: 'var(--danger)', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: '0.7rem' }}>{totalAlertsCount}</span>}
                </button>
                <button style={tabStyle('approvals')} onClick={() => setActiveTab('approvals')}>
                    Approvals {pendingApprovals.length > 0 && <span style={{ marginLeft: 6, background: 'var(--warning)', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: '0.7rem' }}>{pendingApprovals.length}</span>}
                </button>
            </div>

            {activeTab === 'alerts' && (
                <div>
                    {/* Pending friend requests */}
                    {pendingFriends.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                            <div className="text-xs font-semibold text-muted" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                                Friend Requests
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {pendingFriends.map(friend => (
                                    <div key={friend.id} className="glass-card no-hover" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div className="avatar" style={{ flexShrink: 0 }}>{getInitials(friend.name || '?')}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{friend.name || 'Unknown'}</div>
                                            <div className="text-xs text-muted">wants to connect</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                className="btn btn-primary"
                                                style={{ padding: '6px 14px', fontSize: '0.8125rem' }}
                                                disabled={!!actionLoading}
                                                onClick={() => handleFriendAction(friend.id, 'accept')}
                                            >
                                                {actionLoading === `friend-${friend.id}-accept` ? '...' : 'Accept'}
                                            </button>
                                            <button
                                                className="btn btn-ghost"
                                                style={{ padding: '6px 14px', fontSize: '0.8125rem' }}
                                                disabled={!!actionLoading}
                                                onClick={() => handleFriendAction(friend.id, 'reject')}
                                            >
                                                Ignore
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Notification alerts */}
                    {notifications.length === 0 && pendingFriends.length === 0 ? (
                        <div className="glass-card no-hover text-center" style={{ padding: 48 }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔔</div>
                            <h3 style={{ marginBottom: 8 }}>All caught up!</h3>
                            <p className="text-muted text-sm">No notifications right now.</p>
                        </div>
                    ) : (
                        <>
                            {unread.length > 0 && (
                                <div style={{ marginBottom: 16 }}>
                                    <div className="text-xs font-semibold text-muted" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>New</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {unread.map(notif => (
                                            <button
                                                key={notif.id}
                                                onClick={() => handleClick(notif)}
                                                style={{
                                                    display: 'flex', alignItems: 'flex-start', gap: 12,
                                                    background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                                                    borderRadius: 12, padding: '12px 14px',
                                                    cursor: 'pointer', textAlign: 'left', width: '100%',
                                                }}
                                            >
                                                <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{notifIcon(notif)}</span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>{notif.title}</div>
                                                    <div className="text-sm text-muted" style={{ marginBottom: 4 }}>{notif.message || notif.desc}</div>
                                                    <div className="text-xs text-muted">{relativeTime(notif.createdAt) || notif.time}</div>
                                                </div>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 4 }} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {read.length > 0 && (
                                <div>
                                    <div className="text-xs font-semibold text-muted" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Earlier</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {read.map(notif => (
                                            <button
                                                key={notif.id}
                                                onClick={() => handleClick(notif)}
                                                style={{
                                                    display: 'flex', alignItems: 'flex-start', gap: 12,
                                                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                                    borderRadius: 12, padding: '12px 14px',
                                                    cursor: 'pointer', textAlign: 'left', width: '100%', opacity: 0.75,
                                                }}
                                            >
                                                <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{notifIcon(notif)}</span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>{notif.title}</div>
                                                    <div className="text-sm text-muted" style={{ marginBottom: 4 }}>{notif.message || notif.desc}</div>
                                                    <div className="text-xs text-muted">{relativeTime(notif.createdAt) || notif.time}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {activeTab === 'approvals' && (
                <div>
                    {pendingApprovals.length === 0 ? (
                        <div className="glass-card no-hover text-center" style={{ padding: 48 }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✅</div>
                            <h3 style={{ marginBottom: 8 }}>No pending approvals</h3>
                            <p className="text-muted text-sm">All join requests have been handled.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {pendingApprovals.map(({ game, playerId, position, player: rsvpPlayer }) => {
                                const p = rsvpPlayer || getPlayer(playerId) || (state.players || []).find(pl => String(pl.id) === String(playerId));
                                const displayName = p?.name || 'Unknown Player';
                                const approveKey = `${game.id}-${playerId}-yes`;
                                const declineKey = `${game.id}-${playerId}-no`;
                                return (
                                    <div key={`${game.id}-${playerId}`} className="glass-card no-hover" style={{ padding: '14px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                                            <div className="avatar" style={{ flexShrink: 0 }}>{getInitials(displayName)}</div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{displayName}</div>
                                                <div className="text-xs text-muted">wants to join · {position || 'no position set'}</div>
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted" style={{ marginBottom: 10, paddingLeft: 52 }}>
                                            {game.title} · {formatDate(game.date)}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, paddingLeft: 52 }}>
                                            <button
                                                className="btn btn-primary"
                                                style={{ flex: 1, padding: '8px 0', fontSize: '0.875rem' }}
                                                disabled={!!actionLoading}
                                                onClick={() => handleHostAction(game.id, playerId, 'yes')}
                                            >
                                                {actionLoading === approveKey ? '...' : '✓ Approve'}
                                            </button>
                                            <button
                                                className="btn btn-outline"
                                                style={{ flex: 1, padding: '8px 0', fontSize: '0.875rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                                                disabled={!!actionLoading}
                                                onClick={() => handleHostAction(game.id, playerId, 'no')}
                                            >
                                                {actionLoading === declineKey ? '...' : '✕ Decline'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
