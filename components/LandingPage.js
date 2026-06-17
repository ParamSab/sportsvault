'use client';
import { useEffect, useRef, useState } from 'react';

// Curated showcase matches for the scrolling animation.
// (Marketing content — independent of live DB state.)
const SHOWCASE = [
    { title: '7-a-side Turf War', venue: 'Andheri Sports Arena', when: 'Tonight · 8:00', spots: '3 spots', few: true, banner: 'linear-gradient(135deg,#16a34a,#22c55e)', a: ['#6366f1', '#ec4899', '#f59e0b'] },
    { title: 'Sunday Morning XI', venue: 'Cooperage Ground', when: 'Sun · 7:30 AM', spots: '8 spots', few: false, banner: 'linear-gradient(135deg,#0ea5e9,#22c55e)', a: ['#22c55e', '#6366f1', '#a855f7'] },
    { title: '5s Floodlit League', venue: 'Powai Turf Club', when: 'Fri · 9:00 PM', spots: '2 spots', few: true, banner: 'linear-gradient(135deg,#7c3aed,#22c55e)', a: ['#ef4444', '#f59e0b', '#22c55e'] },
    { title: 'Beach Footy Kickabout', venue: 'Juhu Beach', when: 'Sat · 5:30 PM', spots: '6 spots', few: false, banner: 'linear-gradient(135deg,#f59e0b,#22c55e)', a: ['#6366f1', '#22c55e'] },
    { title: 'Corporate Cup Heat', venue: 'BKC Astro Turf', when: 'Wed · 7:00 PM', spots: '4 spots', few: false, banner: 'linear-gradient(135deg,#06b6d4,#16a34a)', a: ['#a855f7', '#ec4899', '#6366f1'] },
    { title: 'Midweek 6s', venue: 'Bandra Reclamation', when: 'Tue · 8:30 PM', spots: '1 spot', few: true, banner: 'linear-gradient(135deg,#16a34a,#84cc16)', a: ['#f59e0b', '#22c55e', '#ef4444'] },
    { title: 'Rooftop Futsal', venue: 'Lower Parel Sky Court', when: 'Thu · 9:30 PM', spots: '5 spots', few: false, banner: 'linear-gradient(135deg,#8b5cf6,#22c55e)', a: ['#6366f1', '#ec4899'] },
    { title: 'Veterans Friendly', venue: 'Oval Maidan', when: 'Sat · 6:00 AM', spots: '7 spots', few: false, banner: 'linear-gradient(135deg,#0891b2,#22c55e)', a: ['#22c55e', '#f59e0b', '#a855f7'] },
];

function MatchCard({ m }) {
    return (
        <div className="lp-match" aria-hidden="true">
            <div className="lp-match-banner" style={{ background: m.banner }}>
                <span className="lp-match-emoji">⚽</span>
                <span className="lp-match-when">{m.when}</span>
            </div>
            <div className="lp-match-body">
                <div className="lp-match-title">{m.title}</div>
                <div className="lp-match-venue">📍 {m.venue}</div>
                <div className="lp-match-foot">
                    <div className="lp-mini-stack">
                        {m.a.map((c, i) => (
                            <div key={i} className="lp-mini-av" style={{ background: c }} />
                        ))}
                        <div className="lp-mini-av" style={{ background: 'rgba(99,102,241,0.25)', color: '#a5b4fc' }}>+{4 + (m.a.length)}</div>
                    </div>
                    <span className={`lp-match-spots ${m.few ? 'few' : 'open'}`}>{m.spots}</span>
                </div>
            </div>
        </div>
    );
}

function Reveal({ children, delay = '', className = '', as: Tag = 'div' }) {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    el.classList.add('in');
                    io.unobserve(el);
                }
            },
            { threshold: 0.15 }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);
    return (
        <Tag ref={ref} className={`lp-reveal ${delay} ${className}`}>
            {children}
        </Tag>
    );
}

export default function LandingPage({ onExplore, onJoin }) {
    const [scrolled, setScrolled] = useState(false);
    const [email, setEmail] = useState('');
    const [joined, setJoined] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Duplicate the list so the marquee loops seamlessly (translateX -50%).
    const row1 = [...SHOWCASE, ...SHOWCASE];
    const row2 = [...SHOWCASE.slice().reverse(), ...SHOWCASE.slice().reverse()];

    const submitWaitlist = (e) => {
        e.preventDefault();
        if (!email.trim()) return;
        setJoined(true);
    };

    return (
        <div className="lp">
            {/* Top bar */}
            <header className={`lp-topbar ${scrolled ? 'scrolled' : ''}`}>
                <div className="lp-brand">
                    <span className="lp-brand-mark">⚡</span>
                    <span className="lp-brand-name">SportsVault</span>
                </div>
                <button className="btn btn-primary btn-sm" style={{ fontWeight: 700 }} onClick={onJoin}>
                    Get started
                </button>
            </header>

            {/* Hero */}
            <section className="lp-hero">
                <div className="lp-hero-bg">
                    <div className="lp-pitch" />
                    <div className="lp-mesh m1" />
                    <div className="lp-mesh m2" />
                    <div className="lp-mesh m3" />
                </div>
                <div className="lp-hero-inner">
                    <span className="lp-eyebrow"><span className="dot" /> Pickup sport, reinvented</span>
                    <h1 className="lp-h1">
                        Your next match,<br />
                        <span className="grad">one tap away.</span>
                    </h1>
                    <p className="lp-sub">
                        Discover football games near you, join trusted players, and build your sporting
                        reputation. No group chats. No flaky no-shows. Just play.
                    </p>
                    <div className="lp-cta-row">
                        <button className="lp-btn-hero lp-btn-primary" onClick={onExplore}>
                            Explore games
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                        </button>
                        <button className="lp-btn-hero lp-btn-ghost" onClick={onJoin}>
                            Create your profile
                        </button>
                    </div>
                    <div className="lp-stats">
                        <div className="lp-stat"><div className="lp-stat-num">240+</div><div className="lp-stat-label">Games / week</div></div>
                        <div className="lp-stat-sep" />
                        <div className="lp-stat"><div className="lp-stat-num">9,500</div><div className="lp-stat-label">Players</div></div>
                        <div className="lp-stat-sep" />
                        <div className="lp-stat"><div className="lp-stat-num">12</div><div className="lp-stat-label">Cities</div></div>
                    </div>
                </div>
                <div className="lp-scroll-cue">
                    Scroll
                    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                </div>
            </section>

            {/* Football marquee — the scrolling animation */}
            <section style={{ padding: '40px 0 86px' }}>
                <div className="lp-section-head" style={{ padding: '0 20px' }}>
                    <div className="lp-kicker">Live across the city</div>
                    <h2 className="lp-h2">Football, happening now</h2>
                    <p className="lp-section-sub">Real games filling up in real time. Find one that fits your level and schedule.</p>
                </div>
                <div className="lp-marquee-wrap">
                    <div className="lp-marquee row1">
                        {row1.map((m, i) => <MatchCard key={`r1-${i}`} m={m} />)}
                    </div>
                    <div className="lp-marquee row2">
                        {row2.map((m, i) => <MatchCard key={`r2-${i}`} m={m} />)}
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="lp-section">
                <Reveal as="div" className="lp-section-head">
                    <div className="lp-kicker">Why SportsVault</div>
                    <h2 className="lp-h2">Built for players who show up</h2>
                    <p className="lp-section-sub">Everything you need to find better games and play with people you can count on.</p>
                </Reveal>
                <div className="lp-grid">
                    <Reveal className="lp-feature">
                        <div className="lp-feature-ico">🛡️</div>
                        <h3>Trust Score</h3>
                        <p>Every player earns a reputation from real games — punctuality, sportsmanship, skill. Know who you're playing with before you commit.</p>
                    </Reveal>
                    <Reveal className="lp-feature" delay="d1">
                        <div className="lp-feature-ico">⚖️</div>
                        <h3>Auto team balancing</h3>
                        <p>Smart team-maker splits sides by skill and position so every match is close, competitive, and actually fun.</p>
                    </Reveal>
                    <Reveal className="lp-feature" delay="d2">
                        <div className="lp-feature-ico">⭐</div>
                        <h3>Rate & get rated</h3>
                        <p>Post-game ratings build your sporting CV across dribbling, passing, defending and attitude. Climb from Bronze to Platinum.</p>
                    </Reveal>
                    <Reveal className="lp-feature" delay="d3">
                        <div className="lp-feature-ico">📍</div>
                        <h3>Verified venues</h3>
                        <p>Browse real turfs and pitches on the map with pricing, surface and distance — book your spot in seconds.</p>
                    </Reveal>
                </div>
            </section>

            {/* How it works */}
            <section className="lp-section" style={{ paddingTop: 20 }}>
                <Reveal as="div" className="lp-section-head">
                    <div className="lp-kicker">How it works</div>
                    <h2 className="lp-h2">From couch to kickoff in 3 steps</h2>
                </Reveal>
                <div className="lp-steps">
                    <Reveal className="lp-step">
                        <div className="lp-step-num">1</div>
                        <h3>Find a game</h3>
                        <p>Filter by sport, skill and distance. See who's already in.</p>
                    </Reveal>
                    <Reveal className="lp-step" delay="d1">
                        <div className="lp-step-num">2</div>
                        <h3>RSVP & get matched</h3>
                        <p>Reserve your spot. Teams balance automatically before kickoff.</p>
                    </Reveal>
                    <Reveal className="lp-step" delay="d2">
                        <div className="lp-step-num">3</div>
                        <h3>Play & build your rep</h3>
                        <p>Show up, play, rate each other. Watch your Trust Score climb.</p>
                    </Reveal>
                </div>
            </section>

            {/* Padel video analytics teaser */}
            <section className="lp-section" style={{ paddingTop: 20 }}>
                <Reveal className="lp-padel">
                    <div className="lp-padel-inner">
                        <div>
                            <span className="lp-soon-pill"><span className="dot" /> Coming soon</span>
                            <h2>Padel, <span className="grad">analyzed frame by frame</span></h2>
                            <p>
                                We're bringing AI video analytics to padel. Clip your match, upload it, and get
                                pro-level breakdowns — automatically.
                            </p>
                            <div className="lp-padel-feats">
                                <div className="lp-padel-feat"><span className="tick">✓</span> Shot &amp; rally tracking with speed and placement</div>
                                <div className="lp-padel-feat"><span className="tick">✓</span> Court coverage heatmaps for you and your partner</div>
                                <div className="lp-padel-feat"><span className="tick">✓</span> Auto-generated highlight reels you can share</div>
                            </div>
                            {joined ? (
                                <div className="lp-waitlist-ok">✓ You're on the list — we'll be in touch.</div>
                            ) : (
                                <form className="lp-waitlist-row" onSubmit={submitWaitlist}>
                                    <input
                                        className="lp-waitlist-input"
                                        type="email"
                                        placeholder="you@email.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        aria-label="Email for padel analytics waitlist"
                                    />
                                    <button className="lp-waitlist-btn" type="submit">Join the waitlist</button>
                                </form>
                            )}
                        </div>

                        {/* Animated court analytics visual */}
                        <div className="lp-court" aria-hidden="true">
                            <span className="lp-court-tag" style={{ top: 12, left: 12 }}>● REC · AI tracking</span>
                            <span className="lp-court-tag" style={{ bottom: 12, right: 12 }}>Rally 14 · 41 km/h</span>
                            <svg viewBox="0 0 320 240" preserveAspectRatio="none">
                                {/* court outline */}
                                <rect x="34" y="24" width="252" height="192" rx="4" fill="none" stroke="rgba(249,115,22,0.35)" strokeWidth="2" />
                                <line x1="160" y1="24" x2="160" y2="216" stroke="rgba(249,115,22,0.3)" strokeWidth="2" />
                                <line x1="34" y1="120" x2="286" y2="120" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="4 5" />
                                <rect x="90" y="24" width="140" height="192" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
                                {/* ball trajectory */}
                                <path className="lp-track-line" d="M70 170 Q150 60 250 90 T230 180" />
                                {/* player heat dots */}
                                <circle className="lp-player-dot" cx="100" cy="160" r="7" fill="rgba(99,102,241,0.85)" />
                                <circle className="lp-player-dot p2" cx="210" cy="90" r="7" fill="rgba(236,72,153,0.85)" />
                                {/* ball */}
                                <g className="lp-ball">
                                    <circle cx="70" cy="170" r="5" fill="#fbbf24" stroke="#fff" strokeWidth="1" />
                                </g>
                            </svg>
                        </div>
                    </div>
                </Reveal>
            </section>

            {/* Final CTA */}
            <section className="lp-section" style={{ paddingTop: 20 }}>
                <Reveal className="lp-final">
                    <h2 className="text-gradient-primary">Ready to play?</h2>
                    <p>Join thousands of players finding their next game on SportsVault.</p>
                    <div className="lp-cta-row">
                        <button className="lp-btn-hero lp-btn-primary" onClick={onJoin}>
                            Get started free
                        </button>
                        <button className="lp-btn-hero lp-btn-ghost" onClick={onExplore}>
                            Browse games first
                        </button>
                    </div>
                </Reveal>
            </section>

            {/* Footer */}
            <footer className="lp-footer">
                <div className="lp-brand">
                    <span className="lp-brand-mark">⚡</span>
                    <span className="lp-brand-name">SportsVault</span>
                </div>
                <div>Football today · Padel analytics next · More sports soon</div>
                <div style={{ marginTop: 10, opacity: 0.7 }}>© 2026 SportsVault. Play more, organize less.</div>
            </footer>
        </div>
    );
}
