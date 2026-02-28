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

export default function AppShell() {
    const { state, dispatch } = useStore();
    const [activeTab, setActiveTab] = useState('discover');
    const [viewingGame, setViewingGame] = useState(null);
    const [viewingProfile, setViewingProfile] = useState(null);
    const [viewingCV, setViewingCV] = useState(null);
    const [ratingGame, setRatingGame] = useState(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const gameId = params.get('game');
            if (gameId) {
                setViewingGame(gameId);
                // Clean up the URL to prevent reloading the same game if they refresh later
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }, []);

    const navigate = (tab) => {
        setActiveTab(tab);
        setViewingGame(null);
        setViewingProfile(null);
        setViewingCV(null);
        setRatingGame(null);
    };

    const unreadCount = state.notifications.filter(n => !n.read).length;

    const renderContent = () => {
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
                    SportsVault
                </div>
                <div className="header-location">
                    <span>📍</span>
                    <span>{state.currentUser?.location || 'Mumbai'}</span>
                </div>
            </header>

            {/* Content */}
            <main className="page-content">
                <div className="container">
                    {renderContent()}
                </div>
            </main>

            {/* Bottom Navigation */}
            <nav className="bottom-nav">
                <button className={`nav-item ${activeTab === 'discover' ? 'active' : ''}`} onClick={() => navigate('discover')}>
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
                    {unreadCount > 0 && <span className="badge-count">{unreadCount}</span>}
                </button>
                <button className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => navigate('profile')}>
                    <span className="nav-icon">👤</span>
                    <span className="nav-label">Profile</span>
                </button>
            </nav>
        </div>
    );
}
