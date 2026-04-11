'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import DiscoverPage from './DiscoverPage';
import FriendsPage from './FriendsPage';
import CreateGamePage from './CreateGamePage';
import NotificationsPage from './NotificationsPage';
import ProfilePage from './ProfilePage';
import GameDetailPage from './GameDetailPage';
import RatePage from './RatePage';
import SportsCVPage from './SportsCVPage';
import AuthPage from './AuthPage';
import { getInitials } from '@/lib/mockData';

export default function AppShell() {
    const { state, dispatch } = useStore();
    const [activeTab, setActiveTab] = useState('discover');
    const [viewingGame, setViewingGame] = useState(null);
    const [viewingProfile, setViewingProfile] = useState(null);
    const [viewingCV, setViewingCV] = useState(null);
    const [ratingGame, setRatingGame] = useState(null);
    const [showAuthGate, setShowAuthGate] = useState(false);

    const isGuest = !state.isAuthenticated;

    useEffect(() => {
        if (!state.isLoaded) return;

        const params = new URLSearchParams(window.location.search);
        const gameId = params.get('game');
        
        if (gameId) {
            if (isGuest) {
                localStorage.setItem('sportsvault_pending_game', gameId);
                setShowAuthGate(true);
            } else {
                setViewingGame(gameId);
            }
            // Add a slight delay before clearing URL to ensure state sticks
            setTimeout(() => {
                window.history.replaceState({}, document.title, window.location.pathname);
            }, 100);
        } else if (!isGuest) {
            const pending = localStorage.getItem('sportsvault_pending_game');
            if (pending) {
                setViewingGame(pending);
                localStorage.removeItem('sportsvault_pending_game');
            }
        }
    }, [state.isLoaded, isGuest]);

    const navigate = (tab) => {
        if (isGuest && tab !== 'discover' && tab !== 'profile') {
            setShowAuthGate(true);
            return;
        }
        setShowAuthGate(false);
        setActiveTab(tab);
        setViewingGame(null);
        setViewingProfile(null);
        setViewingCV(null);
        setRatingGame(null);
    };

    const unreadCount = (state.notifications || []).filter(n => !n.read).length;

    const renderContent = () => {
        if (showAuthGate) {
            return (
                <div className="animate-fade-in" style={{ padding: '20px 0' }}>
                    <div className="glass-card no-hover text-center" style={{ padding: '48px 24px' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 20 }}>👋</div>
                        <h2 style={{ marginBottom: 12 }}>Join the Community</h2>
                        <p className="text-muted" style={{ marginBottom: 32 }}>Please log in to manage friends, view your profile, and join games.</p>
                        <button className="btn btn-primary btn-block btn-lg" onClick={() => { setShowAuthGate(false); setActiveTab('profile'); }}>
                            Login / Sign Up
                        </button>
                        <button className="btn btn-ghost btn-block mt-md" onClick={() => { setShowAuthGate(false); setActiveTab('discover'); }}>
                            Continue as Guest
                        </button>
                    </div>
                </div>
            );
        }

        if (activeTab === 'profile' && isGuest) return <AuthPage />;
        if (viewingGame) return <GameDetailPage gameId={viewingGame} onBack={() => setViewingGame(null)} onViewProfile={setViewingProfile} />;
        if (viewingProfile) return <ProfilePage playerId={viewingProfile} onBack={() => setViewingProfile(null)} onViewCV={setViewingCV} onViewGame={setViewingGame} />;
        if (viewingCV) return <SportsCVPage playerId={viewingCV} onBack={() => setViewingCV(null)} />;
        if (ratingGame) return <RatePage gameId={ratingGame} onBack={() => setRatingGame(null)} />;

        switch (activeTab) {
            case 'discover': return <DiscoverPage onViewGame={setViewingGame} onViewProfile={setViewingProfile} />;
            case 'friends': return <FriendsPage onViewProfile={setViewingProfile} onViewGame={setViewingGame} />;
            case 'create': return <CreateGamePage onComplete={() => setActiveTab('discover')} />;
            case 'notifications': return <NotificationsPage onViewGame={setViewingGame} />;
            case 'profile': return <ProfilePage playerId={state.currentUser?.id || 'p1'} isOwn onViewCV={setViewingCV} onViewGame={setViewingGame} onRateGame={setRatingGame} />;
            default: return null;
        }
    };

    return (
        <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)' }}>
            {/* Header */}
            <header className="app-header">
                <div onClick={() => navigate('discover')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 32, height: 32,
                        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                        borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1rem',
                        boxShadow: '0 0 12px rgba(99,102,241,0.4)',
                        flexShrink: 0,
                    }}>
                        ⚡
                    </div>
                    <span style={{
                        fontFamily: 'var(--font-heading)',
                        fontWeight: 800,
                        fontSize: '1.2rem',
                        background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>
                        SportsVault
                    </span>
                </div>

                {isGuest ? (
                    <button className="btn btn-xs btn-primary" style={{ padding: '6px 16px', borderRadius: 99 }} onClick={() => navigate('profile')}>
                        Login
                    </button>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="header-location">
                            <span>📍</span>
                            <span>{state.currentUser?.location || 'Mumbai'}</span>
                        </div>
                        <div
                            onClick={() => navigate('profile')}
                            className="avatar avatar-sm"
                            style={{
                                cursor: 'pointer',
                                background: state.currentUser?.photo
                                    ? `url(${state.currentUser.photo}) center/cover`
                                    : 'linear-gradient(135deg, #6366f1, #a855f7)',
                                color: '#fff',
                                fontSize: '0.75rem',
                                borderColor: '#6366f1',
                                boxShadow: '0 0 0 2px rgba(99,102,241,0.3)',
                            }}
                        >
                            {state.currentUser?.photo ? '' : getInitials(state.currentUser?.name || 'U')}
                        </div>
                        <button
                            className="btn btn-xs btn-outline"
                            style={{ border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', padding: '4px 10px', fontSize: '0.7rem' }}
                            onClick={() => dispatch({ type: 'LOGOUT' })}
                        >
                            Out
                        </button>
                    </div>
                )}
            </header>

            {/* Content */}
            <main className="page-content">
                <div className="container">
                    {renderContent()}
                </div>
            </main>

            {/* Bottom Navigation */}
            <nav className="bottom-nav">
                <button className={`nav-item ${activeTab === 'discover' && !showAuthGate ? 'active' : ''}`} onClick={() => navigate('discover')}>
                    <span className="nav-icon">🔍</span>
                    <span className="nav-label">Explore</span>
                </button>
                <button className={`nav-item ${activeTab === 'friends' && !showAuthGate ? 'active' : ''}`} onClick={() => navigate('friends')}>
                    <span className="nav-icon">👥</span>
                    <span className="nav-label">Squad</span>
                </button>
                <button className="create-btn-nav" onClick={() => navigate('create')} aria-label="Create game">
                    ＋
                </button>
                <button
                    className={`nav-item ${activeTab === 'notifications' && !showAuthGate ? 'active' : ''}`}
                    onClick={() => navigate('notifications')}
                    style={{ position: 'relative' }}
                >
                    <span className="nav-icon">🔔</span>
                    <span className="nav-label">Bell</span>
                    {unreadCount > 0 && !isGuest && <span className="badge-count">{unreadCount}</span>}
                </button>
                <button
                    className={`nav-item ${activeTab === 'profile' || showAuthGate ? 'active' : ''}`}
                    onClick={() => navigate('profile')}
                >
                    {!isGuest && state.currentUser?.photo ? (
                        <div style={{
                            width: 26, height: 26, borderRadius: '50%',
                            background: `url(${state.currentUser.photo}) center/cover`,
                            border: '2px solid',
                            borderColor: (activeTab === 'profile' || showAuthGate) ? '#6366f1' : 'var(--border-color)',
                            transition: 'border-color var(--transition-fast)',
                        }} />
                    ) : (
                        <span className="nav-icon">👤</span>
                    )}
                    <span className="nav-label">Me</span>
                </button>
            </nav>
        </div>
    );
}
