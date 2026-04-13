'use client';
import { useState, useCallback, useRef } from 'react';
import { useStore } from '@/lib/store';
import { PLAYERS, SPORTS, getPlayer, getInitials, getTrustTier } from '@/lib/mockData';

export default function FriendsPage({ onViewProfile }) {
    const { state, dispatch } = useStore();
    const [activeView, setActiveView] = useState('friends');
    const [tierSport, setTierSport] = useState('football');
    const [addingId, setAddingId] = useState(null);
    const [toast, setToast] = useState('');
    // Discover search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    // Phone add
    const [showPhoneAdd, setShowPhoneAdd] = useState(false);
    const [phoneNum, setPhoneNum] = useState('');
    const [phoneName, setPhoneName] = useState('');
    const [phoneStep, setPhoneStep] = useState('phone');
    const searchTimerRef = useRef(null);

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const friendPlayers = (state.friends || [])
        .map(fId => getPlayer(fId) || (state.players || []).find(p => p && String(p.id) === String(fId)))
        .filter(Boolean);

    const pendingSent = (state.pendingFriends || []).filter(f => f.isSender);
    const pendingReceived = (state.pendingFriends || []).filter(f => !f.isSender);
    const friendTiers = state.friendTiers || {};
    const safeArray = (arr) => Array.isArray(arr) ? arr : [];

    const refreshFriends = useCallback(async () => {
        try {
            const fRes = await fetch('/api/friends');
            if (!fRes.ok) return;
            const fData = await fRes.json();
            const tiers = {};
            (fData.tiers || []).forEach(t => {
                if (!tiers[t.friendId]) tiers[t.friendId] = {};
                tiers[t.friendId][t.sport] = t.tier;
            });
            const allPlayers = [
                ...(fData.friends || []),
                ...(fData.pendingRequests || []),
                ...(state.players || []),
            ].filter((p, i, arr) => p && arr.findIndex(x => x && String(x.id) === String(p.id)) === i);

            dispatch({ type: 'LOAD_STATE', payload: {
                friends: (fData.friends || []).map(f => f.id || f),
                pendingFriends: fData.pendingRequests || [],
                players: allPlayers,
                friendTiers: tiers,
            }});
        } catch (_) {}
    }, [dispatch, state.players]);

    const handleAddByPhone = async () => {
        const digits = phoneNum.replace(/\D/g, '');
        if (digits.length < 7) return;

        const found = (state.players || []).find(p => p?.phone && p.phone.replace(/\D/g, '').endsWith(digits));

        if (found) {
            setAddingId(found.id);
            const res = await fetch('/api/friends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add', friendId: found.id }),
            });
            const data = await res.json();
            if (data.success) { await refreshFriends(); showToast('Friend added!'); }
            setShowPhoneAdd(false); setPhoneNum(''); setPhoneName(''); setPhoneStep('phone'); setAddingId(null);
        } else if (phoneStep === 'phone') {
            setPhoneStep('name');
        } else if (phoneName.trim()) {
            const fullPhone = phoneNum.startsWith('+') ? phoneNum : `+${phoneNum}`;
            setAddingId('new');
            const res = await fetch('/api/friends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add', phone: fullPhone, name: phoneName.trim() }),
            });
            const data = await res.json();
            if (data.success || data.friendId) {
                dispatch({ type: 'ADD_FRIEND', payload: { isNew: true, phone: fullPhone, name: phoneName.trim(), id: data.friendId } });
                showToast(`${phoneName.trim()} added!`);
            }
            setShowPhoneAdd(false); setPhoneNum(''); setPhoneName(''); setPhoneStep('phone'); setAddingId(null);
        }
    };

    const handleSetTier = async (friendId, tier) => {
        await fetch('/api/friends/tier', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ friendId, sport: tierSport, tier }),
        });
        dispatch({ type: 'SET_FRIEND_TIER', payload: { friendId, sport: tierSport, tier } });
    };

    const handleWhatsApp = (friend) => {
        if (!friend.phone) return;
        const phone = friend.phone.replace(/[^\d]/g, '');
        const msg = encodeURIComponent(`Hey ${friend.name?.split(' ')[0] || ''}! Wanna play? Find me on SportsVault.`);
        window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    };

    const handleAddFriend = async (playerId) => {
        setAddingId(playerId);
        try {
            const res = await fetch('/api/friends/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'send', friendId: playerId }),
            });
            const data = await res.json();
            if (data.success) {
                await refreshFriends();
                showToast('Friend request sent!');
            } else {
                // Fallback: direct add (for mock/local players)
                const res2 = await fetch('/api/friends', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'add', friendId: playerId }),
                });
                const d2 = await res2.json();
                if (d2.success) { await refreshFriends(); showToast('Friend added!'); }
                else { dispatch({ type: 'ADD_FRIEND', payload: playerId }); showToast('Friend added!'); }
            }
        } catch (_) {
            dispatch({ type: 'ADD_FRIEND', payload: playerId });
            showToast('Friend added!');
        }
        setAddingId(null);
    };

    const handleAcceptRequest = async (friendId) => {
        setAddingId(friendId);
        await fetch('/api/friends/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'accept', friendId }),
        });
        await refreshFriends();
        showToast('Friend request accepted!');
        setAddingId(null);
    };

    const handleRejectRequest = async (friendId) => {
        setAddingId(friendId);
        await fetch('/api/friends/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reject', friendId }),
        });
        await refreshFriends();
        setAddingId(null);
    };

    const handleCancelRequest = async (friendId) => {
        setAddingId(friendId);
        await fetch('/api/friends/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'cancel', friendId }),
        });
        await refreshFriends();
        showToast('Request withdrawn');
        setAddingId(null);
    };

    const handleRemoveFriend = async (friendId) => {
        await fetch('/api/friends', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'remove', friendId }),
        });
        dispatch({ type: 'REMOVE_FRIEND', payload: friendId });
        showToast('Removed from squad');
    };

    const handleSearch = (q) => {
        setSearchQuery(q);
        if (q.trim().length < 2) { setSearchResults([]); setIsSearching(false); return; }
        setIsSearching(true);
        // Debounce: wait 350ms after last keystroke before querying
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/users?q=${encodeURIComponent(q.trim())}`);
                const data = await res.json();
                setSearchResults(data.users || []);
            } catch (_) {
                setSearchResults(PLAYERS.filter(p => p.name?.toLowerCase().includes(q.toLowerCase())));
            } finally {
                setIsSearching(false);
            }
        }, 350);
    };

    // Group friends by tier for the selected sport
    const groupedFriends = { 1: [], 2: [], 3: [], none: [] };
    friendPlayers.forEach(f => {
        const tier = friendTiers[String(f.id)]?.[tierSport];
        if (tier) groupedFriends[tier].push(f);
        else groupedFriends.none.push(f);
    });

    const myId = state.currentUser?.dbId || state.currentUser?.id;
    const allRelatedIds = new Set([
        ...(state.friends || []).map(String),
        ...pendingReceived.map(f => String(f.id)),
        ...pendingSent.map(f => String(f.id)),
        String(myId),
    ]);
    const suggestedPlayers = searchQuery.trim().length >= 2
        ? searchResults.filter(p => !allRelatedIds.has(String(p.id)))
        : PLAYERS.filter(p => !allRelatedIds.has(String(p.id)) && p.id !== 'current').slice(0, 8);

    const renderFriendCard = (friend) => {
        const trust = getTrustTier(friend.trustScore || 0);
        const currentTier = friendTiers[String(friend.id)]?.[tierSport] || null;
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
                            <span>{sports.slice(0, 3).map(s => SPORTS[s]?.emoji || '').join(' ')}</span>
                            {friend.location && <><span>·</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{friend.location}</span></>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {friend.phone && (
                            <button
                                onClick={() => handleWhatsApp(friend)}
                                style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(37,211,102,0.15)', color: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', cursor: 'pointer' }}
                                title="Message on WhatsApp"
                            >💬</button>
                        )}
                        <button
                            onClick={() => handleRemoveFriend(friend.id)}
                            style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', cursor: 'pointer' }}
                            title="Remove from squad"
                        >✕</button>
                    </div>
                </div>
                <div style={{ padding: '0 14px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="text-xs text-muted" style={{ flexShrink: 0 }}>Priority:</span>
                    {[1, 2, 3].map(tier => {
                        const active = currentTier === tier;
                        const tierColors = ['#6366f1', '#a855f7', '#ec4899'];
                        return (
                            <button
                                key={tier}
                                onClick={() => handleSetTier(friend.id, active ? null : tier)}
                                style={{
                                    fontSize: '0.6875rem', padding: '3px 10px', borderRadius: 99, cursor: 'pointer',
                                    border: `1px solid ${active ? tierColors[tier - 1] : 'var(--border-color)'}`,
                                    background: active ? `${tierColors[tier - 1]}25` : 'transparent',
                                    color: active ? tierColors[tier - 1] : 'var(--text-muted)',
                                    fontWeight: active ? 700 : 400, transition: 'all 0.15s',
                                }}
                            >{tier}</button>
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
            {/* Toast */}
            {toast && (
                <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-card)', border: '1px solid var(--primary-color)', borderRadius: 99, padding: '10px 20px', fontWeight: 600, fontSize: '0.875rem', zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', whiteSpace: 'nowrap', color: 'var(--primary-color)' }}>
                    {toast}
                </div>
            )}

            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 4 }}>Squad</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="text-muted text-sm">{friendPlayers.length} friends connected</span>
                    {pendingReceived.length > 0 && (
                        <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderRadius: 99, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>
                            {pendingReceived.length} new request{pendingReceived.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="tab-bar" style={{ marginBottom: 16 }}>
                <button className={`tab-item ${activeView === 'friends' ? 'active' : ''}`} onClick={() => setActiveView('friends')}>
                    👥 My Squad
                    {pendingReceived.length > 0 && (
                        <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', fontSize: '0.65rem', padding: '1px 5px', borderRadius: 99, fontWeight: 700 }}>
                            {pendingReceived.length}
                        </span>
                    )}
                </button>
                <button className={`tab-item ${activeView === 'discover' ? 'active' : ''}`} onClick={() => setActiveView('discover')}>
                    🔍 Discover
                </button>
            </div>

            {/* ─── MY SQUAD TAB ─── */}
            {activeView === 'friends' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Incoming friend requests */}
                    {pendingReceived.length > 0 && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef4444' }} />
                                <span className="text-xs font-semibold" style={{ color: '#ef4444', letterSpacing: '0.06em' }}>
                                    FRIEND REQUESTS · {pendingReceived.length}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {pendingReceived.map(player => (
                                    <div key={player.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderLeft: '3px solid #ef4444' }}>
                                        <div
                                            className="avatar"
                                            style={{ cursor: 'pointer', flexShrink: 0, background: player.photo ? `url(${player.photo}) center/cover` : undefined, fontSize: player.photo ? '0' : undefined }}
                                            onClick={() => onViewProfile(player.id)}
                                        >
                                            {player.photo ? '' : getInitials(player.name || '?')}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600 }}>{player.name || 'Unknown'}</div>
                                            <div className="text-xs text-muted">
                                                {safeArray(player.sports).slice(0, 2).map(s => SPORTS[s]?.emoji || '').join(' ')}
                                                {player.location && <> · {player.location}</>}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                            <button
                                                className="btn btn-sm btn-ghost"
                                                style={{ padding: '5px 10px', border: '1px solid var(--border-color)' }}
                                                disabled={addingId === player.id}
                                                onClick={() => handleRejectRequest(player.id)}
                                            >Ignore</button>
                                            <button
                                                className="btn btn-sm btn-primary"
                                                style={{ padding: '5px 14px' }}
                                                disabled={addingId === player.id}
                                                onClick={() => handleAcceptRequest(player.id)}
                                            >{addingId === player.id ? '…' : 'Accept'}</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Outgoing pending requests */}
                    {pendingSent.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-muted" style={{ marginBottom: 8, letterSpacing: '0.06em' }}>SENT REQUESTS · {pendingSent.length}</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {pendingSent.map(player => (
                                    <div key={player.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, opacity: 0.8 }}>
                                        <div className="avatar" style={{ flexShrink: 0, background: player.photo ? `url(${player.photo}) center/cover` : undefined, fontSize: player.photo ? '0' : undefined }}>
                                            {player.photo ? '' : getInitials(player.name || '?')}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600 }}>{player.name || 'Unknown'}</div>
                                            <div className="text-xs text-muted">Request pending…</div>
                                        </div>
                                        <button
                                            className="btn btn-sm btn-ghost"
                                            style={{ fontSize: '0.75rem', padding: '4px 10px', flexShrink: 0 }}
                                            disabled={addingId === player.id}
                                            onClick={() => handleCancelRequest(player.id)}
                                        >{addingId === player.id ? '…' : 'Withdraw'}</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add by phone */}
                    <div className="glass-card no-hover" style={{ padding: '12px 14px' }}>
                        {!showPhoneAdd ? (
                            <button
                                onClick={() => setShowPhoneAdd(true)}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-color)', fontWeight: 600, fontSize: '0.875rem', padding: 0 }}
                            >
                                <span style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px dashed var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>+</span>
                                Add friend by phone number
                            </button>
                        ) : (
                            <div className="animate-fade-in">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                                        {phoneStep === 'phone' ? 'Enter phone number' : 'Save as offline contact'}
                                    </span>
                                    <button onClick={() => { setShowPhoneAdd(false); setPhoneNum(''); setPhoneName(''); setPhoneStep('phone'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.125rem', lineHeight: 1 }}>×</button>
                                </div>
                                {phoneStep === 'phone' ? (
                                    <>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <input
                                                type="tel"
                                                placeholder="With country code, e.g. 917904008139"
                                                value={phoneNum}
                                                onChange={e => { setPhoneNum(e.target.value.replace(/[^\d+]/g, '')); setPhoneStep('phone'); }}
                                                style={{ flex: 1, fontSize: '0.875rem' }}
                                                autoFocus
                                            />
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={handleAddByPhone}
                                                disabled={phoneNum.replace(/\D/g, '').length < 7 || !!addingId}
                                                style={{ flexShrink: 0 }}
                                            >{addingId ? '…' : 'Find'}</button>
                                        </div>
                                        <p className="text-xs text-muted" style={{ marginTop: 6 }}>Include country code (e.g. 91 for India, 44 for UK)</p>
                                    </>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <p className="text-xs text-muted">Not on SportsVault yet. Save as offline contact?</p>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <input
                                                type="text"
                                                placeholder="Their name"
                                                value={phoneName}
                                                onChange={e => setPhoneName(e.target.value)}
                                                style={{ flex: 1, fontSize: '0.875rem' }}
                                                autoFocus
                                            />
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={handleAddByPhone}
                                                disabled={!phoneName.trim() || !!addingId}
                                                style={{ flexShrink: 0 }}
                                            >{addingId ? '…' : 'Save'}</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Empty state */}
                    {friendPlayers.length === 0 && pendingReceived.length === 0 && pendingSent.length === 0 && (
                        <div className="glass-card no-hover text-center" style={{ padding: 40 }}>
                            <div style={{ fontSize: '3rem', marginBottom: 12 }}>👥</div>
                            <h3 style={{ marginBottom: 8, fontSize: '1.125rem' }}>Your squad is empty</h3>
                            <p className="text-muted text-sm" style={{ marginBottom: 20 }}>Add friends by phone or discover players on SportsVault.</p>
                            <button className="btn btn-primary btn-sm" onClick={() => setActiveView('discover')}>Find Players →</button>
                        </div>
                    )}

                    {/* Friends list with tier grouping */}
                    {friendPlayers.length > 0 && (
                        <>
                            <div>
                                <p className="text-xs text-muted" style={{ marginBottom: 8 }}>Priority list for:</p>
                                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                                    {Object.keys(SPORTS).map(s => (
                                        <button key={s} onClick={() => setTierSport(s)} style={{
                                            padding: '6px 14px', borderRadius: 99, fontSize: '0.8125rem', whiteSpace: 'nowrap',
                                            border: `1px solid ${tierSport === s ? SPORTS[s].color : 'var(--border-color)'}`,
                                            background: tierSport === s ? `${SPORTS[s].color}20` : 'transparent',
                                            color: tierSport === s ? SPORTS[s].color : 'var(--text-secondary)',
                                            cursor: 'pointer', transition: 'all 0.15s', fontWeight: tierSport === s ? 600 : 400,
                                        }}>
                                            {SPORTS[s].emoji} {SPORTS[s].name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {[1, 2, 3].map(tier => groupedFriends[tier].length > 0 && (
                                <div key={tier}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: ['#6366f1', '#a855f7', '#ec4899'][tier - 1] }} />
                                        <span className="text-xs font-semibold text-muted" style={{ letterSpacing: '0.06em' }}>
                                            PRIORITY {tier} · {groupedFriends[tier].length}
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

            {/* ─── DISCOVER TAB ─── */}
            {activeView === 'discover' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem', pointerEvents: 'none' }}>🔍</span>
                        <input
                            type="text"
                            placeholder="Search by name..."
                            value={searchQuery}
                            onChange={e => handleSearch(e.target.value)}
                            style={{ width: '100%', paddingLeft: 38, fontSize: '0.9375rem' }}
                        />
                        {isSearching && (
                            <span style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>…</span>
                        )}
                    </div>

                    {!searchQuery.trim() && (
                        <p className="text-xs text-muted">Players you might know:</p>
                    )}

                    {suggestedPlayers.length === 0 && !isSearching ? (
                        <div className="glass-card no-hover text-center" style={{ padding: 32 }}>
                            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎉</div>
                            <p className="text-muted text-sm">
                                {searchQuery.trim().length >= 2 ? 'No players found for that search.' : "You've connected with everyone nearby!"}
                            </p>
                        </div>
                    ) : (
                        suggestedPlayers.map(player => {
                            const trust = getTrustTier(player.trustScore || 0);
                            const isAdding = addingId === player.id;
                            const isFriend = (state.friends || []).some(fId => String(fId) === String(player.id));
                            const isPendingSent = pendingSent.some(p => String(p.id) === String(player.id));
                            const sports = safeArray(player.sports);
                            return (
                                <div key={player.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
                                    <div
                                        className="avatar"
                                        style={{ borderColor: trust.color, cursor: 'pointer', flexShrink: 0, background: player.photo ? `url(${player.photo}) center/cover` : undefined, fontSize: player.photo ? '0' : undefined }}
                                        onClick={() => onViewProfile(player.id)}
                                    >
                                        {player.photo ? '' : getInitials(player.name)}
                                    </div>
                                    <div style={{ flex: 1, cursor: 'pointer', minWidth: 0 }} onClick={() => onViewProfile(player.id)}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</div>
                                        <div className="text-xs text-muted">
                                            {sports.slice(0, 3).map(s => SPORTS[s]?.emoji || '').join(' ')}
                                            {player.location && <> · {player.location}</>}
                                            {(player.gamesPlayed > 0) && <> · {player.gamesPlayed} games</>}
                                        </div>
                                    </div>
                                    <button
                                        className={`btn btn-sm ${isFriend ? 'btn-outline' : isPendingSent ? 'btn-ghost' : 'btn-primary'}`}
                                        style={{ flexShrink: 0, minWidth: 72, opacity: isPendingSent ? 0.7 : 1 }}
                                        disabled={isAdding || isFriend}
                                        onClick={e => { e.stopPropagation(); if (!isFriend && !isPendingSent) handleAddFriend(player.id); }}
                                    >
                                        {isAdding ? '…' : isFriend ? '✓ Friends' : isPendingSent ? '⏳ Sent' : '+ Add'}
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
