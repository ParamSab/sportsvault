'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { SPORTS } from '@/lib/mockData';

export default function NotificationsPage({ onViewGame }) {
    const { state, dispatch } = useStore();
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
            <p className="text-muted text-sm" style={{ marginBottom: 20 }}>
                {unread.length} unread
            </p>

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
        </div>
    );
}
