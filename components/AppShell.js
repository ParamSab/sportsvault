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
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const gameId = params.get('game');
            if (gameId) {
                setViewingGame(gameId);
                // If guest, save as pending action for post-login
                if (isGuest) {
                    localStorage.setItem('sportsvault_pending_game', gameId);
                }
                window.history.replaceState({}, document.title, window.location.pathname);
            }
            
            // Re-check for pending game after becoming authenticated
            if (!isGuest) {
                const pending = localStorage.getItem('sportsvault_pending_game');
                if (pending) {
                    setViewingGame(pending);
                    localStorage.removeItem('sportsvault_pending_game');
                }
            }
        }
    }, [isGuest]);

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
                <div className="app-logo" onClick={() => navigate('discover')} style={{ cursor: 'pointer' }}>
                    SportsVault Dashboard
                </div>
                {isGuest ? (
                    <button className="btn btn-xs btn-primary" style={{ padding: '6px 14px', borderRadius: 99 }} onClick={() => navigate('profile')}>
                        Login
                    </button>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="header-location">
                            <span>📍</span>
                            <span>{state.currentUser?.location || 'Mumbai'}</span>
                        </div>
                        <button className="btn btn-xs btn-outline" style={{ border: '1px solid #ef4444', color: '#ef4444' }} onClick={() => dispatch({ type: 'LOGOUT' })}>
                            Logout
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
                    <span className="nav-label">Discover</span>
                </button>
                <button className={`nav-item ${activeTab === 'friends' ? 'active' : ''}`} onClick={() => navigate('friends')}>
                    <span className="nav-icon">👥</span>
                    <span className="nav-label">Friends</span>
                </button>
                <button className="create-btn-nav" onClick={() => navigate('create')}>
                    ＋
                </button>
                <button className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => navigate('notifications')}>
                    <span className="nav-icon">🔔</span>
                    <span className="nav-label">Alerts</span>
                    {(unreadCount > 0 && !isGuest) && <span className="badge-count">{unreadCount}</span>}
                </button>
                <button className={`nav-item ${activeTab === 'profile' || showAuthGate ? 'active' : ''}`} onClick={() => navigate('profile')}>
                    <span className="nav-icon">👤</span>
                    <span className="nav-label">Profile</span>
                </button>
            </nav>
        </div>
    );
}
