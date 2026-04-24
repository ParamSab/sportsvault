'use client';
import { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { SPORTS, getPlayer, getSportEmoji, spotsLeft, formatDate, getInitials, PLAYERS } from '@/lib/mockData';
import dynamic from 'next/dynamic';

// Mock distance calc from user lat/lng
function calcDistKm(userLat, userLng, gameLat, gameLng) {
    if (!userLat || !userLng || !gameLat || !gameLng) return null;
    const R = 6371;
    const dLat = ((gameLat - userLat) * Math.PI) / 180;
    const dLng = ((gameLng - userLng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((userLat * Math.PI) / 180) * Math.cos((gameLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`;
}

export default function DiscoverPage({ onViewGame, onViewProfile }) {
    const { state, dispatch } = useStore();
    const [sportFilter, setSportFilter] = useState('all');
    const [viewMode, setViewMode] = useState('list');
    const [skillFilter, setSkillFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('');
    const [showFriendsOnly, setShowFriendsOnly] = useState(false);
    const [friendActionLoading, setFriendActionLoading] = useState(null);
    const [welcomeDismissed, setWelcomeDismissed] = useState(false);

    const Map = useMemo(() => dynamic(() => import('./MapPicker').then(mod => {
        return function SimpleMap({ games, onViewGame, center }) {
            const mapSrc = `https://maps.google.com/maps?q=${center.lat},${center.lng}&z=13&output=embed`;
            return (<div style={{ position: 'relative', height: '100%', width: '100%' }}><iframe src={mapSrc} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" /></div>);
        };
    }), { ssr: false }), []);

    const friendIdSet = useMemo(() => new Set((state.friends || []).map(String)), [state.friends]);

    const upcomingGames = useMemo(() => {
        const currentUserId = String(state.currentUser?.dbId || state.currentUser?.id || 'current');
        return (state.games || [])
            .filter(g => g.status === 'open')
            .filter(g => {
                const vis = g.visibility || 'public';
                const orgId = String(g.organizerId || g.organizer?.id || g.organizer || '');
                if (vis === 'private') return false;
                if (vis === 'public') return true;
                if (vis === 'friends') return friendIdSet.has(orgId) || orgId === currentUserId;
                return false;
            })
            .filter(g => sportFilter === 'all' || g.sport === sportFilter)
            .filter(g => skillFilter === 'all' || g.skillLevel === skillFilter)
            .filter(g => !dateFilter || g.date === dateFilter)
            .filter(g => {
                if (!showFriendsOnly) return true;
                return (g.rsvps || []).some(r => r.status === 'yes' && friendIdSet.has(String(r.playerId)));
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [state.games, sportFilter, skillFilter, dateFilter, state.friends, state.currentUser, showFriendsOnly, friendIdSet]);

    const currentUserId = state.currentUser?.dbId || state.currentUser?.id;
    const isNewUser = state.isAuthenticated && (state.currentUser?.gamesPlayed === 0 || !state.currentUser?.gamesPlayed);

    // Stat bar metrics
    const friendsPlayingToday = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return upcomingGames.filter(g => g.date === today && (g.rsvps || []).some(r => r.status === 'yes' && friendIdSet.has(String(r.playerId)))).length;
    }, [upcomingGames, friendIdSet]);

    const friendSuggestions = useMemo(() => {
        const knownIds = new Set([...(state.friends || []).map(String), String(currentUserId || '')]);
        // Only suggest real DB users (exclude IDs starting with 'p' which are mock players)
        const apiPlayers = (state.players || []).filter(p => p?.id && !String(p.id).startsWith('p') && !knownIds.has(String(p.id)));
        return apiPlayers.filter((p, i, a) => a.findIndex(x => x.id === p.id) === i).slice(0, 5);
    }, [state.players, state.friends, currentUserId]);

    const pastTeammates = useMemo(() => {
        const knownIds = new Set([...(state.friends || []).map(String), String(currentUserId || '')]);
        const teammates = new Set();
        (state.history || []).forEach(g => { 
            (g.rsvps || []).forEach(r => { 
                const rid = String(r.playerId);
                if (!knownIds.has(rid) && !rid.startsWith('p')) teammates.add(r.playerId); 
            }); 
        });
        return Array.from(teammates).map(id => getPlayer(id) || (state.players || []).find(p => p?.id === id)).filter(Boolean).slice(0, 5);
    }, [state.history, state.players, state.friends, currentUserId]);

    const handleFriendRequest = async (friendId) => {
        setFriendActionLoading(friendId);
        try {
            await fetch('/api/friends/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ friendId, action: 'send' }) });
            const fRes = await fetch('/api/friends');
            if (fRes.ok) {
                const fData = await fRes.json();
                const tiers = {};
                fData.tiers?.forEach(t => { if (!tiers[t.friendId]) tiers[t.friendId] = {}; tiers[t.friendId][t.sport] = t.tier; });
                dispatch({ type: 'LOAD_STATE', payload: { friends: (fData.friends || []).map(f => f.id || f), pendingFriends: fData.pendingRequests || [], friendTiers: tiers } });
            }
        } catch (err) { console.error('Friend request failed', err); }
        finally { setFriendActionLoading(null); }
    };

    const userLat = state.currentUser?.lat || 19.076;
    const userLng = state.currentUser?.lng || 72.877;

    return (
        <div className="animate-fade-in">
            {/* Welcome banner for new users */}
            {isNewUser && !welcomeDismissed && (
                <div className="welcome-banner">
                    <button className="welcome-banner-dismiss" onClick={() => setWelcomeDismissed(true)} aria-label="Dismiss">✕</button>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                        <div style={{ fontSize: '2rem', flexShrink: 0 }}>👋</div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1.0625rem', marginBottom: 4 }}>Welcome to SportsVault!</div>
                            <div className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                New in town or looking for your next game? Scroll below to find games near you and join a community of players.
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 99, background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>🔍 Find Games</span>
                                <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 99, background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>✅ RSVP Instantly</span>
                                <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 99, background: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}>⭐ Build Your Rep</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hero stat bar */}
            <div className="stat-bar">
                <div className="stat-item">
                    <span style={{ fontSize: '1.1rem' }}>🏟️</span>
                    <div>
                        <div className="stat-value">{upcomingGames.length}</div>
                        <div className="stat-label">Games near you</div>
                    </div>
                </div>
                <div className="stat-divider" />
                {state.isAuthenticated && (
                    <>
                        <div className="stat-item">
                            <span style={{ fontSize: '1.1rem' }}>👥</span>
                            <div>
                                <div className="stat-value">{friendsPlayingToday}</div>
                                <div className="stat-label">Friends today</div>
                            </div>
                        </div>
                        <div className="stat-divider" />
                    </>
                )}
                <div className="stat-item">
                    <span style={{ fontSize: '1.1rem' }}>⚡</span>
                    <div>
                        <div className="stat-value">{upcomingGames.filter(g => spotsLeft(g) <= 3).length}</div>
                        <div className="stat-label">Filling fast</div>
                    </div>
                </div>
                <div className="stat-divider" />
                <div className="stat-item">
                    <span style={{ fontSize: '1.1rem' }}>📍</span>
                    <div>
                        <div className="stat-value" style={{ fontSize: '0.875rem' }}>{state.currentUser?.location || 'Mumbai'}</div>
                        <div className="stat-label">Your area</div>
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', marginBottom: 4 }}>Find Your <span className="text-gradient-football">Game</span></h1>
                <p className="text-muted text-sm">{upcomingGames.length} game{upcomingGames.length !== 1 ? 's' : ''} {showFriendsOnly ? 'with friends' : 'near you'}</p>
            </div>

            {/* Sport filter chips */}
            <div className="filter-bar" style={{ marginBottom: 12 }}>
                <button className={`chip ${sportFilter === 'all' ? 'active all' : ''}`} onClick={() => setSportFilter('all')}>🏅 All Sports</button>
                {Object.entries(SPORTS).map(([key, sport]) => (
                    <button key={key} className={`chip ${sportFilter === key ? `active ${key}` : ''}`} onClick={() => setSportFilter(key)}>{sport.emoji} {sport.name}</button>
                ))}
            </div>

            {/* Friends filter toggle */}
            {state.isAuthenticated && friendIdSet.size > 0 && (
                <div style={{ marginBottom: 12 }}>
                    <button className={`chip ${showFriendsOnly ? 'active' : ''}`} onClick={() => setShowFriendsOnly(v => !v)}
                        style={{ background: showFriendsOnly ? 'rgba(99,102,241,0.2)' : undefined, borderColor: showFriendsOnly ? '#6366f1' : undefined, color: showFriendsOnly ? '#818cf8' : undefined, fontWeight: showFriendsOnly ? 700 : undefined }}>
                        👥 Friends' Games {showFriendsOnly ? '✓' : ''}
                    </button>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div className="tab-bar" style={{ width: 'auto' }}>
                    <button className={`tab-item ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>📋 List</button>
                    <button className={`tab-item ${viewMode === 'map' ? 'active' : ''}`} onClick={() => setViewMode('map')}>🗺️ Map</button>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.8125rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)', color: dateFilter ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                    <select value={skillFilter} onChange={e => setSkillFilter(e.target.value)} style={{ padding: '8px 12px', fontSize: '0.8125rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)', width: 'auto' }}>
                        <option value="all">All Levels</option>
                        <option value="Beginner-Friendly">Beginner</option>
                        <option value="Intermediate">Intermediate</option>
                        <option value="Advanced">Advanced</option>
                    </select>
                </div>
            </div>

            {viewMode === 'map' && (
                <div style={{ height: 350, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-color)', marginBottom: 16, position: 'relative', background: 'var(--bg-card)' }}>
                    <iframe src={`https://maps.google.com/maps?q=${userLat},${userLng}&z=12&output=embed`} width="100%" height="100%" style={{ border: 0, filter: 'grayscale(0.2) invert(0.9) hue-rotate(180deg) brightness(0.8)' }} allowFullScreen loading="lazy" />
                    <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, background: 'rgba(10,14,26,0.85)', borderRadius: 'var(--radius-md)', padding: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', zIndex: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>📍 Showing {upcomingGames.length} games near {state.currentUser?.location || 'Mumbai'}</span>
                            <button className="btn btn-xs btn-ghost" onClick={() => { if (navigator.geolocation) navigator.geolocation.getCurrentPosition(pos => dispatch({ type: 'UPDATE_PROFILE', payload: { lat: pos.coords.latitude, lng: pos.coords.longitude } })); }}>Recenter 🎯</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Game Cards */}
            <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {upcomingGames.length === 0 && !state.isLoaded && (
                    <>
                        {[1,2,3].map(i => (
                            <div key={i} className="skeleton-card">
                                <div className="skeleton-banner" />
                                <div className="skeleton-body">
                                    <div className="skeleton-line" style={{ width: '70%', height: 18 }} />
                                    <div className="skeleton-line" style={{ width: '90%' }} />
                                    <div className="skeleton-line" style={{ width: '60%' }} />
                                    <div className="skeleton-line" style={{ width: '80%' }} />
                                </div>
                            </div>
                        ))}
                    </>
                )}
                {upcomingGames.length === 0 && state.isLoaded && (
                    <div className="glass-card no-hover" style={{ textAlign: 'center', padding: 48 }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🏟️</div>
                        <h3 style={{ marginBottom: 8 }}>No games found</h3>
                        <p className="text-muted text-sm">Try adjusting your filters or create a new game!</p>
                    </div>
                )}
                {upcomingGames.map(game => {
                    const spots = spotsLeft(game);
                    const sportColor = SPORTS[game.sport]?.color || '#6366f1';
                    const sportGradient = SPORTS[game.sport]?.gradient || 'linear-gradient(135deg, #6366f1, #4f46e5)';
                    const organizer = getPlayer(game.organizerId || game.organizer?.id) || game.organizer;
                    const distance = calcDistKm(userLat, userLng, game.lat, game.lng);
                    const confirmedPlayers = (game.rsvps || []).filter(r => r.status === 'yes' || r.status === 'checked_in');
                    const isFilling = spots > 0 && spots <= 3;
                    const isFull = spots <= 0;

                    return (
                        <button key={game.id} className="glass-card" onClick={() => onViewGame(game.id)}
                            style={{ textAlign: 'left', cursor: 'pointer', padding: 0, overflow: 'hidden', border: `1px solid ${isFilling ? 'rgba(239,68,68,0.25)' : 'var(--border-color)'}` }}>

                            {/* Venue banner header with pitch-line pattern */}
                            <div className="card-venue-banner" style={{ height: 72, background: sportGradient, position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <span style={{ fontSize: '4rem', opacity: 0.12, position: 'absolute', right: 8, bottom: -16, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>{SPORTS[game.sport]?.emoji || '🏅'}</span>
                                <div style={{ position: 'absolute', top: 10, left: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span className={`sport-badge ${game.sport}`} style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', padding: '3px 10px', fontSize: '0.68rem' }}>{game.format}</span>
                                    {game.visibility && game.visibility !== 'public' && (
                                        <span style={{ background: 'rgba(0,0,0,0.4)', color: '#fff', backdropFilter: 'blur(4px)', padding: '2px 8px', borderRadius: 99, fontSize: '0.63rem', fontWeight: 700 }}>
                                            {game.visibility === 'friends' ? '👥 Friends' : '🔒 Private'}
                                        </span>
                                    )}
                                    {game.needsHost && (
                                        <span className="badge-host" style={{ backdropFilter: 'blur(4px)', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(234,179,8,0.4)' }}>🏆 Host Needed</span>
                                    )}
                                </div>
                                <div style={{ position: 'absolute', bottom: 10, right: 14, display: 'flex', gap: 6, alignItems: 'center' }}>
                                    {isFilling && <span className="badge-urgent">⚡ Filling Fast</span>}
                                    {isFull && <span style={{ fontSize: '0.63rem', fontWeight: 800, padding: '3px 9px', borderRadius: 99, background: 'rgba(0,0,0,0.5)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)' }}>FULL</span>}
                                </div>
                            </div>

                            {/* Card body */}
                            <div style={{ padding: '16px 18px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, lineHeight: 1.3, margin: 0, flex: 1, paddingRight: 8 }}>{game.title}</h3>
                                    <div style={{
                                        background: spots <= 0 ? 'rgba(100,100,100,0.15)' : spots <= 3 ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                                        color: spots <= 0 ? '#64748b' : spots <= 3 ? '#ef4444' : '#22c55e',
                                        padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.68rem', fontWeight: 800,
                                        whiteSpace: 'nowrap', flexShrink: 0,
                                        border: `1px solid ${spots <= 0 ? 'rgba(100,100,100,0.2)' : spots <= 3 ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                                    }}>
                                        {spots} SPOT{spots !== 1 ? 'S' : ''} LEFT
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                                    <div className="text-sm text-muted" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                        <span style={{ fontSize: '1rem' }}>📍</span>
                                        <span style={{ fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{game.location}</span>
                                        {distance && <span className="distance-chip">📏 {distance}</span>}
                                    </div>
                                    <div className="text-sm text-muted" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                        <span style={{ fontSize: '1rem' }}>📅</span>
                                        <span>{formatDate(game.date)} <span style={{ opacity: 0.5 }}>•</span> {game.time}</span>
                                        {game.price > 0 && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 700, color: '#22c55e' }}>₹{game.price}/player</span>}
                                    </div>
                                    <div className="text-sm text-muted" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                        <span style={{ fontSize: '1rem' }}>⭐</span>
                                        <span>{game.skillLevel || 'All Levels'}</span>
                                        {game.surface && <span style={{ marginLeft: 8, fontSize: '0.7rem', padding: '2px 7px', borderRadius: 99, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>🌱 {game.surface}</span>}
                                    </div>
                                </div>

                                {/* Footer: organizer + avatar stack + open button */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 14 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        {/* Organizer avatar */}
                                        <div className="avatar avatar-sm" style={{
                                            borderColor: sportColor,
                                            background: organizer?.photo ? `url(${organizer.photo}) center/cover` : undefined,
                                            fontSize: organizer?.photo ? '0' : undefined,
                                        }}>
                                            {organizer?.photo ? '' : getInitials(organizer?.name || 'O')}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>By</div>
                                            <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{organizer?.name?.split(' ')[0] || 'Unknown'}</div>
                                        </div>

                                        {/* Avatar stack of confirmed players */}
                                        {confirmedPlayers.length > 0 && (
                                            <div className="avatar-stack" style={{ marginLeft: 6 }}>
                                                {confirmedPlayers.slice(0, 3).map((r, i) => {
                                                    const p = getPlayer(r.playerId) || r.player;
                                                    if (!p) return null;
                                                    return (
                                                        <div key={r.playerId || i} className="avatar" style={{
                                                            width: 26, height: 26, fontSize: '0.55rem',
                                                            background: p.photo ? `url(${p.photo}) center/cover` : `${sportColor}30`,
                                                            color: sportColor, borderColor: 'var(--bg-card)',
                                                        }}>
                                                            {p.photo ? '' : getInitials(p.name || '?')}
                                                        </div>
                                                    );
                                                })}
                                                {confirmedPlayers.length > 3 && (
                                                    <div className="avatar-stack-count" style={{ width: 26, height: 26, fontSize: '0.55rem' }}>
                                                        +{confirmedPlayers.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <button className="btn btn-sm" style={{
                                        background: `${sportColor}20`, color: sportColor,
                                        border: `1px solid ${sportColor}50`, padding: '6px 16px',
                                        borderRadius: 'var(--radius-full)', fontWeight: 600, fontSize: '0.8125rem',
                                    }}>
                                        Open →
                                    </button>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* People You May Know */}
            {friendSuggestions.length > 0 && state.isAuthenticated && (
                <div style={{ marginTop: 32 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                        <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap', padding: '0 8px' }}>👥 People You May Know</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {friendSuggestions.map(player => {
                            const isFriend = friendIdSet.has(String(player.id));
                            const isPending = (state.pendingFriends || []).some(f => String(f.id) === String(player.id));
                            const isLoading = friendActionLoading === player.id;
                            return (
                                <div key={player.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
                                    <div className="avatar avatar-sm" style={{ background: player.photo ? `url(${player.photo}) center/cover` : 'var(--bg-input)', fontSize: '0.9rem', cursor: 'pointer', flexShrink: 0 }} onClick={() => onViewProfile && onViewProfile(player.id)}>{player.photo ? '' : getInitials(player.name || '?')}</div>
                                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onViewProfile && onViewProfile(player.id)}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{player.name}</div>
                                        <div className="text-xs text-muted">{(Array.isArray(player.sports) ? player.sports : []).map(s => getSportEmoji(s)).join(' ')}{player.gamesPlayed > 0 && ` · ${player.gamesPlayed} games`}</div>
                                    </div>
                                    {isFriend ? <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>✓ Friends</span> : isPending ? <button className="btn btn-sm btn-outline" disabled style={{ fontSize: '0.8rem' }}>Requested</button> : <button className="btn btn-sm btn-primary" style={{ fontSize: '0.8rem', padding: '6px 14px' }} disabled={isLoading} onClick={() => handleFriendRequest(player.id)}>{isLoading ? '…' : '+ Add'}</button>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Played With */}
            {pastTeammates.length > 0 && state.isAuthenticated && (
                <div style={{ marginTop: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                        <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap', padding: '0 8px' }}>🏏 Played With</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {pastTeammates.map(player => {
                            const isFriend = friendIdSet.has(String(player.id));
                            const isPending = (state.pendingFriends || []).some(f => String(f.id) === String(player.id));
                            const isLoading = friendActionLoading === player.id;
                            return (
                                <div key={player.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
                                    <div className="avatar avatar-sm" style={{ background: player.photo ? `url(${player.photo}) center/cover` : 'var(--bg-input)', fontSize: '0.9rem', cursor: 'pointer', flexShrink: 0 }} onClick={() => onViewProfile && onViewProfile(player.id)}>{player.photo ? '' : getInitials(player.name || '?')}</div>
                                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onViewProfile && onViewProfile(player.id)}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{player.name}</div>
                                        <div className="text-xs text-muted">{(Array.isArray(player.sports) ? player.sports : []).map(s => getSportEmoji(s)).join(' ')}{player.gamesPlayed > 0 && ` · ${player.gamesPlayed} games`}</div>
                                    </div>
                                    {isFriend ? <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>✓ Friends</span> : isPending ? <button className="btn btn-sm btn-outline" disabled style={{ fontSize: '0.8rem' }}>Requested</button> : <button className="btn btn-sm btn-primary" style={{ fontSize: '0.8rem', padding: '6px 14px' }} disabled={isLoading} onClick={() => handleFriendRequest(player.id)}>{isLoading ? '…' : '+ Add'}</button>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
