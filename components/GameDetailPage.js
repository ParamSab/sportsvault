'use client';
import { useState, useMemo, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { SPORTS, POSITIONS, getPlayer, getSportEmoji, spotsLeft, formatDate, getInitials, getTrustTier } from '@/lib/mockData';
import { balanceTeams, generateWhatsAppMessage, getWhatsAppUrl } from '@/lib/teamBalancer';

const PRIVACY_LABELS = {
    public: { emoji: '🌍', label: 'Public', color: '#22c55e' },
    friends: { emoji: '👥', label: 'Friends Only', color: '#3b82f6' },
    private: { emoji: '🔒', label: 'Private', color: '#a855f7' },
};

export default function GameDetailPage({ gameId, onBack, onViewProfile }) {
    const { state, dispatch } = useStore();
    const [selectedPosition, setSelectedPosition] = useState('');
    const [showTeams, setShowTeams] = useState(false);
    const [showBroadcastPanel, setShowBroadcastPanel] = useState(false);
    
    const isGuest = !state.isAuthenticated;
    const [broadcastTier, setBroadcastTier] = useState(null);
    const [broadcastStatus, setBroadcastStatus] = useState(null); // null | 'sending' | 'sent' | 'error'
    const [broadcastResult, setBroadcastResult] = useState(null);
    const [nudgedPlayers, setNudgedPlayers] = useState(new Set());

    const [notFound, setNotFound] = useState(false);
    const [msgCopied, setMsgCopied] = useState(false);      // MUST be before any early return
    const game = state.games.find(g => g.id === gameId);

    useEffect(() => {
        if (!game && state.isLoaded && !notFound) {
            fetch(`/api/games/${gameId}`)
                .then(r => r.json())
                .then(d => {
                    if (d.game) {
                        dispatch({ type: 'LOAD_STATE', payload: { games: [...state.games, d.game] } });
                    } else {
                        setNotFound(true);
                    }
                })
                .catch(e => {
                    console.error('Failed fetching individual game:', e);
                    setNotFound(true);
                });
        }
    }, [gameId, game, state.isLoaded, notFound, dispatch, state.games]);

    // All useMemo hooks MUST be before any early return (Rules of Hooks)
    const confirmedPlayers = useMemo(() => {
        if (!game) return [];
        const currentUserId = state.currentUser?.dbId || state.currentUser?.id || 'current';
        return (game.rsvps || [])
            .filter(r => r.status === 'yes' || r.status === 'checked_in')
            .map(r => {
                const p = r.player || getPlayer(r.playerId) || state.players?.find(pl => pl.id === r.playerId) || (r.playerId === currentUserId ? state.currentUser : null);
                return p ? { ...p, rsvpPosition: r.position || r.rsvpPosition } : null;
            }).filter(Boolean);
    }, [game, state.currentUser, state.players]);

    const teams = useMemo(() => {
        if (!game || confirmedPlayers.length < 4) return null;
        return balanceTeams(confirmedPlayers, game.sport);
    }, [confirmedPlayers, game]);

    const friendsInTiers = useMemo(() => {
        const tiers = { 1: [], 2: [], 3: [] };
        if (!game || !state.friendTiers || !state.friends) return tiers;
        state.friends.forEach(fId => {
            const t = state.friendTiers[fId]?.[game.sport];
            if (t) {
                const p = getPlayer(fId) || state.players?.find(pl => pl.id === fId);
                if (p) tiers[t].push(p);
            }
        });
        return tiers;
    }, [game, state.friendTiers, state.friends, state.players]);

    const amenList = useMemo(() => {
        if (!game) return [];
        try {
            return typeof game.amenities === 'string' ? JSON.parse(game.amenities) : (game.amenities || []);
        } catch { return []; }
    }, [game]);

    if (!game) {
        if (!state.isLoaded || (!notFound && state.isLoaded)) {
            return (
                <div className="glass-card no-hover text-center" style={{ padding: 48 }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                    <h3>Loading game details...</h3>
                </div>
            );
        }
        return <div className="glass-card no-hover text-center" style={{ padding: 48 }}><h3>Game not found</h3><button className="btn btn-outline mt-md" onClick={onBack}>← Back</button></div>;
    }

    const sport = SPORTS[game.sport] || { name: 'Unknown', emoji: '🏅', color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)' };
    const confirmedRsvps = (game.rsvps || []).filter(r => r.status === 'yes' || r.status === 'checked_in');
    const backupRsvps = (game.rsvps || []).filter(r => r.status === 'backup');
    const maybeRsvps = (game.rsvps || []).filter(r => r.status === 'maybe');
    const pendingRsvps = (game.rsvps || []).filter(r => r.status === 'pending');
    const spots = spotsLeft(game);
    const currentUserId = state.currentUser?.dbId || state.currentUser?.id || 'current';
    const myRsvp = (game.rsvps || []).find(r => r.playerId === currentUserId);
    const organizerId = game.organizerId || game.organizer?.id || game.organizer;
    const isOrganizer = organizerId === currentUserId;
    const privacyInfo = PRIVACY_LABELS[game.visibility || 'public'] || PRIVACY_LABELS.public;

    const handleRSVP = async (status) => {
        let finalStatus = status;

        // Check dropout penalty
        if ((myRsvp?.status === 'yes' || myRsvp?.status === 'checked_in') && status === 'no') {
            const gameStart = new Date(`${game.date}T${game.time || '00:00'}`);
            const hoursUntil = (gameStart - new Date()) / (1000 * 60 * 60);
            if (hoursUntil < 24 && hoursUntil > 0) {
                if (!window.confirm("Dropping out within 24 hours of the game will negatively affect your Reliability Score. Are you sure you want to drop out?")) {
                    return;
                }
            }
        }

        if (status === 'yes') {
            if (spots <= 0 && myRsvp?.status !== 'yes' && myRsvp?.status !== 'checked_in') {
                finalStatus = 'backup';
            } else if (game.approvalRequired && !isOrganizer && myRsvp?.status !== 'yes' && myRsvp?.status !== 'checked_in') {
                finalStatus = 'pending';
            }
        }

        const pos = selectedPosition || state.currentUser?.positions?.[game.sport] || POSITIONS[game.sport]?.[0] || '';
        dispatch({ type: 'RSVP', payload: { gameId, playerId: currentUserId, status: finalStatus, position: pos } });
        
        // Persist to DB using session
        try {
            await fetch('/api/games/rsvp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    gameId, 
                    playerId: state.currentUser?.dbId || state.currentUser?.id, 
                    status: finalStatus, 
                    position: pos 
                }),
            });
        } catch (err) {
            console.error('RSVP persistence failed:', err);
        }
    };

    const selectedTierPlayers = broadcastTier ? friendsInTiers[broadcastTier] : [];
    const validRecipients = selectedTierPlayers.filter(p => p.phone && p.phone.trim());

    const getYesButtonText = () => {
        if (myRsvp?.status === 'yes') return '✅ Yes!';
        if (myRsvp?.status === 'checked_in') return '🏟️ Checked In';
        if (myRsvp?.status === 'pending') return '⏳ Requested';
        if (myRsvp?.status !== 'yes' && myRsvp?.status !== 'checked_in' && spots <= 0) return '📝 Join Waitlist';
        if (myRsvp?.status !== 'yes' && myRsvp?.status !== 'checked_in' && game.approvalRequired) return '✋ Request to Join';
        return '✅ Yes';
    };

    const handleHostAction = async (playerId, status) => {
        const existingRsvp = (game.rsvps || []).find(r => r.playerId === playerId);
        const pos = existingRsvp?.position || '';
        
        // Use either dbId or the id from the player object
        const p = state.players?.find(pl => pl.id === playerId);
        const actualPlayerId = p?.dbId || p?.id || playerId;
        
        dispatch({ type: 'RSVP', payload: { gameId, playerId: actualPlayerId, status, position: pos } });

        try {
            await fetch('/api/games/rsvp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameId, playerId: actualPlayerId, status, position: pos })
            });
            // Send immediate reminder if RSVP approved
            if (status === 'yes') {
              fetch('/api/games/reminder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameId, playerId: actualPlayerId })
              }).catch(err => console.error('Reminder send failed:', err));
            }
        } catch (err) {
            console.error('Host action persistence failed:', err);
        }
        
        // Refresh game data to reflect updated RSVP status
        try {
          const res = await fetch(`/api/games/${gameId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.game) {
                dispatch({ type: 'LOAD_STATE', payload: { games: state.games.map(g => g.id === gameId ? data.game : g) } });
            }
          }
        } catch (refreshErr) {
          console.error('Failed to refresh game after host action:', refreshErr);
        }
    };
    
    const buildBlastMessage = () => {
        const inviteLink = `${window.location.origin}/?game=${game.id}`;
        const mapLine = game.lat && game.lng ? `\nhttps://maps.google.com/?q=${game.lat},${game.lng}` : '';
        return (
            `Hey! ${state.currentUser?.name || 'Your friend'} is organising a ` +
            `${game.format} ${SPORTS[game.sport]?.name} game 🏆\n\n` +
            `📅 ${formatDate(game.date)} at ${game.time}\n` +
            `📍 ${game.location}${mapLine}\n\n` +
            `RSVP here 👉 ${inviteLink}`
        );
    };

    const handleCopyMessage = async () => {
        try {
            await navigator.clipboard.writeText(buildBlastMessage());
            setMsgCopied(true);
            setTimeout(() => setMsgCopied(false), 3000);
        } catch { alert('Copy failed — please copy the message manually'); }
    };

    const handleSingleSMS = (phone) => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const sep = isIOS ? '&' : '?';
        window.location.href = `sms:${phone}${sep}body=${encodeURIComponent(buildBlastMessage())}`;
    };

    const handleSingleWhatsApp = (phone) => {
        const clean = phone.replace(/[^0-9]/g, '');
        window.open(`https://wa.me/${clean}?text=${encodeURIComponent(buildBlastMessage())}`, '_blank');
    };

    const resetBroadcast = () => {
        setShowBroadcastPanel(false);
        setBroadcastTier(null);
        setBroadcastStatus(null);
        setBroadcastResult(null);
    };

    let whatsappMsg = '';
    try {
        whatsappMsg = generateWhatsAppMessage(game, state.players, showTeams ? teams : null);
    } catch (e) {
        console.error('WhatsApp msg generation failed:', e);
    }



    return (
        <div className="animate-fade-in">
            <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 12, padding: '8px 0' }}>
                ← Back to games
            </button>

            {/* Hero */}
            <div className="glass-card no-hover" style={{ overflow: 'hidden', padding: 0, marginBottom: 16 }}>
                <div style={{ height: 110, background: sport?.gradient, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '3rem', opacity: 0.25, position: 'absolute' }}>{sport?.emoji}</span>
                    <div style={{ position: 'relative', textAlign: 'center' }}>
                        <span className={`sport-badge ${game.sport}`} style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', marginBottom: 8, display: 'inline-flex' }}>
                            {sport?.emoji} {game.format}
                        </span>
                    </div>
                    {/* Privacy & Price badge */}
                    <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6 }}>
                        <div style={{
                            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
                            borderRadius: 99, padding: '4px 10px', fontSize: '0.7rem', fontWeight: 700,
                            color: privacyInfo.color, border: `1px solid ${privacyInfo.color}40`,
                        }}>
                            {privacyInfo.emoji} {privacyInfo.label}
                        </div>
                        {game.price > 0 && (
                            <div style={{
                                background: 'rgba(34,197,94,0.2)', backdropFilter: 'blur(8px)',
                                borderRadius: 99, padding: '4px 10px', fontSize: '0.7rem', fontWeight: 700,
                                color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)',
                            }}>
                                Rs.{game.price}
                            </div>
                        )}
                    </div>
                </div>
                <div style={{ padding: 20 }}>
                    <h2 style={{ marginBottom: 16 }}>{game.title}</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: '1.125rem' }}>📍</span>
                            <div><div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{game.location}</div><div className="text-xs text-muted">{game.address}</div></div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: '1.125rem' }}>📅</span>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{formatDate(game.date)}</div>
                                <div className="text-xs text-muted">🕐 {game.time} · ⏱️ {game.duration} mins</div>
                            </div>
                        </div>
                        
                        {/* New Spec Bar */}
                        <div style={{ 
                            display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4, padding: '12px 14px', 
                            background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' 
                        }}>
                            <div className="text-xs" style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
                                🏟️ <span style={{ fontWeight: 600 }}>{game.pitchType || 'Game'}</span>
                            </div>
                            <span style={{ opacity: 0.2 }}>|</span>
                            <div className="text-xs" style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
                                🌱 <span style={{ fontWeight: 600 }}>{game.surface || 'Turf'}</span>
                            </div>
                            <span style={{ opacity: 0.2 }}>|</span>
                            <div className="text-xs" style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
                                👟 <span style={{ fontWeight: 600 }}>{game.footwear || 'Any'}</span>
                            </div>
                            <span style={{ opacity: 0.2 }}>|</span>
                            <div className="text-xs" style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
                                👥 <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{game.gender || 'Mixed'}</span>
                            </div>
                        </div>

                        {amenList.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                {amenList.map(a => (
                                    <span key={a} style={{ fontSize: '0.65rem', padding: '3px 8px', borderRadius: 99, background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                        {a === 'Bibs' ? '🎽' : a === 'Water' ? '💧' : a === 'Shower' ? '🚿' : '✅'} {a}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                            <span style={{ fontSize: '1.125rem' }}>👤</span>
                        <span className="text-sm">Organized by <span style={{ fontWeight: 600, color: sport?.color, cursor: 'pointer' }} onClick={() => onViewProfile(organizerId)}>{(game.organizer?.name || getPlayer(organizerId)?.name || state.currentUser?.name || 'You')}</span></span>
                        </div>
                    </div>
                </div>

                {game.bookingImage && (
                    <div style={{ margin: '0 20px 20px 20px', padding: 16, background: 'var(--bg-input)', borderRadius: 16, border: '1px solid var(--border-color)' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                            📜 Booking Receipt
                        </div>
                        <img 
                            src={game.bookingImage} 
                            style={{ width: '100%', borderRadius: 12, border: '1px solid var(--border-color)', pointerEvents: 'none' }} 
                            alt="Booking Proof" 
                        />
                    </div>
                )}
                
                {/* Embedded Mini-Map */}
                {game.lat && game.lng && (
                    <div style={{ height: 130, borderTop: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                        <iframe title="game-location" width="100%" height="100%" frameBorder="0" style={{ border: 0, opacity: 0.9, pointerEvents: 'none' }}
                            src={`https://maps.google.com/maps?q=${game.lat},${game.lng}&z=15&output=embed`} />
                    </div>
                )}
            </div>

            {/* Position selector */}
            <div style={{ marginBottom: 16 }}>
                <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Select your position</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(POSITIONS[game.sport] || []).map(pos => (
                        <button key={pos} onClick={() => setSelectedPosition(pos)} className="chip"
                            style={{
                                background: (selectedPosition || myRsvp?.position) === pos ? `${sport?.color}25` : undefined,
                                borderColor: (selectedPosition || myRsvp?.position) === pos ? sport?.color : undefined,
                                color: (selectedPosition || myRsvp?.position) === pos ? sport?.color : undefined,
                                fontSize: '0.75rem', padding: '6px 12px',
                            }}>
                            {pos}
                        </button>
                    ))}
                </div>
            </div>

            {/* RSVP / Join Section */}
            {isGuest ? (
                <div className="glass-card no-hover text-center animate-fade-in" style={{ padding: 24, marginBottom: 16, border: '1px dashed var(--primary-color)' }}>
                   <p className="text-sm text-muted" style={{ marginBottom: 16 }}>Want to join this game?</p>
                   <button className="btn btn-primary btn-block btn-lg" onClick={() => onViewProfile('login_prompt')}>
                       Log in to RSVP →
                   </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                    <button className={`btn btn-sm ${(myRsvp?.status === 'yes' || myRsvp?.status === 'checked_in' || myRsvp?.status === 'pending') ? 'btn-rsvp-yes' : 'btn-outline'}`} onClick={() => handleRSVP('yes')}>
                        {getYesButtonText()}
                    </button>
                    <button className={`btn btn-sm ${myRsvp?.status === 'backup' ? 'btn-primary' : 'btn-outline'}`} onClick={() => handleRSVP('backup')}>
                        ⏳ Backup
                    </button>
                    <button className={`btn btn-sm ${myRsvp?.status === 'maybe' ? 'btn-rsvp-maybe' : 'btn-outline'}`} onClick={() => handleRSVP('maybe')}>
                        🤔 Maybe
                    </button>
                    <button className={`btn btn-sm ${myRsvp?.status === 'no' ? 'btn-rsvp-no' : 'btn-outline'}`} onClick={() => handleRSVP('no')}>
                        ❌ No
                    </button>
                </div>
            )}

            
            {/* Host Approvals */}
            {isOrganizer && pendingRsvps.length > 0 && (
                <div className="glass-card no-hover animate-fade-in" style={{ marginBottom: 16, border: '1px solid var(--warning)' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 12, color: 'var(--warning)' }}>
                        ✋ Pending Approvals ({pendingRsvps.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {pendingRsvps.map(r => {
                            const p = r.player || getPlayer(r.playerId) || state.players?.find(pl => pl.id === r.playerId) || (r.playerId === currentUserId ? state.currentUser : null);
                            if (!p) return null;
                            return (
                                <div key={r.playerId} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-body)', padding: '10px 12px', borderRadius: 8 }}>
                                    <div className="avatar" style={{ width: 32, height: 32, background: p.photo ? `url(${p.photo}) center/cover` : undefined, fontSize: p.photo ? '0' : '0.6875rem' }}>
                                        {p.photo ? '' : getInitials(p?.name || 'Unknown')}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.name}</div>
                                        {p.ratings?.[game.sport]?.count >= 10 && <div className="text-xs text-muted">⭐ {p.ratings[game.sport].overall} Reliability</div>}
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)', padding: '4px 8px' }} onClick={() => handleHostAction(r.playerId, 'no')}>Deny</button>
                                        <button className="btn btn-sm btn-primary" style={{ padding: '4px 12px' }} onClick={() => handleHostAction(r.playerId, 'yes')} disabled={spots <= 0}>Accept</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Attendee Lists */}
            <div className="glass-card no-hover" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Players ({confirmedRsvps.length}/{game.maxPlayers})</h3>
                    <span style={{
                        background: spots <= 2 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                        color: spots <= 2 ? '#ef4444' : '#22c55e',
                        padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 800,
                        border: `1px solid ${spots <= 2 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`
                    }}>
                        {spots} SPOT{spots !== 1 ? 'S' : ''} LEFT
                    </span>
                </div>

                {confirmedRsvps.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                            <div className="text-xs font-semibold" style={{ color: '#22c55e', letterSpacing: '0.5px' }}>✅ GOING ({confirmedRsvps.length})</div>
                            {isOrganizer && confirmedRsvps.length > 1 && (
                                <button className="btn btn-xs btn-outline"
                                    style={{ fontSize: '0.65rem', padding: '4px 10px', color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }}
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        const unCheckedIn = confirmedRsvps.filter(r => r.playerId !== currentUserId && r.status !== 'checked_in' && !nudgedPlayers.has(r.playerId));
                                        if (unCheckedIn.length === 0) return alert('All players are checked in or have already been nudged!');
                                        if (!window.confirm(`Send an automated nudge SMS to ${unCheckedIn.length} unchecked players?`)) return;
                                        
                                        let sentCount = 0;
                                        let failedTwilio = false;
                                        await Promise.all(unCheckedIn.map(async r => {
                                            const res = await fetch('/api/games/reminder', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ gameId: game.id, playerId: r.playerId, type: 'nudge' })
                                            });
                                            const data = await res.json();
                                            setNudgedPlayers(prev => { const next = new Set(prev); next.add(r.playerId); return next; });
                                            if (data.success) sentCount++;
                                            else if (data.reason === 'Twilio not configured') failedTwilio = true;
                                        }));
                                        if (failedTwilio) {
                                            alert('SMS not configured. Ask your admin to add Twilio credentials.');
                                        } else {
                                            alert(`🔔 Nudges sent via SMS to ${sentCount} player${sentCount !== 1 ? 's' : ''}!`);
                                        }
                                    }}
                                >
                                    Nudge All ({confirmedRsvps.filter(r => r.playerId !== currentUserId && r.status !== 'checked_in' && !nudgedPlayers.has(r.playerId)).length})
                                </button>
                            )}
                        </div>
                        {confirmedRsvps.map(r => {
                            const p = r.player || getPlayer(r.playerId) || state.players?.find(pl => pl.id === r.playerId) || (r.playerId === currentUserId ? state.currentUser : null);
                            if (!p) return null;
                            return (
                                <div key={r.playerId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                                    <div className="avatar avatar-sm" style={{ borderColor: sport?.color, cursor: 'pointer', background: p.photo ? `url(${p.photo}) center/cover` : undefined, fontSize: p.photo ? '0' : undefined }} onClick={() => onViewProfile(r.playerId)}>
                                        {p.photo ? '' : getInitials(p?.name || 'Unknown')}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }} onClick={() => onViewProfile(r.playerId)}>{p.name}</div>
                                        <div className="text-xs text-muted">{r.position || r.rsvpPosition}</div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        {!(state.friends || []).includes(r.playerId) && !(state.pendingFriends || []).includes(r.playerId) && r.playerId !== currentUserId && state.isAuthenticated && (
                                            <button 
                                                className="btn btn-xs btn-outline"
                                                style={{ fontSize: '0.65rem', padding: '4px 8px' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleFriendRequest(r.playerId);
                                                }}
                                            >
                                                + Friend
                                            </button>
                                        )}
                                        {((state.pendingFriends || []).includes(r.playerId) && r.playerId !== currentUserId) && (
                                            <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Sent ✓</span>
                                        )}
                                        {isOrganizer && r.playerId !== currentUserId && (
                                            <button 
                                                className="btn btn-xs btn-ghost" 
                                                style={{ color: nudgedPlayers.has(r.playerId) ? 'var(--text-muted)' : 'var(--primary-color)', fontSize: '0.65rem', padding: '4px 8px' }}
                                                disabled={nudgedPlayers.has(r.playerId)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    fetch('/api/games/reminder', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ gameId: game.id, playerId: r.playerId, type: 'nudge' })
                                                    }).then(res => res.json()).then(data => {
                                                        if (data.success) {
                                                            alert('Nudge sent via SMS!');
                                                        } else if (data.reason === 'Twilio not configured') {
                                                            alert('SMS not configured. Ask your admin to add Twilio credentials in settings.');
                                                        } else {
                                                            alert(data.error || 'Could not send nudge');
                                                        }
                                                        setNudgedPlayers(prev => { const next = new Set(prev); next.add(r.playerId); return next; });
                                                    });
                                                }}
                                            >
                                                {nudgedPlayers.has(r.playerId) ? '🔔 Sent' : '🔔 Nudge'}
                                            </button>
                                        )}

                                        {p.ratings?.[game.sport]?.count >= 10 && (
                                            <span className="text-xs" style={{ color: 'var(--warning)' }}>
                                                ⭐ {p.ratings[game.sport].overall}
                                            </span>
                                        )}

                                        {isOrganizer && r.status !== 'checked_in' && (
                                            <button 
                                                className="btn btn-sm btn-outline" 
                                                style={{ padding: '4px 10px', fontSize: '0.7rem' }} 
                                                onClick={() => handleHostAction(r.playerId, 'checked_in')}
                                            >
                                                Check In
                                            </button>
                                        )}

                                        {r.status === 'checked_in' && (
                                            <span className="text-xs" style={{ color: 'var(--success)', fontWeight: 700, padding: '4px 8px', background: 'rgba(34,197,94,0.1)', borderRadius: 4 }}>
                                                ✓ Checked In
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {backupRsvps.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <div className="text-xs font-semibold" style={{ color: '#3b82f6', letterSpacing: '0.5px', marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>⏳ BACKUP ({backupRsvps.length})</div>
                        {backupRsvps.map(r => {
                            const p = getPlayer(r.playerId) || state.players?.find(pl => pl.id === r.playerId);
                            if (!p) return null;
                            return (
                                <div key={r.playerId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', opacity: 0.85 }}>
                                    <div className="avatar avatar-sm" style={{ cursor: 'pointer', background: p.photo ? `url(${p.photo}) center/cover` : undefined, fontSize: p.photo ? '0' : undefined }} onClick={() => onViewProfile(r.playerId)}>
                                        {p.photo ? '' : getInitials(p.name)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{p.name}</div>
                                        <div className="text-xs text-muted">{r.position}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        {!(state.friends || []).includes(r.playerId) && !(state.pendingFriends || []).includes(r.playerId) && r.playerId !== currentUserId && state.isAuthenticated && (
                                            <button 
                                                className="btn btn-xs btn-outline"
                                                style={{ fontSize: '0.65rem', padding: '4px 8px' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleFriendRequest(r.playerId);
                                                }}
                                            >
                                                + Friend
                                            </button>
                                        )}
                                        {((state.pendingFriends || []).includes(r.playerId) && r.playerId !== currentUserId) && (
                                            <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Sent ✓</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {maybeRsvps.length > 0 && (
                    <div>
                        <div className="text-xs font-semibold" style={{ color: '#eab308', letterSpacing: '0.5px', marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>🤔 MAYBE ({maybeRsvps.length})</div>
                        {maybeRsvps.map(r => {
                            const p = getPlayer(r.playerId) || state.players?.find(pl => pl.id === r.playerId);
                            if (!p) return null;
                            return (
                                <div key={r.playerId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', opacity: 0.7 }}>
                                    <div className="avatar avatar-sm" style={{ background: p.photo ? `url(${p.photo}) center/cover` : undefined, fontSize: p.photo ? '0' : undefined }}>
                                        {p.photo ? '' : getInitials(p.name)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{p.name}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Auto Team Balancer */}
            {teams && (
                <div className="glass-card no-hover" style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ fontSize: '1rem' }}>🤖 Auto-Balanced Teams</h3>
                        <button className="btn btn-sm btn-outline" onClick={() => setShowTeams(!showTeams)}>{showTeams ? 'Hide' : 'Show'}</button>
                    </div>
                    {showTeams && (
                        <div className="animate-fade-in">
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
                                <span className="text-xs text-muted">Rating diff: </span>
                                <span className="text-xs" style={{ color: teams.ratingDiff < 0.3 ? 'var(--success)' : 'var(--warning)', fontWeight: 700 }}>
                                    {teams.ratingDiff.toFixed(1)} ⭐ {teams.ratingDiff < 0.3 ? '(Great balance!)' : '(Acceptable)'}
                                </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                {['team1', 'team2'].map((t, ti) => (
                                    <div key={t} style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: 8, color: ti === 0 ? '#3b82f6' : '#ef4444' }}>
                                            Team {ti + 1} <span className="text-muted" style={{ fontWeight: 400 }}>({teams[`${t}Avg`]}⭐)</span>
                                        </div>
                                        {teams[t].map(p => (
                                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: '0.8125rem' }}>
                                                <div className="avatar" style={{ width: 24, height: 24, borderWidth: 1, background: p.photo ? `url(${p.photo}) center/cover` : undefined, fontSize: p.photo ? '0' : '0.5625rem' }}>
                                                    {p.photo ? '' : getInitials(p.name)}
                                                </div>
                                                <span style={{ flex: 1 }}>{p.name.split(' ')[0]}</span>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Actions: Text Blast + WhatsApp */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                {isOrganizer && (
                    <div className="glass-card no-hover" style={{ padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <span style={{ fontSize: '1.25rem' }}>📱</span>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1rem' }}>Text Blast</div>
                                <div className="text-xs text-muted">Send to your priority list — Partiful style</div>
                            </div>
                        </div>

                        {!showBroadcastPanel && broadcastStatus !== 'sent' && (
                            <button className="btn btn-block btn-primary" onClick={() => setShowBroadcastPanel(true)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                🚀 Launch Text Blast
                            </button>
                        )}

                        {showBroadcastPanel && broadcastStatus === null && (
                            <div className="animate-fade-in">
                                {/* Step 1: Pick tier */}
                                {!broadcastTier && (
                                    <>
                                        <p className="text-xs text-muted" style={{ marginBottom: 12, textAlign: 'center' }}>
                                            Pick a <b>{SPORTS[game.sport]?.name}</b> priority list to blast:
                                        </p>
                
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {[1, 2, 3].map(tier => {
                                                const players = friendsInTiers[tier];
                                                const hasPhones = players.filter(p => p.phone).length;
                                                return (
                                                    <button key={tier} disabled={players.length === 0}
                                                        onClick={() => setBroadcastTier(tier)}
                                                        className="btn btn-outline btn-sm"
                                                        style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', opacity: players.length === 0 ? 0.4 : 1 }}>
                                                        <span style={{ fontWeight: 600 }}>🎯 Tier {tier} List</span>
                                                        <span className="text-muted">{players.length} friends · {hasPhones} with numbers</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 8 }} onClick={resetBroadcast}>Cancel</button>
                                    </>
                                )}

                                {/* Step 2: Per-contact actions */}
                                {broadcastTier && (
                                    <div className="animate-fade-in">
                                        {/* Message preview + Copy */}
                                        <div style={{ background: 'var(--bg-input)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 12 }}>
                                                {buildBlastMessage()}
                                            </div>
                                            <button onClick={handleCopyMessage}
                                                style={{
                                                    width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                                                    background: msgCopied ? 'rgba(34,197,94,0.2)' : 'rgba(99,102,241,0.2)',
                                                    color: msgCopied ? '#22c55e' : '#818cf8',
                                                    fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.3s',
                                                }}>
                                                {msgCopied ? '✓ Copied! Now paste in any chat' : '📋 Copy Message'}
                                            </button>
                                        </div>

                                        {/* Per-contact buttons */}
                                        <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 10, color: 'var(--text-secondary)' }}>
                                            📬 Send individually ({selectedTierPlayers.length} contacts)
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                                            {selectedTierPlayers.map(p => (
                                                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                                                    <div className="avatar" style={{ width: 32, height: 32, borderWidth: 1, flexShrink: 0, background: p.photo ? `url(${p.photo}) center/cover` : undefined, fontSize: p.photo ? '0' : '0.6875rem' }}>
                                                        {p.photo ? '' : getInitials(p.name)}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.name}</div>
                                                        <div className="text-xs text-muted">{p.phone || 'No number saved'}</div>
                                                    </div>
                                                    {p.phone ? (
                                                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                                            <button onClick={() => handleSingleSMS(p.phone)}
                                                                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1rem' }}
                                                                title="Send SMS">
                                                                💬
                                                            </button>
                                                            <button onClick={() => handleSingleWhatsApp(p.phone)}
                                                                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(37,211,102,0.3)', background: 'rgba(37,211,102,0.1)', color: '#25D366', cursor: 'pointer', fontSize: '1rem' }}
                                                                title="Send WhatsApp">
                                                                📱
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs" style={{ color: '#ef4444', flexShrink: 0 }}>No number</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <button className="btn btn-outline btn-sm btn-block" onClick={() => setBroadcastTier(null)}>← Change tier</button>
                                    </div>
                                )}
                            </div>
                        )}



                        {/* Success state */}
                        {broadcastStatus === 'sent' && broadcastResult && (
                            <div className="animate-fade-in" style={{ textAlign: 'center', padding: '12px 0' }}>
                                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎉</div>
                                <div style={{ fontWeight: 700, color: '#22c55e', fontSize: '1.1rem' }}>
                                    Text Blast sent!
                                </div>
                                <div className="text-sm text-muted" style={{ marginTop: 6 }}>
                                    ✅ {broadcastResult.sent} sent{broadcastResult.failed > 0 ? ` · ⚠️ ${broadcastResult.failed} failed` : ''}
                                </div>
                                <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={resetBroadcast}>Send another</button>
                            </div>
                        )}

                        {/* Error state */}
                        {broadcastStatus === 'error' && (
                            <div className="animate-fade-in" style={{ textAlign: 'center', padding: '12px 0' }}>
                                <div style={{ fontSize: '2rem', marginBottom: 8 }}>⚠️</div>
                                <div style={{ fontWeight: 700, color: '#ef4444' }}>Broadcast failed</div>
                                <div className="text-xs text-muted" style={{ marginTop: 6 }}>{broadcastResult?.error}</div>
                                <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={resetBroadcast}>Try again</button>
                            </div>
                        )}
                    </div>
                )}

                {/* WhatsApp Share */}
                <a href={getWhatsAppUrl(whatsappMsg)} target="_blank" rel="noopener noreferrer" className="btn btn-block"
                    style={{ background: '#25D366', color: '#fff', padding: '14px 24px', fontSize: '0.9375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 'var(--radius-full)', textDecoration: 'none' }}>
                    📤 Share on WhatsApp
                </a>

                {/* Delete Game (Organizer Only) */}
                {isOrganizer && (
                    <button 
                        className="btn btn-block btn-outline" 
                        style={{ marginTop: 12, color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}
                        onClick={async () => {
                            if (window.confirm("Are you sure you want to delete this game? This cannot be undone.")) {
                                try {
                                    const res = await fetch(`/api/games/${game.id}`, { method: 'DELETE' });
                                    if (res.ok) {
                                        dispatch({ type: 'LOAD_STATE', payload: { games: state.games.filter(g => g.id !== game.id) } });
                                        onBack();
                                    } else {
                                        alert("Failed to delete game");
                                    }
                                } catch (e) {
                                    alert("Error deleting game");
                                }
                            }
                        }}
                    >
                        🗑️ Delete Game
                    </button>
                )}
            </div>
        </div>
    );
}
