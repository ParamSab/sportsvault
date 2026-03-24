'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InvitePage() {
    const [friends, setFriends] = useState([]);
    const [selectedFriends, setSelectedFriends] = useState([]);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const router = useRouter();

    useEffect(() => {
        fetchFriends();
    }, []);

    const fetchFriends = async () => {
        try {
            const res = await fetch('/api/friends/list');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setFriends(data.friends || []);
        } catch (err) {
            setError('Failed to load friends');
            console.error(err);
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
        if (selectedFriends.length === 0) {
            setError('Please select at least one friend');
            return;
        }
        setSending(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch('/api/friends/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ friendIds: selectedFriends, method, message }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            if (method === 'sms' && data.smsLinks) {
                // Open WhatsApp broadcast link if possible, or individual links
                // For "broadcast" on WhatsApp, we can use the list of numbers
                const phoneNumbers = data.smsLinks.map(l => l.phone).join(',');
                const encodedMsg = encodeURIComponent(message || 'Join me on SportsVault!');
                
                // Triggering the broadcase link
                const whatsappUrl = `https://wa.me/?text=${encodedMsg}`;
                window.open(whatsappUrl, '_blank');
                
                setSuccess('Opening WhatsApp for broadcast...');
            } else {
                setSuccess('Invitations sent successfully!');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSending(false);
        }
    };

    const filteredFriends = friends.filter(f => 
        f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.phone && f.phone.includes(searchTerm))
    );

    if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

    return (
        <div className="page-container invite-friends">
            <div className="glass-card main-card">
                <header className="header">
                    <h1 className="title-gradient">Invite Friends</h1>
                    <p className="subtitle">Select friends to invite to your next game</p>
                </header>

                <div className="search-bar">
                    <input 
                        type="text" 
                        placeholder="Search friends by name or phone..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="glass-input"
                    />
                </div>

                <div className="friends-list">
                    {filteredFriends.length === 0 ? (
                        <div className="empty-state">No friends found</div>
                    ) : (
                        filteredFriends.map(friend => (
                            <div 
                                key={friend.id} 
                                className={`friend-item ${selectedFriends.includes(friend.id) ? 'selected' : ''}`}
                                onClick={() => toggleFriend(friend.id)}
                            >
                                <div className="avatar">
                                    {friend.photo ? <img src={friend.photo} alt="" /> : friend.name[0]}
                                </div>
                                <div className="info">
                                    <div className="name">{friend.name}</div>
                                    <div className="phone">{friend.phone}</div>
                                </div>
                                <div className="checkbox">
                                    {selectedFriends.includes(friend.id) && <span className="check">✓</span>}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="message-section">
                    <label>Broadcast Message</label>
                    <textarea 
                        className="glass-input"
                        placeholder="Type your invitation message here..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={3}
                    />
                </div>

                {error && <div className="error-box">{error}</div>}
                {success && <div className="success-box">{success}</div>}

                <div className="actions">
                    <button 
                        className="btn secondary" 
                        onClick={() => handleInvite('app')}
                        disabled={sending || selectedFriends.length === 0}
                    >
                        {sending ? 'Sending...' : 'Invite via App'}
                    </button>
                    <button 
                        className="btn primary" 
                        onClick={() => handleInvite('sms')}
                        disabled={sending || selectedFriends.length === 0}
                    >
                        {sending ? 'Preparing...' : 'Invite via WhatsApp'}
                    </button>
                    <button 
                        className="btn ghost" 
                        onClick={() => router.push('/')}
                    >
                        Skip for now
                    </button>
                </div>
            </div>

            <style jsx>{`
                .invite-friends {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 90vh;
                    padding: 20px;
                }
                .main-card {
                    max-width: 500px;
                    width: 100%;
                    padding: 32px;
                }
                .header { margin-bottom: 24px; text-align: center; }
                .subtitle { color: var(--text-muted); font-size: 0.9rem; margin-top: 8px; }
                .search-bar { margin-bottom: 20px; }
                .friends-list {
                    max-height: 300px;
                    overflow-y: auto;
                    margin-bottom: 24px;
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.03);
                    padding: 8px;
                }
                .friend-item {
                    display: flex;
                    align-items: center;
                    padding: 12px;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-bottom: 4px;
                }
                .friend-item:hover { background: rgba(255, 255, 255, 0.05); }
                .friend-item.selected { background: rgba(var(--primary-rgb), 0.15); }
                .avatar {
                    width: 40px;
                    height: 40px;
                    background: var(--primary-gradient);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    margin-right: 12px;
                    overflow: hidden;
                }
                .info { flex: 1; }
                .name { font-weight: 600; font-size: 0.95rem; }
                .phone { font-size: 0.8rem; color: var(--text-muted); }
                .checkbox {
                    width: 20px;
                    height: 20px;
                    border: 2px solid rgba(255, 255, 255, 0.2);
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .selected .checkbox { background: var(--primary-gradient); border-color: transparent; }
                .check { color: white; font-size: 0.8rem; font-weight: 900; }
                .message-section { margin-bottom: 24px; }
                .message-section label { display: block; margin-bottom: 8px; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); }
                .actions { display: flex; flex-direction: column; gap: 12px; }
                .btn { width: 100%; border-radius: 14px; padding: 14px; font-weight: 700; }
                .error-box { background: rgba(var(--error-rgb), 0.1); color: var(--error); padding: 12px; border-radius: 10px; font-size: 0.85rem; margin-bottom: 20px; border: 1px solid rgba(var(--error-rgb), 0.2); }
                .success-box { background: rgba(var(--success-rgb), 0.1); color: var(--success); padding: 12px; border-radius: 10px; font-size: 0.85rem; margin-bottom: 20px; border: 1px solid rgba(var(--success-rgb), 0.2); }
                .empty-state { text-align: center; padding: 40px 20px; color: var(--text-muted); font-size: 0.9rem; }
            `}</style>
        </div>
    );
}
