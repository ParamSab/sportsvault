'use client';

import React, { useState, useEffect } from 'react';

export default function InvitePage() {
    const [friends, setFriends] = useState([]);
    const [selectedFriends, setSelectedFriends] = useState([]);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState('');
    const [whatsappLinks, setWhatsappLinks] = useState([]);

    useEffect(() => { fetchFriends(); }, []);

    const fetchFriends = async () => {
        try {
            const res = await fetch('/api/friends/list');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setFriends(data.friends || []);
        } catch (err) {
            setError('Failed to load friends. Make sure you are logged in.');
        } finally {
            setLoading(false);
        }
    };

    const toggleFriend = (id) => {
        setSelectedFriends(prev =>
            prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
        );
    };

    const handleInvite = async (method) => {
        if (selectedFriends.length === 0) { setError('Select at least one friend'); return; }
        setSending(true);
        setError('');
        setWhatsappLinks([]);

        try {
            const res = await fetch('/api/friends/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ friendIds: selectedFriends, method, message }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            if (method === 'sms' && data.smsLinks?.length > 0) {
                if (data.smsLinks.length === 1) {
                    // Single friend — open WhatsApp directly
                    window.open(data.smsLinks[0].whatsappLink, '_blank');
                } else {
                    // Multiple friends — show clickable links
                    setWhatsappLinks(data.smsLinks);
                }
            } else if (method === 'app') {
                setError('');
                alert('In-app notifications sent!');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSending(false);
        }
    };

    const filteredFriends = friends.filter(f =>
        f.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.phone && f.phone.includes(searchTerm))
    );

    if (loading) {
        return (
            <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 16 }}>👥</div>
                    <p className="text-muted">Loading friends…</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div className="glass-card no-hover" style={{ maxWidth: 480, width: '100%', padding: 28 }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📲</div>
                    <h2 style={{ marginBottom: 6 }}>Invite Friends</h2>
                    <p className="text-sm text-muted">Select friends and invite them via WhatsApp</p>
                </div>

                {/* Search */}
                <input
                    type="text"
                    placeholder="Search by name or phone…"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ marginBottom: 16 }}
                />

                {/* Friend List */}
                <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {filteredFriends.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)' }}>
                            {friends.length === 0 ? 'No friends yet — add friends first!' : 'No matches'}
                        </div>
                    ) : (
                        filteredFriends.map(friend => {
                            const selected = selectedFriends.includes(friend.id);
                            return (
                                <div
                                    key={friend.id}
                                    onClick={() => toggleFriend(friend.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 12,
                                        padding: '10px 14px', borderRadius: 'var(--radius-md)',
                                        background: selected ? 'rgba(99,102,241,0.15)' : 'var(--bg-input)',
                                        border: `1px solid ${selected ? '#6366f1' : 'var(--border-color)'}`,
                                        cursor: 'pointer', transition: 'all 0.15s',
                                    }}
                                >
                                    <div className="avatar avatar-sm" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontWeight: 700 }}>
                                        {friend.photo ? '' : (friend.name?.[0] || '?')}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{friend.name}</div>
                                        {friend.phone && <div className="text-xs text-muted">{friend.phone}</div>}
                                    </div>
                                    <div style={{
                                        width: 20, height: 20, borderRadius: 6,
                                        border: `2px solid ${selected ? '#6366f1' : 'rgba(255,255,255,0.2)'}`,
                                        background: selected ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.7rem', color: '#fff', fontWeight: 900,
                                    }}>
                                        {selected && '✓'}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Message */}
                <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                        Message (optional)
                    </label>
                    <textarea
                        placeholder="Type your invitation message…"
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        rows={3}
                        style={{ resize: 'none' }}
                    />
                </div>

                {/* WhatsApp links (for multiple friends) */}
                {whatsappLinks.length > 0 && (
                    <div style={{ marginBottom: 20, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 12, color: '#25d366' }}>Tap to open WhatsApp for each friend:</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {whatsappLinks.map(l => (
                                <a
                                    key={l.friendId}
                                    href={l.whatsappLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '10px 14px', borderRadius: 'var(--radius-md)',
                                        background: 'rgba(37,211,102,0.15)', color: '#25d366',
                                        fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none',
                                    }}
                                >
                                    <span style={{ fontSize: '1.25rem' }}>💬</span>
                                    WhatsApp {l.name || l.phone}
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {error && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.875rem', marginBottom: 16 }}>
                        {error}
                    </div>
                )}

                {/* Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button
                        className="btn btn-block"
                        style={{ background: '#25d366', color: '#fff', fontWeight: 700 }}
                        onClick={() => handleInvite('sms')}
                        disabled={sending || selectedFriends.length === 0}
                    >
                        {sending ? 'Preparing…' : `💬 Invite via WhatsApp (${selectedFriends.length})`}
                    </button>
                    <button
                        className="btn btn-block btn-outline"
                        onClick={() => handleInvite('app')}
                        disabled={sending || selectedFriends.length === 0}
                    >
                        {sending ? 'Sending…' : '🔔 Send In-App Notification'}
                    </button>
                    <a href="/" className="btn btn-block btn-ghost" style={{ textAlign: 'center' }}>
                        Skip for now
                    </a>
                </div>
            </div>
        </div>
    );
}
