'use client';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { SPORTS, getPlayer, getSportEmoji, spotsLeft, formatDate, getInitials, PLAYERS } from '@/lib/mockData';
import dynamic from 'next/dynamic';

function calcDistKm(userLat, userLng, gameLat, gameLng) {
    if (!userLat || !userLng || !gameLat || !gameLng) return null;
    const R = 6371;
    const dLat = ((gameLat - userLat) * Math.PI) / 180;
    const dLng = ((gameLng - userLng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((userLat * Math.PI) / 180) * Math.cos((gameLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return dist;
}

function formatDist(km) {
    if (km === null) return null;
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

const RADIUS_OPTIONS = [
    { label: '2 km', value: 2 },
    { label: '5 km', value: 5 },
    { label: '10 km', value: 10 },
    { label: 'Any', value: null },
];

async function reverseGeocode(lat, lng) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
            headers: { 'Accept-Language': 'en' },
        });
        const data = await res.json();
        const addr = data.address || {};
        return addr.suburb || addr.neighbourhood || addr.city_district || addr.city || addr.town || addr.village || 'Your Location';
    } catch {
        return 'Your Location';
    }
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
    const [radiusKm, setRadiusKm] = useState(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [locationError, setLocationError] = useState('');
    const [locationDismissed, setLocationDismissed] = useState(false);

    const hasLocation = !!(state.currentUser?.lat && state.currentUser?.lng);

    const saveLocation = useCallback(async (lat, lng, locationName) => {
        dispatch({ type: 'UPDATE_PROFILE', payload: { lat, lng, location: locationName } });
        try {
            await fetch('/api/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat, lng, location: locationName }),
            });
        } catch (_) {}
    }, [dispatch]);

    const requestGpsLocation = useCallback(async () => {
        if (!navigator.geolocation) {
            setLocationError('Location not supported by your browser.');
            return;
        }
        setLocationLoading(true);
        setLocationError('');
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                const name = await reverseGeocode(latitude, longitude);
                await saveLocation(latitude, longitude, name);
                setRadiusKm(10);
                setLocationLoading(false);
            },
            (err) => {
                setLocationError(err.code === 1 ? 'Location permission denied. You can set it manually in your profile.' : 'Could not get location. Try again.');
                setLocationLoading(false);
            },
            { timeout: 10000, maximumAge: 300000 }
        );
    }, [saveLocation]);

    // Auto-request location once if user is logged in and has no coords yet
    useEffect(() => {
        if (state.isAuthenticated && !hasLocation && !locationDismissed && state.isLoaded) {
            requestGpsLocation();
        }
    // Only run once after initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.isLoaded, state.isAuthenticated]);

    // When user gains a location, default to 10km radius
    useEffect(() => {
        if (hasLocation && radiusKm === null) setRadiusKm(10);
    }, [hasLocation]);

    const Map = useMemo(() => dynamic(() => import('./MapPicker').then(mod => {
        return function SimpleMap({ games, onViewGame, center }) {
            const mapSrc = `https://maps.google.com/maps?q=${center.lat},${center.lng}&z=13&output=embed`;
            return (<div style={{ position: 'relative', height: '100%', width: '100%' }}><iframe src={mapSrc} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" /></div>);
        };
    }), { ssr: false }), []);

    const friendIdSet = useMemo(() => new Set((state.friends || []).map(String)), [state.friends]);

    const upcomingGames = useMemo(() => {
        const currentUserId = String(state.currentUser?.dbId || state.currentUser?.id || 'current');
        const uLat = state.currentUser?.lat;
        const uLng = state.currentUser?.lng;

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
            .filter(g => {
                if (!radiusKm || !uLat || !uLng || !g.lat || !g.lng) return true;
                const d = calcDistKm(uLat, uLng, g.lat, g.lng);
                return d === null || d <= radiusKm;
            })
            .sort((a, b) => {
                if (uLat && uLng) {
                    const dA = calcDistKm(uLat, uLng, a.lat, a.lng);
                    const dB = calcDistKm(uLat, uLng, b.lat, b.lng);
                    if (dA !== null && dB !== null) return dA - dB;
                    if (dA !== null) return -1;
                    if (dB !== null) return 1;
                }
                return new Date(a.date) - new Date(b.date);
            });
    }, [state.games, sportFilter, skillFilter, dateFilter, state.friends, state.currentUser, showFriendsOnly, friendIdSet, radiusKm]);

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
            {/* Location prompt */}
            {state.isAuthenticated && !hasLocation && !locationDismissed && state.isLoaded && (
                <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.1))', border: '1px solid rgba(99,102,241,0.35)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '1.5rem' }}>📍</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 2 }}>See games near you</div>
                        <div className="text-xs text-muted">{locationError || 'Share your location to find games sorted by distance.'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button className="btn btn-sm btn-primary" disabled={locationLoading} onClick={requestGpsLocation} style={{ fontSize: '0.8rem', padding: '7px 14px' }}>
                            {locationLoading ? '…' : 'Use My Location'}
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setLocationDismissed(true)} style={{ fontSize: '0.8rem' }}>
                            Not now
                        </button>
                    </div>
                </div>
            )}

            {/* Welcome banner for new users */}
            {isNewUser && !welcomeDismissed && (
                <div className="welcome-banner">
                    <button className="welcome-banner-dismiss" onClick={() => setWelcomeDismissed(true)} aria-label="Dismiss">x</button>
                    <div className="welcome-banner-content">
                        <div className="welcome-banner-icon" aria-hidden="true">SV</div>
                        <div className="welcome-banner-copy">
                            <div className="welcome-banner-title">Welcome to SportsVault!</div>
                            <div className="welcome-banner-text">
                                New in town or looking for your next game? Scroll below to find games near you and join a community of players.
                            </div>
                            <div className="welcome-banner-actions">
                                <span className="welcome-pill welcome-pill-blue">Find Games</span>
                                <span className="welcome-pill welcome-pill-green">RSVP Instantly</span>
                                <span className="welcome-pill welcome-pill-orange">Build Your Rep</span>
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
                <button className="stat-item" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={requestGpsLocation} disabled={locationLoading} title="Update your location">
                    <span style={{ fontSize: '1.1rem' }}>{locationLoading ? '⏳' : '📍'}</span>
                    <div>
                        <div className="stat-value" style={{ fontSize: '0.875rem', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{state.currentUser?.location || 'Set location'}</div>
                        <div className="stat-label">Your area</div>
                    </div>
                </button>
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

            {/* Radius filter chips — only show when user has a location */}
            {hasLocation && (
                <div className="filter-bar" style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginRight: 4, whiteSpace: 'nowrap' }}>📍 Within:</span>
                    {RADIUS_OPTIONS.map(opt => (
                        <button
                            key={opt.label}
                            className={`chip ${radiusKm === opt.value ? 'active' : ''}`}
                            onClick={() => setRadiusKm(opt.value)}
                            style={radiusKm === opt.value ? { background: 'rgba(99,102,241,0.2)', borderColor: '#6366f1', color: '#818cf8', fontWeight: 700 } : {}}
                        >
                            {opt.label}
                        </button>
                    ))}
                    {locationLoading && <span className="text-xs text-muted" style={{ marginLeft: 4 }}>Updating…</span>}
                    <button className="chip" onClick={requestGpsLocation} disabled={locationLoading} title="Refresh location" style={{ padding: '6px 10px' }}>
                        🎯
                    </button>
                </div>
            )}

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
                            <button className="btn btn-xs btn-ghost" onClick={requestGpsLocation} disabled={locationLoading}>
                        {locationLoading ? '…' : 'Recenter 🎯'}
                    </button>
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
                    const distKm = calcDistKm(userLat, userLng, game.lat, game.lng);
                    const distance = formatDist(distKm);
                    const confirmedPlayers = (game.rsvps || []).filter(r => r.status === 'yes' || r.status === 'checked_in');
                    const isFilling = spots > 0 && spots <= 3;
                    const isFull = spots <= 0;
                    const spotsClass = isFull ? 'gray' : isFilling ? 'red' : 'green';

                    return (
                        <button key={game.id} className="game-card" onClick={() => onViewGame(game.id)}
                            style={{ borderColor: isFilling ? 'rgba(239,68,68,0.3)' : undefined }}>

                            {/* Sport color banner */}
                            <div className="game-card-banner" style={{ background: sportGradient }}>
                                <span className="game-card-banner-emoji">{SPORTS[game.sport]?.emoji || '🏅'}</span>
                                <div className="game-card-banner-top">
                                    <span className="banner-tag">{game.format}</span>
                                    {game.visibility && game.visibility !== 'public' && (
                                        <span className="banner-tag">
                                            {game.visibility === 'friends' ? '👥 Friends' : '🔒 Private'}
                                        </span>
                                    )}
                                    {game.needsHost && <span className="badge-host">🏆 Host Needed</span>}
                                </div>
                                <div className="game-card-banner-bottom">
                                    {isFilling && <span className="badge-urgent">⚡ Filling Fast</span>}
                                    {isFull && <span className="banner-tag" style={{ color: '#94a3b8' }}>FULL</span>}
                                </div>
                            </div>

                            {/* Card body */}
                            <div className="game-card-body">
                                <div className="game-card-title">
                                    <span>{game.title}</span>
                                    <span className={`spots-pill ${spotsClass}`}>
                                        {spots <= 0 ? 'FULL' : `${spots} LEFT`}
                                    </span>
                                </div>

                                <div className="game-card-info">
                                    <div className="game-card-info-row">
                                        <span className="info-icon">📍</span>
                                        <span className="info-text">{game.location}</span>
                                        {distance && <span className="distance-chip">{distance}</span>}
                                    </div>
                                    <div className="game-card-info-row">
                                        <span className="info-icon">📅</span>
                                        <span className="info-text">{formatDate(game.date)} · {game.time}</span>
                                        {game.price > 0 && <span className="price-badge">₹{game.price}/player</span>}
                                    </div>
                                    <div className="game-card-info-row">
                                        <span className="info-icon">⭐</span>
                                        <span className="info-text">{game.skillLevel || 'All Levels'}</span>
                                        {game.surface && <span className="surface-tag">🌱 {game.surface}</span>}
                                    </div>
                                </div>

                                {/* Footer: organizer + avatar stack + join button */}
                                <div className="game-card-footer">
                                    <div className="game-card-organizer">
                                        <div className="avatar avatar-sm" style={{
                                            borderColor: sportColor,
                                            background: organizer?.photo ? `url(${organizer.photo}) center/cover` : undefined,
                                            fontSize: organizer?.photo ? '0' : undefined,
                                        }}>
                                            {organizer?.photo ? '' : getInitials(organizer?.name || 'O')}
                                        </div>
                                        <div>
                                            <div className="organizer-label">By</div>
                                            <div className="organizer-name">{organizer?.name?.split(' ')[0] || 'Unknown'}</div>
                                        </div>
                                        {confirmedPlayers.length > 0 && (
                                            <div className="avatar-stack" style={{ marginLeft: 4 }}>
                                                {confirmedPlayers.slice(0, 3).map((r, i) => {
                                                    const p = getPlayer(r.playerId) || r.player;
                                                    if (!p) return null;
                                                    return (
                                                        <div key={r.playerId || i} className="avatar" style={{
                                                            width: 24, height: 24, fontSize: '0.5rem',
                                                            background: p.photo ? `url(${p.photo}) center/cover` : `${sportColor}30`,
                                                            color: sportColor, borderColor: 'var(--bg-card)',
                                                        }}>
                                                            {p.photo ? '' : getInitials(p.name || '?')}
                                                        </div>
                                                    );
                                                })}
                                                {confirmedPlayers.length > 3 && (
                                                    <div className="avatar-stack-count">+{confirmedPlayers.length - 3}</div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <span className="join-btn" style={{
                                        background: `${sportColor}18`,
                                        color: sportColor,
                                        border: `1.5px solid ${sportColor}45`,
                                    }}>
                                        View →
                                    </span>
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
