'use client';
import { useStore } from '@/lib/store';
import { SPORTS, getPlayer, getInitials, getTrustTier, getPlayerGames, formatDate, TRUST_TIERS } from '@/lib/mockData';

export default function SportsCVPage({ playerId, onBack }) {
    const { state } = useStore();

    const player = getPlayer(playerId) || state.players.find(p => p.id === playerId) || state.currentUser;
    if (!player) return <div className="glass-card no-hover text-center" style={{ padding: 48 }}><h3>Player not found</h3></div>;

    const trust = getTrustTier(player.trustScore || 0);
    const playerGames = getPlayerGames(player.id);
    const pastGames = playerGames.filter(g => g.status === 'completed');
    const upcomingGames = playerGames.filter(g => g.status === 'open');

    const positionsPlayed = {};
    playerGames.forEach(g => {
        const rsvp = g.rsvps.find(r => r.playerId === player.id);
        if (rsvp) {
            const key = `${g.sport}-${rsvp.position}`;
            positionsPlayed[key] = (positionsPlayed[key] || 0) + 1;
        }
    });

    const milestones = [];
    if (player.gamesPlayed >= 50) milestones.push({ icon: '🏆', text: '50 Games Club', desc: 'Played 50+ games' });
    if (player.gamesPlayed >= 25) milestones.push({ icon: '⭐', text: '25 Games Milestone', desc: 'Quarter century of games' });
    if (player.gamesPlayed >= 10) milestones.push({ icon: '🎯', text: '10 Games Starter', desc: 'First 10 games completed' });
    if (player.trustScore >= 85) milestones.push({ icon: '🛡️', text: 'Platinum Trust', desc: 'Achieved Platinum tier trust' });
    else if (player.trustScore >= 65) milestones.push({ icon: '🥇', text: 'Gold Trust', desc: 'Achieved Gold tier trust' });
    if (player.wins >= 20) milestones.push({ icon: '🔥', text: '20 Wins', desc: 'Twenty victories secured' });
    if ((player.sports || []).length >= 3) milestones.push({ icon: '🏅', text: 'Multi-Sport Athlete', desc: 'Plays 3+ sports' });

    const handlePrint = () => {
        window.print();
    };

    const handleShare = () => {
        const url = window.location.href;
        if (navigator.share) {
            navigator.share({ title: `${player.name}'s Sports CV`, url });
        } else {
            navigator.clipboard?.writeText(`${player.name}'s Sports CV: ${url}`);
        }
    };

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 0' }}>
                    ← Back
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-outline" onClick={handleShare}>🔗 Share</button>
                    <button className="btn btn-sm btn-primary" onClick={handlePrint}>📄 PDF</button>
                </div>
            </div>

            {/* CV Header */}
            <div className="cv-header" style={{
                background: 'linear-gradient(135deg, #0f1629, #1a1f35, #252b45)',
                border: '1px solid var(--border-color)',
            }}>
                <div className="avatar avatar-xl" style={{
                    margin: '0 auto 16px', borderColor: trust.color,
                    background: `linear-gradient(135deg, ${trust.color}30, var(--bg-card))`,
                    fontSize: '1.75rem',
                }}>
                    {getInitials(player.name)}
                </div>
                <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>{player.name}</h1>
                <p className="text-muted">📍 {player.location}</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                    {(player.sports || []).map(s => (
                        <span key={s} className={`sport-badge ${s}`}>{SPORTS[s]?.emoji} {SPORTS[s]?.name}</span>
                    ))}
                </div>
                <p className="text-xs text-muted" style={{ marginTop: 12 }}>Member since {player.joined}</p>
            </div>

            {/* Stats Overview */}
            <div className="cv-section glass-card no-hover">
                <h3 style={{ marginBottom: 16 }}>📊 Career Statistics</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {[
                        { label: 'Games', value: player.gamesPlayed, color: 'var(--text-primary)' },
                        { label: 'Wins', value: player.wins, color: 'var(--success)' },
                        { label: 'Losses', value: player.losses, color: 'var(--danger)' },
                        { label: 'Win Rate', value: player.gamesPlayed ? `${Math.round((player.wins / player.gamesPlayed) * 100)}%` : '0%', color: 'var(--info)' },
                    ].map(stat => (
                        <div key={stat.label} style={{ textAlign: 'center', padding: 12, background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontWeight: 800, fontSize: '1.25rem', color: stat.color }}>{stat.value}</div>
                            <div className="text-xs text-muted">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Trust Score */}
            <div className="cv-section glass-card no-hover">
                <h3 style={{ marginBottom: 16 }}>🛡️ Trust & Reliability</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                    <div style={{
                        width: 72, height: 72, borderRadius: '50%',
                        background: `conic-gradient(${trust.color} ${player.trustScore}%, var(--bg-input) 0)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <div style={{
                            width: 58, height: 58, borderRadius: '50%', background: 'var(--bg-card)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, fontSize: '1.125rem', color: trust.color,
                        }}>
                            {player.trustScore}
                        </div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '1.125rem', color: trust.color }}>{trust.name}</div>
                        <div className="text-xs text-muted">Consistency · Attendance · Community</div>
                        {/* Trust bar progression */}
                        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                            {TRUST_TIERS.map(tier => (
                                <div key={tier.name} style={{
                                    width: 24, height: 6, borderRadius: 3,
                                    background: player.trustScore >= tier.min ? tier.color : 'var(--bg-input)',
                                    transition: 'background 0.3s ease',
                                }} title={tier.name} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Skill Ratings */}
            {(player.sports || []).map(sport => {
                const rating = player.ratings?.[sport];
                const hasRating = rating && rating.count >= 10;
                return (
                    <div key={sport} className="cv-section glass-card no-hover">
                        <h3 style={{ marginBottom: 16 }}>{SPORTS[sport]?.emoji} {SPORTS[sport]?.name}</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span className="text-sm text-muted">Position: <span style={{ color: SPORTS[sport]?.color, fontWeight: 600 }}>{player.positions?.[sport] || 'Flex'}</span></span>
                            {hasRating && <span style={{ color: 'var(--warning)', fontWeight: 700 }}>⭐ {rating.overall}</span>}
                        </div>
                        {hasRating && rating.attrs && Object.keys(rating.attrs).length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {Object.entries(rating.attrs).map(([attr, val]) => (
                                    <div key={attr} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span className="text-xs" style={{ width: 100, color: 'var(--text-secondary)' }}>{attr}</span>
                                        <div style={{ flex: 1, height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{
                                                width: `${(val / 5) * 100}%`, height: '100%',
                                                background: SPORTS[sport]?.gradient, borderRadius: 3,
                                            }} />
                                        </div>
                                        <span className="text-xs font-semibold" style={{ width: 28 }}>{val}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: 16, background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                                <span className="text-sm text-muted">🔒 Rating Pending ({rating?.count || 0}/10 votes)</span>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Positions Played */}
            {Object.keys(positionsPlayed).length > 0 && (
                <div className="cv-section glass-card no-hover">
                    <h3 style={{ marginBottom: 16 }}>🏃 Positions Played</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {Object.entries(positionsPlayed).map(([key, count]) => {
                            const [sport, pos] = key.split('-');
                            return (
                                <div key={key} style={{
                                    background: `${SPORTS[sport]?.color}15`,
                                    border: `1px solid ${SPORTS[sport]?.color}30`,
                                    borderRadius: 'var(--radius-full)', padding: '6px 14px',
                                    fontSize: '0.8125rem',
                                }}>
                                    {SPORTS[sport]?.emoji} {pos} <span className="text-muted">×{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Milestones */}
            {milestones.length > 0 && (
                <div className="cv-section glass-card no-hover">
                    <h3 style={{ marginBottom: 16 }}>🏆 Milestones</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {milestones.map((m, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                                <span style={{ fontSize: '1.5rem' }}>{m.icon}</span>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{m.text}</div>
                                    <div className="text-xs text-muted">{m.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Written Feedback */}
            {(player.thoughts || []).length > 0 && (
                <div className="cv-section glass-card no-hover">
                    <h3 style={{ marginBottom: 16 }}>💬 Player Feedback</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {player.thoughts.map((t, i) => {
                            const from = getPlayer(t.from);
                            return (
                                <div key={i} style={{
                                    background: 'var(--bg-input)', borderRadius: 'var(--radius-md)',
                                    padding: 14, borderLeft: '3px solid var(--border-active)',
                                }}>
                                    <p className="text-sm" style={{ marginBottom: 6, fontStyle: 'italic' }}>"{t.text}"</p>
                                    <div className="text-xs text-muted">— {from?.name || 'Unknown'} · {t.date}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Recent Game History */}
            {playerGames.length > 0 && (
                <div className="cv-section glass-card no-hover" style={{ marginBottom: 24 }}>
                    <h3 style={{ marginBottom: 16 }}>📅 Recent Games</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {playerGames.slice(0, 6).map(g => (
                            <div key={g.id} style={{
                                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
                                borderBottom: '1px solid var(--border-color)',
                            }}>
                                <span className={`sport-badge ${g.sport}`} style={{ fontSize: '0.625rem', padding: '2px 8px' }}>
                                    {SPORTS[g.sport]?.emoji}
                                </span>
                                <div style={{ flex: 1 }}>
                                    <div className="text-sm font-semibold">{g.title}</div>
                                    <div className="text-xs text-muted">{formatDate(g.date)} · {g.format}</div>
                                </div>
                                <span className="text-xs" style={{
                                    color: g.status === 'completed' ? 'var(--success)' : 'var(--info)',
                                    fontWeight: 600,
                                }}>
                                    {g.status === 'completed' ? '✓ Played' : '⏳ Upcoming'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div style={{ textAlign: 'center', padding: '16px 0 32px', opacity: 0.4 }}>
                <span className="text-xs">Generated by SportsVault · {new Date().toLocaleDateString()}</span>
            </div>
        </div>
    );
}
