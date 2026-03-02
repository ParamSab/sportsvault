'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { PLAYERS, SPORTS, getPlayer, getInitials, getTrustTier, getPlayerGames, formatDate, getSportEmoji } from '@/lib/mockData';

export default function FriendsPage({ onViewProfile, onViewGame }) {
    const { state, dispatch } = useStore();
    const [searchPhone, setSearchPhone] = useState('');
    const [activeView, setActiveView] = useState('friends');
    const [tierSport, setTierSport] = useState('football'); // Default to a sport for tier management

    const [showNewNameInput, setShowNewNameInput] = useState(false);
    const [newName, setNewName] = useState('');

    const friendPlayers = state.friends
        .map(fId => getPlayer(fId) || state.players.find(p => p.id === fId))
        .filter(Boolean);

    const friendTiers = state.friendTiers || {};

    const suggestedPlayers = PLAYERS
        .filter(p => !state.friends.includes(p.id) && p.id !== state.currentUser?.id && p.id !== 'current')
        .slice(0, 5);

    const handleAddByPhone = async () => {
        if (searchPhone.length < 10) return;

        // 1. Search in local state first
        const found = PLAYERS.find(p => p.phone && p.phone.endsWith(searchPhone))
            || state.players.find(p => p.phone && p.phone.endsWith(searchPhone));

        if (found) {
            await fetch('/api/friends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add', friendId: found.id })
            });
            dispatch({ type: 'ADD_FRIEND', payload: found.id });
            setSearchPhone('');
            setShowNewNameInput(false);
            setNewName('');
            return;
        }

        // 2. Search DB by phone number
        if (!showNewNameInput) {
            try {
                const phone = `+91${searchPhone}`;
                const res = await fetch(`/api/users?phone=${encodeURIComponent(phone)}`);
                const data = await res.json();
                if (data.user) {
                    // Real DB user found — add friendship
                    await fetch('/api/friends', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'add', friendId: data.user.id })
                    });
                    dispatch({
                        type: 'ADD_FRIEND', payload: {
                            isNew: true,
                            id: data.user.id,
                            name: data.user.name,
                            phone: data.user.phone,
                            photo: data.user.photo || null,
                            location: data.user.location || '',
                            sports: data.user.sports || [],
                            positions: data.user.positions || {},
                            ratings: data.user.ratings || {},
                            trustScore: data.user.trustScore || 50,
                            gamesPlayed: data.user.gamesPlayed || 0,
                            wins: data.user.wins || 0,
                            losses: data.user.losses || 0,
                            draws: data.user.draws || 0,
                            privacy: data.user.privacy || 'public',
                            joined: data.user.createdAt?.split('T')[0],
                        }
                    });
                    setSearchPhone('');
                    return;
                }
            } catch (_) { /* fall through to offline prompt */ }

            // Not found — prompt for name to add as offline friend
            setShowNewNameInput(true);
            return;
        }

        // 3. Commit as offline friend with entered name
        if (newName.trim().length > 0) {
            const phone = `+91${searchPhone}`;
            const res = await fetch('/api/friends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add', phone, name: newName.trim() })
            });
            const data = await res.json();
            const friendId = data.friendship?.friendId;
            dispatch({ type: 'ADD_FRIEND', payload: { isNew: true, phone, name: newName.trim(), id: friendId } });
            setSearchPhone('');
            setShowNewNameInput(false);
            setNewName('');
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

    // Build activity feed from friends
    const friendActivities = friendPlayers.flatMap(friend => {
        const games = getPlayerGames(friend.id);
        return games.slice(0, 2).map(g => ({
            type: 'game',
            player: friend,
            game: g,
            text: g.status === 'completed' ? `played in ${g.title}` : `joined ${g.title}`,
        }));
    }).slice(0, 8);

    const renderFriendCard = (friend, showTiers = false) => {
        const trust = getTrustTier(friend.trustScore || 0);
        const currentTier = friendTiers[friend.id]?.[tierSport] || null;

        return (
            <div key={friend.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => onViewProfile(friend.id)}>
                    <div className="avatar" style={{
                        borderColor: trust.color,
                        background: friend.photo ? `url(${friend.photo}) center/cover` : undefined,
                        fontSize: friend.photo ? '0' : undefined,
                    }}>
                        {friend.photo ? '' : getInitials(friend.name)}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{friend.name}</div>
                        <div className="text-xs text-muted">
                            {friend.sports.map(s => getSportEmoji(s)).join(' ')} · {friend.location}
                        </div>
                    </div>
                </div>

                {showTiers && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 12, overflowX: 'auto', paddingBottom: 4 }}>
                        <span className="text-xs text-muted" style={{ alignSelf: 'center', marginRight: 4 }}>List:</span>
                        {[1, 2, 3].map(tier => (
                            <button
                                key={tier}
                                className={`chip ${currentTier === tier ? 'active' : ''}`}
                                style={{
                                    fontSize: '0.6875rem', padding: '4px 8px',
                                    background: currentTier === tier ? `${SPORTS[tierSport]?.color}30` : undefined,
                                    borderColor: currentTier === tier ? SPORTS[tierSport]?.color : undefined,
                                }}
                                onClick={() => handleSetTier(friend.id, currentTier === tier ? null : tier)}
                            >
                                Tier {tier}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Group friends by tier for the currently selected sport
    const groupedFriends = { 1: [], 2: [], 3: [], unassigned: [] };
    friendPlayers.forEach(f => {
        const tier = friendTiers[f.id]?.[tierSport];
        if (tier) groupedFriends[tier].push(f);
        else groupedFriends.unassigned.push(f);
    });

    return (
        <div className="animate-fade-in">
            <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', marginBottom: 4 }}>
                Friends <span style={{ color: 'var(--text-muted)' }}>& Tiers</span>
            </h1>
            <p className="text-muted text-sm" style={{ marginBottom: 20 }}>
                {friendPlayers.length} friend{friendPlayers.length !== 1 ? 's' : ''} connected
            </p>

            {/* Add Friend */}
            <div className="glass-card no-hover" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '0.9375rem', marginBottom: 8 }}>Add Friend</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{
                            padding: '12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center',
                            fontSize: '0.8125rem', color: 'var(--text-secondary)', minWidth: 44,
                        }}>+91</div>
                        <input
                            type="tel" placeholder="Phone number" value={searchPhone}
                            onChange={e => {
                                setSearchPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                                setShowNewNameInput(false); // Reset if they start typing a different number
                            }}
                            style={{ flex: 1, fontSize: '0.875rem', padding: '12px' }}
                        />
                        {!showNewNameInput && (
                            <button className="btn btn-primary btn-sm" onClick={handleAddByPhone} disabled={searchPhone.length < 10}>Next</button>
                        )}
                    </div>

                    {showNewNameInput && (
                        <div className="animate-fade-in" style={{ padding: '8px 0', borderTop: '1px dashed var(--border-color)' }}>
                            <p className="text-xs text-muted" style={{ marginBottom: 8 }}>Number not found. Add them as an offline friend?</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    type="text" placeholder="Friend's Name" value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    style={{ flex: 1, fontSize: '0.875rem', padding: '12px' }}
                                    autoFocus
                                />
                                <button className="btn btn-primary btn-sm" onClick={handleAddByPhone} disabled={newName.trim().length === 0}>
                                    Save
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="tab-bar" style={{ marginBottom: 16 }}>
                <button className={`tab-item ${activeView === 'friends' ? 'active' : ''}`} onClick={() => setActiveView('friends')}>
                    👥 Priority Lists
                </button>
                <button className={`tab-item ${activeView === 'feed' ? 'active' : ''}`} onClick={() => setActiveView('feed')}>
                    📰 Feed
                </button>
                <button className={`tab-item ${activeView === 'discover' ? 'active' : ''}`} onClick={() => setActiveView('discover')}>
                    🔍 Discover
                </button>
            </div>

            {/* Priority Lists / Friends */}
            {activeView === 'friends' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Sport Selector */}
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                        {Object.keys(SPORTS).map(s => (
                            <button
                                key={s}
                                className={`chip ${tierSport === s ? 'active' : ''}`}
                                onClick={() => setTierSport(s)}
                                style={{
                                    background: tierSport === s ? `${SPORTS[s].color}20` : undefined,
                                    borderColor: tierSport === s ? SPORTS[s].color : undefined,
                                }}
                            >
                                {SPORTS[s].emoji} {SPORTS[s].name}
                            </button>
                        ))}
                    </div>

                    {friendPlayers.length === 0 && (
                        <div className="glass-card no-hover text-center" style={{ padding: 32 }}>
                            <div style={{ fontSize: '2rem', marginBottom: 8 }}>👥</div>
                            <p className="text-muted text-sm">No friends yet. Add someone by phone number!</p>
                        </div>
                    )}

                    {friendPlayers.length > 0 && (
                        <>
                            {[1, 2, 3].map(tier => groupedFriends[tier].length > 0 && (
                                <div key={tier}>
                                    <div className="text-xs font-semibold text-muted" style={{ marginBottom: 8 }}>
                                        🎯 TIER {tier} PRIORITIES
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {groupedFriends[tier].map(f => renderFriendCard(f, true))}
                                    </div>
                                </div>
                            ))}

                            {groupedFriends.unassigned.length > 0 && (
                                <div>
                                    <div className="text-xs font-semibold text-muted" style={{ marginBottom: 8 }}>
                                        UNASSIGNED FRIENDS
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {groupedFriends.unassigned.map(f => renderFriendCard(f, true))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Activity Feed */}
            {activeView === 'feed' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {friendActivities.length === 0 && (
                        <div className="glass-card no-hover text-center" style={{ padding: 32 }}>
                            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📰</div>
                            <p className="text-muted text-sm">Add friends to see their activity here!</p>
                        </div>
                    )}
                    {friendActivities.map((act, i) => (
                        <div key={i} className="glass-card" style={{ padding: 14, cursor: 'pointer' }} onClick={() => onViewGame(act.game.id)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div className="avatar avatar-sm" style={{
                                    borderColor: SPORTS[act.game.sport]?.color,
                                    background: act.player.photo ? `url(${act.player.photo}) center/cover` : undefined,
                                    fontSize: act.player.photo ? '0' : undefined,
                                }}>
                                    {act.player.photo ? '' : getInitials(act.player.name)}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.875rem' }}>
                                        <span style={{ fontWeight: 600 }}>{act.player.name.split(' ')[0]}</span>
                                        <span className="text-muted"> {act.text}</span>
                                    </div>
                                    <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                                        {getSportEmoji(act.game.sport)} {formatDate(act.game.date)} at {act.game.time}
                                    </div>
                                </div>
                                <span className={`sport-badge ${act.game.sport}`} style={{ fontSize: '0.625rem', padding: '2px 8px' }}>
                                    {SPORTS[act.game.sport]?.name}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Discover People */}
            {activeView === 'discover' && (
                <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {suggestedPlayers.map(player => {
                        const trust = getTrustTier(player.trustScore || 0);
                        const isFriend = state.friends.includes(player.id);
                        return (
                            <div key={player.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
                                <div className="avatar" style={{
                                    borderColor: trust.color, cursor: 'pointer',
                                    background: player.photo ? `url(${player.photo}) center/cover` : undefined,
                                    fontSize: player.photo ? '0' : undefined,
                                }} onClick={() => onViewProfile(player.id)}>
                                    {player.photo ? '' : getInitials(player.name)}
                                </div>
                                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onViewProfile(player.id)}>
                                    <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{player.name}</div>
                                    <div className="text-xs text-muted">
                                        {player.sports.map(s => getSportEmoji(s)).join(' ')} · {player.gamesPlayed} games
                                    </div>
                                </div>
                                <button
                                    className={`btn btn-sm ${isFriend ? 'btn-outline' : 'btn-primary'}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isFriend) dispatch({ type: 'REMOVE_FRIEND', payload: player.id });
                                        else dispatch({ type: 'ADD_FRIEND', payload: player.id });
                                    }}
                                >
                                    {isFriend ? '✓' : '+ Add'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
