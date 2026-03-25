'use client';
import { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { SPORTS, getPlayer, getSportEmoji, spotsLeft, formatDate, getInitials } from '@/lib/mockData';
import dynamic from 'next/dynamic';

export default function DiscoverPage({ onViewGame, onViewProfile }) {
    const { state, dispatch } = useStore();
    const [sportFilter, setSportFilter] = useState('all');
    const [viewMode, setViewMode] = useState('list');
    const [skillFilter, setSkillFilter] = useState('all');

    const Map = useMemo(() => dynamic(() => import('./MapPicker').then(mod => {
        return function SimpleMap({ games, onViewGame, center }) {
            const mapSrc = `https://maps.google.com/maps?q=${center.lat},${center.lng}&z=13&output=embed`;
            return (
                <div style={{ position: 'relative', height: '100%', width: '100%' }}>
                    <iframe src={mapSrc} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" />
                </div>
            )
        }
    }), { ssr: false }), []);

    const upcomingGames = useMemo(() => {
        const currentUserId = state.currentUser?.id || 'current';
        const friendIds = new Set(state.friends || []);
        return state.games
            .filter(g => g.status === 'open')
            .filter(g => {
                const vis = g.visibility || 'public';
                if (vis === 'public') return true;
                if (g.organizerId === currentUserId) return true;  // always show own games
                if (vis === 'friends') return friendIds.has(g.organizerId);
                return false; // private
            })
            .filter(g => sportFilter === 'all' || g.sport === sportFilter)
            .filter(g => skillFilter === 'all' || g.skillLevel === skillFilter)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [state.games, sportFilter, skillFilter, state.friends, state.currentUser]);

    return (
        <div className="animate-fade-in">
            {/* Hero */}
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', marginBottom: 4 }}>
                    Find Your <span className="text-gradient-football">Game</span>
                </h1>
                <p className="text-muted text-sm">
                    {upcomingGames.length} games near you
                </p>
            </div>

            {/* Sport Filters */}
            <div className="filter-bar" style={{ marginBottom: 12 }}>
                <button
                    className={`chip ${sportFilter === 'all' ? 'active all' : ''}`}
                    onClick={() => setSportFilter('all')}
                >
                    🏅 All Sports
                </button>
                {Object.entries(SPORTS).map(([key, sport]) => (
                    <button
                        key={key}
                        className={`chip ${sportFilter === key ? `active ${key}` : ''}`}
                        onClick={() => setSportFilter(key)}
                    >
                        {sport.emoji} {sport.name}
                    </button>
                ))}
            </div>

            {/* View Toggle + Skill Filter */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div className="tab-bar" style={{ width: 'auto' }}>
                    <button className={`tab-item ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
                        📋 List
                    </button>
                    <button className={`tab-item ${viewMode === 'map' ? 'active' : ''}`} onClick={() => setViewMode('map')}>
                        🗺️ Map
                    </button>
                </div>
                <select
                    value={skillFilter}
                    onChange={e => setSkillFilter(e.target.value)}
                    style={{
                        padding: '8px 12px', fontSize: '0.8125rem',
                        background: 'var(--bg-card)', borderRadius: 'var(--radius-full)',
                        border: '1px solid var(--border-color)', width: 'auto',
                    }}
                >
                    <option value="all">All Levels</option>
                    <option value="Beginner-Friendly">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                </select>
            </div>

            {/* Map View */}
            {viewMode === 'map' && (
                <div style={{
                    height: 350, borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                    border: '1px solid var(--border-color)', marginBottom: 16,
                    position: 'relative', background: 'var(--bg-card)'
                }}>
                    <iframe
                        src={`https://maps.google.com/maps?q=${state.currentUser?.lat || 19.076},${state.currentUser?.lng || 72.877}&z=12&output=embed`}
                        width="100%" height="100%" style={{ border: 0, filter: 'grayscale(0.2) invert(0.9) hue-rotate(180deg) brightness(0.8)' }}
                        allowFullScreen loading="lazy"
                    />
                    <div style={{
                        position: 'absolute', bottom: 12, left: 12, right: 12,
                        background: 'rgba(10,14,26,0.85)', borderRadius: 'var(--radius-md)',
                        padding: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)',
                        backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)',
                        zIndex: 10
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>📍 Showing {upcomingGames.length} games near {state.currentUser?.location || 'Mumbai'}</span>
                            <button className="btn btn-xs btn-ghost" onClick={() => {
                                if (navigator.geolocation) {
                                    navigator.geolocation.getCurrentPosition(pos => {
                                        dispatch({ type: 'UPDATE_PROFILE', payload: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
                                    });
                                }
                            }}>Recenter 🎯</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Game Cards List */}
            <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {upcomingGames.length === 0 && (
                    <div className="glass-card no-hover" style={{ textAlign: 'center', padding: 48 }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🏟️</div>
                        <h3 style={{ marginBottom: 8 }}>No games found</h3>
                        <p className="text-muted text-sm">Try adjusting your filters or create a new game!</p>
                    </div>
                )}
                {upcomingGames.map(game => {
                    const spots = spotsLeft(game);
                    const sportColor = SPORTS[game.sport]?.color;
                    const organizer = getPlayer(game.organizerId || game.organizer?.id) || game.organizer;
                    return (
                        <button
                            key={game.id}
                            className="glass-card"
                            onClick={() => onViewGame(game.id)}
                            style={{ textAlign: 'left', cursor: 'pointer', padding: 0, overflow: 'hidden' }}
                        >
                            {/* Premium Header Block */}
                            <div style={{ height: 60, background: SPORTS[game.sport]?.gradient, position: 'relative', overflow: 'hidden' }}>
                                <span style={{ fontSize: '3.5rem', opacity: 0.15, position: 'absolute', right: 5, bottom: -15, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
                                    {getSportEmoji(game.sport)}
                                </span>
                                <div style={{ position: 'absolute', top: 12, left: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className={`sport-badge ${game.sport}`} style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', padding: '4px 10px', fontSize: '0.7rem' }}>
                                        {game.format}
                                    </span>
                                    {game.visibility && game.visibility !== 'public' && (
                                        <span style={{ background: 'rgba(0,0,0,0.4)', color: '#fff', backdropFilter: 'blur(4px)', padding: '3px 8px', borderRadius: 99, fontSize: '0.65rem', fontWeight: 700 }}>
                                            {game.visibility === 'friends' ? '👥 Friends' : '🔒 Private'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div style={{ padding: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                    <h3 style={{ fontSize: '1.1875rem', fontWeight: 800, lineHeight: 1.3, margin: 0 }}>{game.title}</h3>
                                    <div style={{
                                        background: spots <= 2 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                                        color: spots <= 2 ? '#ef4444' : '#22c55e',
                                        padding: '4px 10px', borderRadius: 'var(--radius-full)',
                                        fontSize: '0.7rem', fontWeight: 800, whiteSpace: 'nowrap',
                                        border: `1px solid ${spots <= 2 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`
                                    }}>
                                        {spots} SPOT{spots !== 1 ? 'S' : ''} LEFT
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                                    <div className="text-sm text-muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: '1.2rem' }}>📍</span> <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{game.location}</span>
                                    </div>
                                    <div className="text-sm text-muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: '1.2rem' }}>📅</span> <span>{formatDate(game.date)} <span style={{ opacity: 0.5 }}>•</span> {game.time}</span>
                                    </div>
                                    <div className="text-sm text-muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: '1.2rem' }}>⭐</span> <span>{game.skillLevel}</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16 }}>
                                    {/* Organizer + Player avatars */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div className="avatar avatar-sm" style={{
                                            borderColor: sportColor,
                                            background: organizer?.photo ? `url(${organizer.photo}) center/cover` : undefined,
                                            fontSize: organizer?.photo ? '0' : undefined,
                                        }}>
                                            {organizer?.photo ? '' : getInitials(organizer?.name || 'O')}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Organized by</div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{organizer?.name?.split(' ')[0] || 'Unknown'}</div>
                                        </div>
                                    </div>
                                    <button className="btn btn-sm" style={{
                                        background: `${sportColor}20`, color: sportColor, border: `1px solid ${sportColor}50`,
                                        padding: '6px 16px', borderRadius: 'var(--radius-full)', fontWeight: 600
                                    }}>
                                        Open →
                                    </button>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
