'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { PLAYERS, SPORTS, getPlayer, getInitials, getTrustTier, formatDate, getSportEmoji } from '@/lib/mockData';

function safeArray(val) {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') { try { const p = JSON.parse(val); return Array.isArray(p) ? p : (p ? [p] : []); } catch { return []; } }
    return [];
}

export default function FriendsPage({ onViewProfile, onViewGame }) {
    const { state, dispatch } = useStore();
    const [searchPhone, setSearchPhone] = useState('');
    const [activeView, setActiveView] = useState('friends');
    const [tierSport, setTierSport] = useState('football');
    const [showNewNameInput, setShowNewNameInput] = useState(false);
    const [newName, setNewName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [addingId, setAddingId] = useState(null);

    const friendIdSet = new Set((state.friends || []).map(String));
    const currentUserId = String(state.currentUser?.id || state.currentUser?.dbId || '');

    const friendPlayers = (state.friends || [])
        .map(fId => getPlayer(fId) || (state.players || []).find(p => p && String(p.id) === String(fId)))
        .filter(Boolean);

    const friendTiers = state.friendTiers || {};
    const pendingReceived = (state.pendingFriends || []).filter(f => !f.isSender) || [];

    // Friends' upcoming games from state
    const friendGames = (state.games || []).filter(g =>
        g.status === 'open' &&
        (g.rsvps || []).some(r => r.status === 'yes' && friendIdSet.has(String(r.playerId)))
    );

    const suggestedPlayers = (state.players || [])
        .filter(p => p && !friendIdSet.has(String(p.id)) && String(p.id) !== currentUserId)
        .slice(0, 10);

    const handleSearch = async (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        if (query.length < 3) { setSearchResults([]); return; }
        setIsSearching(true);
        try {
            const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
            if (res.ok) { const data = await res.json(); setSearchResults(data.users || []); }
        } catch (err) { console.error('Search error', err); }
        finally { setIsSearching(false); }
    };

    const handleFriendAction = async (friendId, action) => {
        setAddingId(friendId);
        try {
            await fetch('/api/friends/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ friendId, action }) });
            const fRes = await fetch('/api/friends');
            if (fRes.ok) {
                const fData = await fRes.json();
                const tiers = {};
                fData.tiers?.forEach(t => { if (!tiers[t.friendId]) tiers[t.friendId] = {}; tiers[t.friendId][t.sport] = t.tier; });
                dispatch({ type: 'LOAD_STATE', payload: { friends: (fData.friends || []).map(f => f.id || f), pendingFriends: fData.pendingRequests || [], players: [...(fData.friends || []), ...(fData.pendingRequests || []), ...PLAYERS], friendTiers: tiers } });
            }
        } catch (err) { console.error('Friend action failed', err); }
        finally { setAddingId(null); }
    };

    const handleAddByPhone = async () => {
        if (searchPhone.length < 10) return;
        const found = PLAYERS.find(p => p.phone && p.phone.endsWith(searchPhone)) || (state.players || []).find(p => p.phone && p.phone.endsWith(searchPhone));
        if (found) {
            await fetch('/api/friends', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', friendId: found.id }) });
            dispatch({ type: 'ADD_FRIEND', payload: found.id });
            setSearchPhone(''); setShowNewNameInput(false); setNewName('');
        } else if (!showNewNameInput) {
            setShowNewNameInput(true);
        } else if (newName.trim().length > 0) {
            const phone = `+91${searchPhone}`;
            const res = await fetch('/api/friends', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', phone, name: newName.trim() }) });
            const data = await res.json();
            dispatch({ type: 'ADD_FRIEND', payload: { isNew: true, phone, name: newName.trim(), id: data.friendship?.friendId } });
            setSearchPhone(''); setShowNewNameInput(false); setNewName('');
        }
    };

    const handleSetTier = async (friendId, tier) => {
        await fetch('/api/friends/tier', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ friendId, sport: tierSport, tier }) });
        dispatch({ type: 'SET_FRIEND_TIER', payload: { friendId, sport: tierSport, tier } });
    };

    const renderFriendCard = (friend, showTiers = false) => {
        const trust = getTrustTier(friend.trustScore || 0);
        const currentTier = friendTiers[friend.id]?.[tierSport] || null;
        const sports = safeArray(friend.sports);
        return (
            <div key={friend.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => onViewProfile(friend.id)}>
                    <div className="avatar" style={{ borderColor: trust.color, background: friend.photo ? `url(${friend.photo}) center/cover` : undefined, fontSize: friend.photo ? '0' : undefined }}>{friend.photo ? '' : getInitials(friend.name)}</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{friend.name || 'Unknown'}</div>
                        <div className="text-xs text-muted">{sports.map(s => getSportEmoji(s)).join(' ')} · {friend.location || 'Unknown'}</div>
                    </div>
                </div>
                {showTiers && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 12, overflowX: 'auto', paddingBottom: 4 }}>
                        <span className="text-xs text-muted" style={{ alignSelf: 'center', marginRight: 4 }}>List:</span>
                        {[1, 2, 3].map(tier => (
                            <button key={tier} className={`chip ${currentTier === tier ? 'active' : ''}`}
                                style={{ fontSize: '0.6875rem', padding: '4px 8px', background: currentTier === tier ? `${SPORTS[tierSport]?.color}30` : undefined, borderColor: currentTier === tier ? SPORTS[tierSport]?.color : undefined }}
                                onClick={() => handleSetTier(friend.id, currentTier === tier ? null : tier)}>Tier {tier}</button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const groupedFriends = { 1: [], 2: [], 3: [], unassigned: [] };
    friendPlayers.forEach(f => { const tier = friendTiers[f.id]?.[tierSport]; if (tier) groupedFriends[tier].push(f); else groupedFriends.unassigned.push(f); });

    return (
        <div className="animate-fade-in">
            <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', marginBottom: 4 }}>Friends <span style={{ color: 'var(--text-muted)' }}>& Tiers</span></h1>
            <p className="text-muted text-sm" style={{ marginBottom: 20 }}>{friendPlayers.length} friend{friendPlayers.length !== 1 ? 's' : ''} connected</p>

            {/* Add Friend by Phone */}
            <div className="glass-card no-hover" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '0.9375rem', marginBottom: 8 }}>Add Friend</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-secondary)', minWidth: 44 }}>+91</div>
                        <input type="tel" placeholder="Phone number" value={searchPhone} onChange={e => { setSearchPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setShowNewNameInput(false); }} style={{ flex: 1, fontSize: '0.875rem', padding: '12px' }} />
                        {!showNewNameInput && <button className="btn btn-primary btn-sm" onClick={handleAddByPhone} disabled={searchPhone.length < 10}>Next</button>}
                    </div>
                    {showNewNameInput && (
                        <div className="animate-fade-in" style={{ padding: '8px 0', borderTop: '1px dashed var(--border-color)' }}>
                            <p className="text-xs text-muted" style={{ marginBottom: 8 }}>Number not found. Add them as an offline friend?</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input type="text" placeholder="Friend's Name" value={newName} onChange={e => setNewName(e.target.value)} style={{ flex: 1, fontSize: '0.875rem', padding: '12px' }} autoFocus />
                                <button className="btn btn-primary btn-sm" onClick={handleAddByPhone} disabled={newName.trim().length === 0}>Save</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="tab-bar" style={{ marginBottom: 16 }}>
                <button className={`tab-item ${activeView === 'friends' ? 'active' : ''}`} onClick={() => setActiveView('friends')}>👥 Priority Lists</button>
                <button className={`tab-item ${activeView === 'feed' ? 'active' : ''}`} onClick={() => setActiveView('feed')}>🎮 Their Games</button>
                <button className={`tab-item ${activeView === 'discover' ? 'active' : ''}`} onClick={() => setActiveView('discover')}>🔍 Discover</button>
            </div>

            {/* Priority Lists */}
            {activeView === 'friends' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                        {Object.keys(SPORTS).map(s => (
                            <button key={s} className={`chip ${tierSport === s ? 'active' : ''}`} onClick={() => setTierSport(s)} style={{ background: tierSport === s ? `${SPORTS[s].color}20` : undefined, borderColor: tierSport === s ? SPORTS[s].color : undefined }}>{SPORTS[s].emoji} {SPORTS[s].name}</button>
                        ))}
                    </div>
                    {friendPlayers.length === 0 ? (
                        <div className="glass-card no-hover text-center" style={{ padding: 32 }}><div style={{ fontSize: '2rem', marginBottom: 8 }}>👥</div><p className="text-muted text-sm">No friends yet. Add someone by phone number above!</p></div>
                    ) : (
                        <>
                            {[1, 2, 3].map(tier => groupedFriends[tier].length > 0 && (
                                <div key={tier}>
                                    <div className="text-xs font-semibold text-muted" style={{ marginBottom: 8 }}>🎯 TIER {tier} PRIORITIES</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{groupedFriends[tier].map(f => renderFriendCard(f, true))}</div>
                                </div>
                            ))}
                            {groupedFriends.unassigned.length > 0 && (
                                <div>
                                    <div className="text-xs font-semibold text-muted" style={{ marginBottom: 8 }}>UNASSIGNED FRIENDS</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{groupedFriends.unassigned.map(f => renderFriendCard(f, true))}</div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Friends' Upcoming Games */}
            {activeView === 'feed' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {friendGames.length === 0 ? (
                        <div className="glass-card no-hover text-center" style={{ padding: 32 }}>
                            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎮</div>
                            <p className="text-muted text-sm">{friendPlayers.length === 0 ? 'Add friends to see their upcoming games here!' : 'None of your friends have upcoming games right now.'}</p>
                        </div>
                    ) : friendGames.map(game => {
                        const sport = SPORTS[game.sport];
                        const friendsIn = (game.rsvps || [])
                            .filter(r => r.status === 'yes' && friendIdSet.has(String(r.playerId)))
                            .map(r => friendPlayers.find(f => String(f.id) === String(r.playerId))?.name)
                            .filter(Boolean);
                        return (
                            <div key={game.id} className="glass-card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }} onClick={() => onViewGame(game.id)}>
                                <div style={{ height: 8, background: sport?.gradient || '#6366f1' }} />
                                <div style={{ padding: '14px 16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{sport?.emoji} {game.title}</div>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${sport?.color}20`, color: sport?.color, border: `1px solid ${sport?.color}40` }}>{game.format}</span>
                                    </div>
                                    <div className="text-xs text-muted" style={{ marginBottom: 6 }}>📍 {game.location} · 📅 {game.date} {game.time}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>👥</span>
                                        <span style={{ fontSize: '0.75rem', color: sport?.color, fontWeight: 600 }}>{friendsIn.join(', ')} {friendsIn.length === 1 ? 'is' : 'are'} playing</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Discover People */}
            {activeView === 'discover' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {pendingReceived.length > 0 && (
                        <div className="glass-card no-hover" style={{ border: '1px solid var(--primary-color)', padding: 16 }}>
                            <div style={{ fontSize: '0.9375rem', marginBottom: 12, fontWeight: 700, color: 'var(--primary-color)' }}>New Friend Requests</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {pendingReceived.map(player => (
                                    <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div className="avatar" style={{ background: player.photo ? `url(${player.photo}) center/cover` : undefined, fontSize: player.photo ? '0' : undefined }} onClick={() => onViewProfile(player.id)}>{player.photo ? '' : getInitials(player.name || 'Unknown')}</div>
                                        <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{player.name}</div><div className="text-xs text-muted">Wants to connect</div></div>
                                        <button className="btn btn-sm btn-ghost" style={{ padding: '6px 12px', border: '1px solid var(--border-color)', color: 'var(--danger)' }} onClick={() => handleFriendAction(player.id, 'reject')}>Ignore</button>
                                        <button className="btn btn-sm btn-primary" style={{ padding: '6px 16px' }} onClick={() => handleFriendAction(player.id, 'accept')}>Accept</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ position: 'relative' }}>
                        <input type="text" className="input" placeholder="Find players by name or phone..." value={searchQuery} onChange={handleSearch} style={{ paddingLeft: 36, width: '100%', fontSize: '0.9375rem' }} />
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: '1rem' }}>🔍</span>
                    </div>
                    {isSearching && <div className="text-center text-sm text-muted">Searching...</div>}
                    {searchQuery.length >= 3 && !isSearching && searchResults.length === 0 && <div className="text-center text-sm text-muted" style={{ padding: 20 }}>No users found for "{searchQuery}".</div>}

                    <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(searchQuery.length >= 3 ? searchResults : suggestedPlayers).map(player => {
                            if (!player) return null;
                            const playerId = String(player.id || '');
                            const trust = getTrustTier(player.trustScore || 0);
                            const isFriend = friendIdSet.has(playerId);
                            const isPendingSent = (state.pendingFriends || []).some(f => String(f.id) === playerId && f.isSender);
                            const isPendingReceived = (state.pendingFriends || []).some(f => String(f.id) === playerId && !f.isSender);
                            const sports = safeArray(player.sports);
                            return (
                                <div key={player.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
                                    <div className="avatar" style={{ borderColor: trust.color, cursor: 'pointer', background: player.photo ? `url(${player.photo}) center/cover` : undefined, fontSize: player.photo ? '0' : undefined }} onClick={() => onViewProfile(player.id)}>{player.photo ? '' : getInitials(player.name)}</div>
                                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onViewProfile(player.id)}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{player.name || 'Unknown Player'}</div>
                                        <div className="text-xs text-muted">{sports.map(s => getSportEmoji(s)).join(' ')}{(player.gamesPlayed || 0) > 0 && ` · ${player.gamesPlayed} games`}</div>
                                    </div>
                                    {isFriend ? (
                                        <button className="btn btn-sm btn-ghost" style={{ color: 'var(--primary-color)', border: '1px solid var(--primary-color)' }} disabled>✓ Friends</button>
                                    ) : isPendingSent ? (
                                        <button className="btn btn-sm btn-outline" onClick={() => handleFriendAction(player.id, 'cancel')}>Requested</button>
                                    ) : isPendingReceived ? (
                                        <button className="btn btn-sm btn-primary" onClick={() => handleFriendAction(player.id, 'accept')}>Accept</button>
                                    ) : (
                                        <button className="btn btn-sm btn-primary" disabled={addingId === player.id} onClick={() => handleFriendAction(player.id, 'send')}>{addingId === player.id ? '…' : '+ Add'}</button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
