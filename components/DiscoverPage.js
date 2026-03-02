'use client';
import { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { SPORTS, getPlayer, getSportEmoji, spotsLeft, formatDate, getInitials } from '@/lib/mockData';

export default function DiscoverPage({ onViewGame, onViewProfile }) {
    const { state } = useStore();
    const [sportFilter, setSportFilter] = useState('all');
    const [viewMode, setViewMode] = useState('list');
    const [skillFilter, setSkillFilter] = useState('all');

    // Game expires 1 day after game date (e.g. game on Mar 1 is hidden from Mar 3 onwards)
    function isExpired(game) {
        const gameDate = new Date(game.date + 'T00:00:00');
        const expiry = new Date(gameDate);
        expiry.setDate(expiry.getDate() + 2);
        return new Date() >= expiry;
    }

    const upcomingGames = useMemo(() => {
        const currentUserId = state.currentUser?.id || 'current';
        const friendIds = new Set(state.friends || []);
        return state.games
            .filter(g => !isExpired(g))
            .filter(g => g.status === 'open')
            .filter(g => {
                const vis = g.visibility || 'public';
                if (vis === 'public') return true;
                if (g.organizer === currentUserId) return true;  // always show own games
                if (vis === 'friends') return friendIds.has(g.organizer);
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
                    <option value="All Levels">All Levels</option>
                </select>
            </div>

            {/* Map View */}
            {viewMode === 'map' && (
                <div style={{
                    height: 260, borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                    background: 'linear-gradient(135deg, #0f1629 0%, #162034 50%, #1a2540 100%)',
                    border: '1px solid var(--border-color)', marginBottom: 16,
                    position: 'relative',
                }}>
                    {/* Stylized map background */}
                    <div style={{ position: 'absolute', inset: 0, opacity: 0.15 }}>
                        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#4a5568" strokeWidth="0.5" />
                            </pattern>
                            <rect width="100%" height="100%" fill="url(#grid)" />
                            <circle cx="30%" cy="40%" r="60" fill="none" stroke="#4a5568" strokeWidth="0.5" opacity="0.5" />
                            <circle cx="60%" cy="55%" r="80" fill="none" stroke="#4a5568" strokeWidth="0.5" opacity="0.3" />
                            <path d="M 10% 60% Q 30% 30% 50% 50% T 90% 35%" fill="none" stroke="#4a5568" strokeWidth="1" opacity="0.4" />
                        </svg>
                    </div>
                    {/* Game pins */}
                    {upcomingGames.map((game, i) => {
                        const sportColor = SPORTS[game.sport]?.color || '#6366f1';
                        const x = 15 + (i * 18) % 70;
                        const y = 20 + ((i * 23) + 10) % 55;
                        return (
                            <button
                                key={game.id}
                                onClick={() => onViewGame(game.id)}
                                style={{
                                    position: 'absolute', left: `${x}%`, top: `${y}%`,
                                    transform: 'translate(-50%, -50%)',
                                    background: sportColor, width: 36, height: 36,
                                    borderRadius: '50% 50% 50% 0', border: 'none',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.875rem', cursor: 'pointer',
                                    boxShadow: `0 0 16px ${sportColor}60`,
                                    animation: 'pulse 2s ease-in-out infinite',
                                    animationDelay: `${i * 0.3}s`,
                                    transform: 'translate(-50%, -50%) rotate(-45deg)',
                                    zIndex: 2,
                                }}
                            >
                                <span style={{ transform: 'rotate(45deg)' }}>{getSportEmoji(game.sport)}</span>
                            </button>
                        );
                    })}
                    <div style={{
                        position: 'absolute', bottom: 12, left: 12, right: 12,
                        background: 'rgba(10,14,26,0.85)', borderRadius: 'var(--radius-md)',
                        padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)',
                        backdropFilter: 'blur(8px)',
                    }}>
                        📍 Showing {upcomingGames.length} games near {state.currentUser?.location || 'Mumbai'}
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
                    const currentUserId = state.currentUser?.id || 'current';
                    const organizer = getPlayer(game.organizer)
                        || state.players?.find(p => p.id === game.organizer)
                        || (game.organizer === currentUserId ? state.currentUser : null);
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
