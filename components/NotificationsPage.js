'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { SPORTS, getPlayer, getInitials, formatDate } from '@/lib/mockData';

export default function NotificationsPage({ onViewGame }) {
    const { state, dispatch } = useStore();
    const [activeTab, setActiveTab] = useState('alerts'); // 'alerts' | 'approvals'
    const notifications = state.notifications || [];
    const unread = notifications.filter(n => !n.read);
    const read = notifications.filter(n => n.read);

    const sportBgColor = (sport) => {
        if (!sport) return 'rgba(99,102,241,0.15)';
        return SPORTS[sport] ? `${SPORTS[sport].color}20` : 'rgba(99,102,241,0.15)';
    };

    const handleClick = async (notif) => {
        // Mark individual read in store immediately
        dispatch({ type: 'READ_NOTIFICATION', payload: notif.id });
        
        if (notif.gameId) {
            onViewGame(notif.gameId);
        } else if (notif.action && notif.action.includes('game=')) {
            const id = notif.action.split('game=')[1];
            onViewGame(id);
        }
    };

    const myGames = state.games?.filter(g => g.organizerId === (state.currentUser?.dbId || state.currentUser?.id)) || [];
    const pendingApprovals = myGames.flatMap(g => 
        (g.rsvps || [])
            .filter(r => r.status === 'pending')
            .map(r => ({ ...r, game: g }))
    ).sort((a,b) => new Date(b.game.date) - new Date(a.game.date));

    const handleHostAction = async (gameId, playerId, status) => {
        const game = state.games.find(g => g.id === gameId);
        if (!game) return;
        
        const existingRsvp = game.rsvps.find(r => r.playerId === playerId);
        const pos = existingRsvp?.position || '';
        
        const p = r.player || getPlayer(playerId) || state.players?.find(pl => pl.id === playerId);
        const actualPlayerId = p?.dbId || p?.id || playerId;
        
        dispatch({ type: 'RSVP', payload: { gameId, playerId: actualPlayerId, status, position: pos } });

        try {
            await fetch('/api/games/rsvp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameId, playerId: actualPlayerId, status, position: pos })
            });

            if (status === 'yes') {
                fetch('/api/games/reminder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ gameId, playerId: actualPlayerId, type: 'approval' })
                }).catch(err => console.error('Reminder send failed:', err));
            }
        } catch (err) {
            console.error('Host action persistence failed:', err);
        }

        try {
            const res = await fetch(`/api/games/${gameId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.game) dispatch({ type: 'LOAD_STATE', payload: { games: state.games.map(g => g.id === gameId ? data.game : g) } });
            }
        } catch (refreshErr) {
            console.error('Failed to refresh game:', refreshErr);
        }
    };

    // Mark all as read when page is opened
    useEffect(() => {
        const markRead = async () => {
            if (unread.length > 0) {
                try {
                    const res = await fetch('/api/notifications', { method: 'POST' });
                    if (res.ok) {
                        // Optionally update local state too if polling hasn't hit yet
                        // but polling will catch up.
                    }
                } catch (_) {}
            }
        };
        markRead();
    }, [unread.length]);

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="animate-fade-in">
            <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', marginBottom: 4 }}>
                Notifications
            </h1>
            
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, borderBottom: '1px solid var(--border-color)', paddingBottom: 0 }}>
                <button onClick={() => setActiveTab('alerts')} style={{ background: 'none', border: 'none', padding: '8px 12px', fontSize: '1rem', fontWeight: activeTab === 'alerts' ? 700 : 500, color: activeTab === 'alerts' ? 'var(--text-primary)' : 'var(--text-muted)', borderBottom: activeTab === 'alerts' ? '2px solid var(--primary-color)' : '2px solid transparent', cursor: 'pointer' }}>
                    Alerts {unread.length > 0 && <span style={{ marginLeft: 6, background: 'var(--primary-color)', color: '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: 99 }}>{unread.length}</span>}
                </button>
                <button onClick={() => setActiveTab('approvals')} style={{ background: 'none', border: 'none', padding: '8px 12px', fontSize: '1rem', fontWeight: activeTab === 'approvals' ? 700 : 500, color: activeTab === 'approvals' ? 'var(--text-primary)' : 'var(--text-muted)', borderBottom: activeTab === 'approvals' ? '2px solid var(--primary-color)' : '2px solid transparent', cursor: 'pointer' }}>
                    Approvals {pendingApprovals.length > 0 && <span style={{ marginLeft: 6, background: 'var(--warning)', color: '#000', fontSize: '0.7rem', padding: '2px 6px', borderRadius: 99 }}>{pendingApprovals.length}</span>}
                </button>
            </div>

            {activeTab === 'alerts' ? (
                <>
                    {notifications.length === 0 && (
                <div className="glass-card no-hover text-center" style={{ padding: 48 }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔔</div>
                    <h3 style={{ marginBottom: 8 }}>All caught up!</h3>
                    <p className="text-muted text-sm">No notifications right now.</p>
                </div>
            )}

            {/* Unread */}
            {unread.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                    <div className="text-xs font-semibold text-muted" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                        New
                    </div>
                    <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {unread.map(notif => (
                            <button
                                key={notif.id}
                                className="notif-card unread"
                                onClick={() => handleClick(notif)}
                                style={{ cursor: 'pointer', textAlign: 'left', width: '100%' }}
                            >
                                <div className="notif-icon" style={{ background: sportBgColor(notif.sport) }}>
                                    {notif.icon || (notif.title?.includes('Join') ? '🤝' : '🔔')}
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

            {/* Read */}
            {read.length > 0 && (
                <div>
                    <div className="text-xs font-semibold text-muted" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Earlier
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {read.map(notif => (
                            <button
                                key={notif.id}
                                className="notif-card"
                                onClick={() => handleClick(notif)}
                                style={{ cursor: 'pointer', textAlign: 'left', width: '100%', opacity: 0.7 }}
                            >
                                <div className="notif-icon" style={{ background: sportBgColor(notif.sport) }}>
                                    {notif.icon || (notif.title?.includes('Join') ? '🤝' : '🔔')}
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
            ) : (
                <>
                    {pendingApprovals.length === 0 && (
                        <div className="glass-card no-hover text-center" style={{ padding: 48 }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🙌</div>
                            <h3 style={{ marginBottom: 8 }}>All caught up!</h3>
                            <p className="text-muted text-sm">No pending join requests.</p>
                        </div>
                    )}

                    {pendingApprovals.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {pendingApprovals.map(r => {
                                const p = r.player || getPlayer(r.playerId) || state.players?.find(pl => pl.id === r.playerId);
                                if (!p) return null;
                                return (
                                    <div key={`${r.game.id}-${r.playerId}`} className="glass-card no-hover" style={{ padding: 16 }}>
                                        <div className="text-xs text-muted" style={{ marginBottom: 8, cursor: 'pointer' }} onClick={() => onViewGame(r.game.id)}>
                                            ⚽ <span style={{ textDecoration: 'underline' }}>{r.game.title} - {formatDate(r.game.date)}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div className="avatar" style={{ width: 40, height: 40, background: p.photo ? `url(${p.photo}) center/cover` : undefined, fontSize: p.photo ? '0' : '1rem' }}>
                                                {p.photo ? '' : getInitials(p.name)}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600 }}>{p.name}</div>
                                                {p.ratings?.[r.game.sport]?.count >= 10 && <div className="text-xs text-muted">⭐ {p.ratings[r.game.sport].overall} Reliability</div>}
                                            </div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => handleHostAction(r.game.id, r.playerId, 'no')}>Deny</button>
                                                <button className="btn btn-sm btn-primary" onClick={() => handleHostAction(r.game.id, r.playerId, 'yes')}>Accept</button>
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
