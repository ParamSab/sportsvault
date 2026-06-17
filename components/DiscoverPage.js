'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { SPORTS, getPlayer, getSportEmoji, spotsLeft, formatDate, getInitials, PLAYERS } from '@/lib/mockData';

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

    const heroRef = useRef(null);
    const filterRef = useRef(null);

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

    const userLat = state.currentUser?.lat || 19.076;
    const userLng = state.currentUser?.lng || 72.877;

    // Stat bar metrics
    const friendsPlayingToday = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return upcomingGames.filter(g => g.date === today && (g.rsvps || []).some(r => r.status === 'yes' && friendIdSet.has(String(r.playerId)))).length;
    }, [upcomingGames, friendIdSet]);

    const fillingFast = useMemo(
        () => upcomingGames.filter(g => { const s = spotsLeft(g); return s > 0 && s <= 3; }),
        [upcomingGames]
    );

    const friendSuggestions = useMemo(() => {
        const knownIds = new Set([...(state.friends || []).map(String), String(currentUserId || '')]);
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

    // --- Scroll interactivity: hero parallax + sticky filter (ref-driven, no re-render) ---
    useEffect(() => {
        let raf = 0;
        const onScroll = () => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = 0;
                const y = window.scrollY || 0;
                if (heroRef.current) {
                    heroRef.current.style.transform = `translateY(${Math.min(y, 260) * 0.22}px)`;
                    heroRef.current.style.opacity = String(Math.max(0, 1 - y / 300));
                }
                if (filterRef.current) {
                    filterRef.current.classList.toggle('stuck', y > 140);
                }
            });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
    }, []);

    // --- Scroll-reveal via a single shared observer; re-runs when content changes ---
    useEffect(() => {
        const io = new IntersectionObserver((entries) => {
            entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        document.querySelectorAll('.dg-reveal:not(.in)').forEach(el => io.observe(el));
        return () => io.disconnect();
    }, [upcomingGames, friendSuggestions, pastTeammates, viewMode, showFriendsOnly]);

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

    // --- Game card renderer (shared by rail + list) ---
    const GameCard = ({ game, rail }) => {
        const spots = spotsLeft(game);
        const sportColor = SPORTS[game.sport]?.color || '#6366f1';
        const sportGradient = SPORTS[game.sport]?.gradient || 'linear-gradient(135deg, #6366f1, #4f46e5)';
        const organizer = getPlayer(game.organizerId || game.organizer?.id) || game.organizer;
        const distance = calcDistKm(userLat, userLng, game.lat, game.lng);
        const confirmedPlayers = (game.rsvps || []).filter(r => r.status === 'yes' || r.status === 'checked_in');
        const isFilling = spots > 0 && spots <= 3;
        const isFull = spots <= 0;
        const spotsClass = isFull ? 'gray' : isFilling ? 'red' : 'green';
        const maxP = game.maxPlayers || (confirmedPlayers.length + Math.max(spots, 0)) || confirmedPlayers.length;
        const filled = confirmedPlayers.length;
        const pct = maxP > 0 ? Math.min(100, Math.round((filled / maxP) * 100)) : 0;
        const capFill = isFull ? 'linear-gradient(90deg,#475569,#64748b)' : isFilling ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : sportGradient;

        return (
            <button
                className={`dg-card ${isFilling ? 'urgent' : ''} ${rail ? '' : 'dg-reveal'}`}
                onClick={() => onViewGame(game.id)}
            >
                <div className="dg-banner" style={{ background: sportGradient }}>
                    <span className="dg-banner-emoji">{SPORTS[game.sport]?.emoji || '🏅'}</span>
                    <div className="dg-banner-tags">
                        <span className="dg-tag">{game.format}</span>
                        {game.visibility && game.visibility !== 'public' && (
                            <span className="dg-tag">{game.visibility === 'friends' ? '👥 Friends' : '🔒 Private'}</span>
                        )}
                        {game.needsHost && <span className="dg-tag host">🏆 Host needed</span>}
                        {isFilling && <span className="dg-tag urgent">⚡ Filling fast</span>}
                    </div>
                    <span className={`dg-spotpill ${spotsClass}`}>{isFull ? 'FULL' : `${spots} left`}</span>
                </div>

                <div className="dg-body">
                    <div className="dg-card-title">{game.title}</div>

                    <div className="dg-meta">
                        <div className="dg-meta-row">
                            <span className="mi">📍</span>
                            <span className="mt">{game.location}</span>
                            {distance && <span className="pill dist">{distance}</span>}
                        </div>
                        <div className="dg-meta-row">
                            <span className="mi">📅</span>
                            <span className="mt">{formatDate(game.date)} · {game.time}</span>
                            {game.price > 0 && <span className="pill price">₹{game.price}/pp</span>}
                        </div>
                        <div className="dg-meta-row">
                            <span className="mi">⭐</span>
                            <span className="mt">{game.skillLevel || 'All levels'}</span>
                            {game.surface && <span className="pill surf">🌱 {game.surface}</span>}
                        </div>
                    </div>

                    {/* Capacity progress */}
                    <div className="dg-cap">
                        <div className="dg-cap-top">
                            <span className="dg-cap-lbl">{isFull ? 'Game full' : isFilling ? 'Almost full' : 'Spots'}</span>
                            <span className="dg-cap-val">{filled}/{maxP} in</span>
                        </div>
                        <div className="dg-cap-track">
                            <div className="dg-cap-fill" style={{ width: `${pct}%`, background: capFill }} />
                        </div>
                    </div>

                    <div className="dg-foot">
                        <div className="dg-org">
                            <div className="avatar avatar-sm" style={{
                                borderColor: sportColor,
                                background: organizer?.photo ? `url(${organizer.photo}) center/cover` : undefined,
                                fontSize: organizer?.photo ? '0' : undefined,
                            }}>
                                {organizer?.photo ? '' : getInitials(organizer?.name || 'O')}
                            </div>
                            <div className="dg-org-meta">
                                <div className="dg-org-lbl">Hosted by</div>
                                <div className="dg-org-name">{organizer?.name?.split(' ')[0] || 'Unknown'}</div>
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
                                    {confirmedPlayers.length > 3 && <div className="avatar-stack-count">+{confirmedPlayers.length - 3}</div>}
                                </div>
                            )}
                        </div>
                        <span className="dg-join" style={{ background: `${sportColor}1f`, color: sportColor, border: `1.5px solid ${sportColor}45` }}>
                            View →
                        </span>
                    </div>
                </div>
            </button>
        );
    };

    const PersonRow = ({ player }) => {
        const isFriend = friendIdSet.has(String(player.id));
        const isPending = (state.pendingFriends || []).some(f => String(f.id) === String(player.id));
        const isLoading = friendActionLoading === player.id;
        return (
            <div className="dg-person dg-reveal">
                <div className="avatar avatar-sm" style={{ background: player.photo ? `url(${player.photo}) center/cover` : 'var(--bg-input)', fontSize: '0.9rem', cursor: 'pointer', flexShrink: 0 }} onClick={() => onViewProfile && onViewProfile(player.id)}>{player.photo ? '' : getInitials(player.name || '?')}</div>
                <div style={{ flex: 1, cursor: 'pointer', minWidth: 0 }} onClick={() => onViewProfile && onViewProfile(player.id)}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{player.name}</div>
                    <div className="text-xs text-muted">{(Array.isArray(player.sports) ? player.sports : []).map(s => getSportEmoji(s)).join(' ')}{player.gamesPlayed > 0 && ` · ${player.gamesPlayed} games`}</div>
                </div>
                {isFriend ? <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>✓ Friends</span> : isPending ? <button className="btn btn-sm btn-outline" disabled style={{ fontSize: '0.8rem' }}>Requested</button> : <button className="btn btn-sm btn-primary" style={{ fontSize: '0.8rem', padding: '6px 14px' }} disabled={isLoading} onClick={() => handleFriendRequest(player.id)}>{isLoading ? '…' : '+ Add'}</button>}
            </div>
        );
    };

    return (
        <div className="dg animate-fade-in">
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
                            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 99, background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>🔍 Find Games</span>
                                <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 99, background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>✅ RSVP Instantly</span>
                                <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 99, background: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}>⭐ Build Your Rep</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Parallax hero */}
            <div className="dg-hero" ref={heroRef}>
                <div className="dg-hero-orbs"><div className="dg-orb o1" /><div className="dg-orb o2" /></div>
                <div className="dg-hero-inner">
                    <span className="dg-loc-chip"><span className="live" />📍 {state.currentUser?.location || 'Mumbai'}</span>
                    <h1 className="dg-title">Find your <span className="grad">game</span></h1>
                    <p className="dg-title-sub">
                        <b>{upcomingGames.length}</b> game{upcomingGames.length !== 1 ? 's' : ''} {showFriendsOnly ? 'with your friends' : 'happening near you'}
                    </p>
                </div>
            </div>

            {/* Stat pills */}
            <div className="dg-stats">
                <div className="dg-statpill">
                    <span className="ico">🏟️</span>
                    <div><div className="num">{upcomingGames.length}</div><div className="lbl">Near you</div></div>
                </div>
                {state.isAuthenticated && (
                    <div className="dg-statpill">
                        <span className="ico">👥</span>
                        <div><div className="num">{friendsPlayingToday}</div><div className="lbl">Friends today</div></div>
                    </div>
                )}
                <div className="dg-statpill">
                    <span className="ico">⚡</span>
                    <div><div className="num">{fillingFast.length}</div><div className="lbl">Filling fast</div></div>
                </div>
                <div className="dg-statpill">
                    <span className="ico">🌱</span>
                    <div><div className="num">{upcomingGames.filter(g => g.sport === 'football').length}</div><div className="lbl">Football</div></div>
                </div>
            </div>

            {/* Sticky smart filter bar */}
            <div className="dg-filterbar" ref={filterRef}>
                <div className="dg-chips">
                    <button className={`dg-chip ${sportFilter === 'all' ? 'on all' : ''}`} onClick={() => setSportFilter('all')}>🏅 All</button>
                    {Object.entries(SPORTS).map(([key, sport]) => (
                        <button key={key} className={`dg-chip ${sportFilter === key ? `on ${key}` : ''}`} onClick={() => setSportFilter(key)}>{sport.emoji} {sport.name}</button>
                    ))}
                    {state.isAuthenticated && friendIdSet.size > 0 && (
                        <button className={`dg-chip ${showFriendsOnly ? 'on friends' : ''}`} onClick={() => setShowFriendsOnly(v => !v)}>👥 Friends {showFriendsOnly ? '✓' : ''}</button>
                    )}
                </div>
                <div className="dg-controls">
                    <div className="dg-segment">
                        <button className={`dg-seg ${viewMode === 'list' ? 'on' : ''}`} onClick={() => setViewMode('list')}>📋 List</button>
                        <button className={`dg-seg ${viewMode === 'map' ? 'on' : ''}`} onClick={() => setViewMode('map')}>🗺️ Map</button>
                    </div>
                    <input type="date" className="dg-input" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ color: dateFilter ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                    <select className="dg-input" value={skillFilter} onChange={e => setSkillFilter(e.target.value)}>
                        <option value="all">All levels</option>
                        <option value="Beginner-Friendly">Beginner</option>
                        <option value="Intermediate">Intermediate</option>
                        <option value="Advanced">Advanced</option>
                    </select>
                </div>
            </div>

            {viewMode === 'map' && (
                <div style={{ height: 350, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-color)', margin: '16px 0', position: 'relative', background: 'var(--bg-card)' }}>
                    <iframe src={`https://maps.google.com/maps?q=${userLat},${userLng}&z=12&output=embed`} width="100%" height="100%" style={{ border: 0, filter: 'grayscale(0.2) invert(0.9) hue-rotate(180deg) brightness(0.8)' }} allowFullScreen loading="lazy" />
                    <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, background: 'rgba(10,14,26,0.85)', borderRadius: 'var(--radius-md)', padding: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', zIndex: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>📍 Showing {upcomingGames.length} games near {state.currentUser?.location || 'Mumbai'}</span>
                            <button className="btn btn-xs btn-ghost" onClick={() => { if (navigator.geolocation) navigator.geolocation.getCurrentPosition(pos => dispatch({ type: 'UPDATE_PROFILE', payload: { lat: pos.coords.latitude, lng: pos.coords.longitude } })); }}>Recenter 🎯</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Filling-fast horizontal rail */}
            {viewMode === 'list' && fillingFast.length > 0 && (
                <>
                    <div className="dg-sec-head">
                        <span className="bar" style={{ background: 'linear-gradient(180deg,#f59e0b,#ef4444)' }} />
                        <h2>⚡ Filling fast</h2>
                        <span className="count">{fillingFast.length}</span>
                    </div>
                    <div className="dg-rail">
                        {fillingFast.map(game => (
                            <div key={`rail-${game.id}`} className="dg-railcard">
                                <GameCard game={game} rail />
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* All games */}
            {viewMode === 'list' && (
                <>
                    {upcomingGames.length > 0 && (
                        <div className="dg-sec-head">
                            <span className="bar" />
                            <h2>{showFriendsOnly ? "Friends' games" : 'All games'}</h2>
                            <span className="count">{upcomingGames.length}</span>
                        </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {upcomingGames.length === 0 && !state.isLoaded && (
                            <>
                                {[1, 2, 3].map(i => (
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
                        {upcomingGames.map(game => <GameCard key={game.id} game={game} />)}
                    </div>
                </>
            )}

            {/* People You May Know */}
            {friendSuggestions.length > 0 && state.isAuthenticated && (
                <div style={{ marginTop: 30 }}>
                    <div className="dg-sec-head"><span className="bar" /><h2>👥 People you may know</h2></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {friendSuggestions.map(player => <PersonRow key={player.id} player={player} />)}
                    </div>
                </div>
            )}

            {/* Played With */}
            {pastTeammates.length > 0 && state.isAuthenticated && (
                <div style={{ marginTop: 24 }}>
                    <div className="dg-sec-head"><span className="bar" style={{ background: 'linear-gradient(180deg,#22c55e,#16a34a)' }} /><h2>🏟️ Played with</h2></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {pastTeammates.map(player => <PersonRow key={player.id} player={player} />)}
                    </div>
                </div>
            )}
        </div>
    );
}
