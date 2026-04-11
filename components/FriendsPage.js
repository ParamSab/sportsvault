'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { PLAYERS, SPORTS, getPlayer, getInitials, getTrustTier, getSportEmoji } from '@/lib/mockData';

export default function FriendsPage({ onViewProfile, onViewGame }) {
    const { state, dispatch } = useStore();
    const [searchPhone, setSearchPhone] = useState('');
    const [activeView, setActiveView] = useState('friends');
    const [tierSport, setTierSport] = useState('football');
    const [showNewNameInput, setShowNewNameInput] = useState(false);
    const [newName, setNewName] = useState('');
    const [addingId, setAddingId] = useState(null);
    const [toast, setToast] = useState('');

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    // Use String comparison to handle both UUID and mock IDs
    const friendPlayers = (state.friends || [])
        .map(fId => getPlayer(fId) || (state.players || []).find(p => p && String(p.id) === String(fId)))
        .filter(Boolean);

    const friendTiers = state.friendTiers || {};

    const suggestedPlayers = PLAYERS
        .filter(p => !(state.friends || []).some(fId => String(fId) === String(p.id)) && p.id !== state.currentUser?.id && p.id !== 'current')
        .slice(0, 5);

    const handleAddByPhone = async () => {
        if (searchPhone.length < 10) return;

        const found = PLAYERS.find(p => p.phone?.endsWith(searchPhone)) ||
            (state.players || []).find(p => p.phone && p.phone.endsWith(searchPhone));

        if (found) {
            setAddingId(found.id);
            const res = await fetch('/api/friends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add', friendId: found.id })
            });
            const data = await res.json();
            if (data.success) {
                dispatch({ type: 'ADD_FRIEND', payload: found.id });
                showToast('Friend added!');
            }
            setSearchPhone('');
            setShowNewNameInput(false);
            setNewName('');
            setAddingId(null);
        } else if (!showNewNameInput) {
            setShowNewNameInput(true);
        } else if (newName.trim().length > 0) {
            const phone = `+91${searchPhone}`;
            setAddingId('new');
            const res = await fetch('/api/friends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add', phone, name: newName.trim() })
            });
            const data = await res.json();
            if (data.success || data.friendId) {
                dispatch({ type: 'ADD_FRIEND', payload: { isNew: true, phone, name: newName.trim(), id: data.friendId } });
                showToast(`${newName.trim()} added!`);
            }
            setSearchPhone('');
            setShowNewNameInput(false);
            setNewName('');
            setAddingId(null);
        }
    };

    const handleSetTier = async (friendId, tier) => {
        await fetch('/api/friends/tier', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ friendId, sport: tierSport, tier })
        });
        dispatch({ type: 'SET_FRIEND_TIER', payload: { friendId, sport: tierSport, tier } });
    };

    const handleWhatsApp = (friend) => {
        if (!friend.phone) return;
        const phone = friend.phone.replace(/^\+/, '');
        const msg = encodeURIComponent(`Hey ${friend.name?.split(' ')[0] || ''}! Wanna play? Let's link up on SportsVault.`);
        window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    };

    const handleSuggestFriendRequest = async (playerId) => {
        setAddingId(playerId);
        try {
            const res = await fetch('/api/friends/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'send', friendId: playerId })
            });
            const data = await res.json();
            if (data.success) {
                dispatch({ type: 'ADD_FRIEND', payload: playerId });
                showToast('Friend request sent!');
            } else if (data.error) {
                // Fallback to direct add for mock players
                await fetch('/api/friends', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'add', friendId: playerId })
                });
                dispatch({ type: 'ADD_FRIEND', payload: playerId });
                showToast('Friend added!');
            }
        } catch (_) {
            dispatch({ type: 'ADD_FRIEND', payload: playerId });
            showToast('Friend added!');
        }
        setAddingId(null);
    };

    // Group friends by tier for the selected sport
    const groupedFriends = { 1: [], 2: [], 3: [], none: [] };
    friendPlayers.forEach(f => {
        const tier = friendTiers[f.id]?.[tierSport];
        if (tier) groupedFriends[tier].push(f);
        else groupedFriends.none.push(f);
    });

    const safeArray = (arr) => Array.isArray(arr) ? arr : [];

    const renderFriendCard = (friend) => {
        const trust = getTrustTier(friend.trustScore || 0);
        const currentTier = friendTiers[friend.id]?.[tierSport] || null;
        const sports = safeArray(friend.sports);

        return (
            <div key={friend.id} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px 10px' }}>
                    <div
                        className="avatar"
                        style={{
                            borderColor: trust.color, cursor: 'pointer', flexShrink: 0,
                            background: friend.photo ? `url(${friend.photo}) center/cover` : `linear-gradient(135deg, ${trust.color}30, var(--bg-secondary))`,
                            fontSize: friend.photo ? '0' : undefined,
                        }}
                        onClick={() => onViewProfile(friend.id)}
                    >
                        {friend.photo ? '' : getInitials(friend.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onViewProfile(friend.id)}>
                        <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {friend.name}
                        </div>
                        <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{sports.slice(0, 3).map(s => SPORTS[s]?.emoji || getSportEmoji(s)).join(' ')}</span>
                            {friend.location && <><span>·</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{friend.location}</span></>}
                        </div>
                    </div>
                    {friend.phone && (
                        <button
                            onClick={() => handleWhatsApp(friend)}
                            style={{
                                width: 34, height: 34, borderRadius: '50%', border: 'none',
                                background: 'rgba(37,211,102,0.15)', color: '#25d366',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1rem', cursor: 'pointer', flexShrink: 0,
                                transition: 'all 0.15s',
                            }}
                            title="Message on WhatsApp"
                        >
                            💬
                        </button>
                    )}
                </div>
                <div style={{ padding: '0 14px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="text-xs text-muted" style={{ flexShrink: 0 }}>List:</span>
                    {[1, 2, 3].map(tier => {
                        const active = currentTier === tier;
                        return (
                            <button
                                key={tier}
                                onClick={() => handleSetTier(friend.id, active ? null : tier)}
                                style={{
                                    fontSize: '0.6875rem', padding: '3px 10px', borderRadius: 99, cursor: 'pointer',
                                    border: `1px solid ${active ? SPORTS[tierSport]?.color || '#6366f1' : 'var(--border-color)'}`,
                                    background: active ? `${SPORTS[tierSport]?.color || '#6366f1'}25` : 'transparent',
                                    color: active ? (SPORTS[tierSport]?.color || '#6366f1') : 'var(--text-muted)',
                                    fontWeight: active ? 700 : 400, transition: 'all 0.15s',
                                }}
                            >
                                {tier}
                            </button>
                        );
                    })}
                    <span className={`trust-badge ${trust.css}`} style={{ marginLeft: 'auto', fontSize: '0.625rem', padding: '2px 8px' }}>
                        {trust.name}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in">
            {toast && (
                <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 99, padding: '10px 20px', fontWeight: 600, fontSize: '0.875rem', zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', whiteSpace: 'nowrap' }}>
                    {toast}
                </div>
            )}

            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 2 }}>Friends</h1>
                <p className="text-muted text-sm">{friendPlayers.length} connected · manage your squad</p>
            </div>

            {/* Add Friend Card */}
            <div className="glass-card no-hover" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '0.9375rem', marginBottom: 12 }}>+ Add Friend by Phone</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{
                            padding: '11px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)', fontSize: '0.8125rem', color: 'var(--text-secondary)',
                            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                        }}>🇮🇳 +91</div>
                        <input
                            type="tel"
                            placeholder="Mobile number"
                            value={searchPhone}
                            onChange={e => { setSearchPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setShowNewNameInput(false); }}
                            style={{ flex: 1 }}
                        />
                        {!showNewNameInput && (
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleAddByPhone}
                                disabled={searchPhone.length < 10 || addingId === 'new'}
                                style={{ flexShrink: 0 }}
                            >
                                {addingId ? '…' : 'Find'}
                            </button>
                        )}
                    </div>
                    {showNewNameInput && (
                        <div className="animate-fade-in" style={{ borderTop: '1px dashed var(--border-color)', paddingTop: 10 }}>
                            <p className="text-xs text-muted" style={{ marginBottom: 8 }}>Number not found on SportsVault. Save as offline friend?</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input type="text" placeholder="Friend's Name" value={newName} onChange={e => setNewName(e.target.value)} style={{ flex: 1 }} autoFocus />
                                <button className="btn btn-primary btn-sm" onClick={handleAddByPhone} disabled={newName.trim().length === 0 || !!addingId} style={{ flexShrink: 0 }}>
                                    {addingId ? '…' : 'Save'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="tab-bar" style={{ marginBottom: 16 }}>
                <button className={`tab-item ${activeView === 'friends' ? 'active' : ''}`} onClick={() => setActiveView('friends')}>
                    🎯 My Squad ({friendPlayers.length})
                </button>
                <button className={`tab-item ${activeView === 'discover' ? 'active' : ''}`} onClick={() => setActiveView('discover')}>
                    🔍 Discover
                </button>
            </div>

            {/* Friends list with tier management */}
            {activeView === 'friends' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {friendPlayers.length === 0 ? (
                        <div className="glass-card no-hover text-center" style={{ padding: 40 }}>
                            <div style={{ fontSize: '3rem', marginBottom: 12 }}>👥</div>
                            <h3 style={{ marginBottom: 8, fontSize: '1.125rem' }}>Your squad is empty</h3>
                            <p className="text-muted text-sm" style={{ marginBottom: 20 }}>Add friends by phone number above or discover players below.</p>
                            <button className="btn btn-primary btn-sm" onClick={() => setActiveView('discover')}>
                                Find Players →
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Sport selector for tiers */}
                            <div>
                                <p className="text-xs text-muted" style={{ marginBottom: 8 }}>Priority list for:</p>
                                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                                    {Object.keys(SPORTS).map(s => (
                                        <button
                                            key={s}
                                            onClick={() => setTierSport(s)}
                                            style={{
                                                padding: '6px 14px', borderRadius: 99, fontSize: '0.8125rem', whiteSpace: 'nowrap',
                                                border: `1px solid ${tierSport === s ? SPORTS[s].color : 'var(--border-color)'}`,
                                                background: tierSport === s ? `${SPORTS[s].color}20` : 'transparent',
                                                color: tierSport === s ? SPORTS[s].color : 'var(--text-secondary)',
                                                cursor: 'pointer', transition: 'all 0.15s', fontWeight: tierSport === s ? 600 : 400,
                                            }}
                                        >
                                            {SPORTS[s].emoji} {SPORTS[s].name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Tier groups */}
                            {[1, 2, 3].map(tier => groupedFriends[tier].length > 0 && (
                                <div key={tier}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: ['#6366f1', '#a855f7', '#ec4899'][tier - 1] }} />
                                        <span className="text-xs font-semibold text-muted" style={{ letterSpacing: '0.06em' }}>
                                            PRIORITY {tier} · {groupedFriends[tier].length} player{groupedFriends[tier].length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {groupedFriends[tier].map(f => renderFriendCard(f))}
                                    </div>
                                </div>
                            ))}

                            {groupedFriends.none.length > 0 && (
                                <div>
                                    {(groupedFriends[1].length > 0 || groupedFriends[2].length > 0 || groupedFriends[3].length > 0) && (
                                        <p className="text-xs text-muted font-semibold" style={{ marginBottom: 8, letterSpacing: '0.06em' }}>UNASSIGNED</p>
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {groupedFriends.none.map(f => renderFriendCard(f))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Discover people */}
            {activeView === 'discover' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p className="text-xs text-muted" style={{ marginBottom: 4 }}>Players you might know:</p>
                    {suggestedPlayers.length === 0 ? (
                        <div className="glass-card no-hover text-center" style={{ padding: 32 }}>
                            <p className="text-muted text-sm">You've connected with everyone! 🎉</p>
                        </div>
                    ) : (
                        suggestedPlayers.map(player => {
                            const trust = getTrustTier(player.trustScore || 0);
                            const isAdding = addingId === player.id;
                            const alreadyFriend = (state.friends || []).some(fId => String(fId) === String(player.id));
                            const sports = safeArray(player.sports);
                            return (
                                <div key={player.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
                                    <div
                                        className="avatar"
                                        style={{
                                            borderColor: trust.color, cursor: 'pointer',
                                            background: player.photo ? `url(${player.photo}) center/cover` : undefined,
                                            fontSize: player.photo ? '0' : undefined,
                                        }}
                                        onClick={() => onViewProfile(player.id)}
                                    >
                                        {player.photo ? '' : getInitials(player.name)}
                                    </div>
                                    <div style={{ flex: 1, cursor: 'pointer', minWidth: 0 }} onClick={() => onViewProfile(player.id)}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: 2 }}>{player.name}</div>
                                        <div className="text-xs text-muted">
                                            {sports.slice(0, 3).map(s => SPORTS[s]?.emoji || getSportEmoji(s)).join(' ')} · {player.gamesPlayed ?? 0} games
                                        </div>
                                    </div>
                                    <button
                                        className={`btn btn-sm ${alreadyFriend ? 'btn-outline' : 'btn-primary'}`}
                                        style={{ flexShrink: 0 }}
                                        disabled={isAdding}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (alreadyFriend) dispatch({ type: 'REMOVE_FRIEND', payload: player.id });
                                            else handleSuggestFriendRequest(player.id);
                                        }}
                                    >
                                        {isAdding ? '…' : alreadyFriend ? '✓ Friends' : '+ Add'}
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
