'use client';
import { createContext, useContext, useReducer, useEffect } from 'react';
import { PLAYERS, GAMES, NOTIFICATIONS } from './mockData';

const StoreContext = createContext(null);

// ── Minimal auth stored in localStorage so sessions survive cookie loss ──────
const LS_AUTH_KEY = 'sv_auth';

function getLocalAuth() {
    if (typeof window === 'undefined') return null;
    try {
        const s = localStorage.getItem(LS_AUTH_KEY);
        return s ? JSON.parse(s) : null;
    } catch (_) { return null; }
}
function saveLocalAuth(user) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(LS_AUTH_KEY, JSON.stringify({
            dbId: user.dbId,
            name: user.name,
            email: user.email,
        }));
    } catch (_) { }
}
function clearLocalAuth() {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(LS_AUTH_KEY);
        localStorage.removeItem('sportsvault_state');
    } catch (_) { }
}

// ── Initial state ─────────────────────────────────────────────────────────────
const initialState = {
    currentUser: null,
    isAuthenticated: false,
    loading: true, // true while we check session / localStorage on startup
    players: PLAYERS,
    games: GAMES,
    notifications: NOTIFICATIONS,
    friends: [],
    friendTiers: {},
    activeTab: 'discover',
    selectedSport: 'all',
};

// ── Reducer ───────────────────────────────────────────────────────────────────
function reducer(state, action) {
    switch (action.type) {
        case 'LOGIN':
            return { ...state, currentUser: action.payload, isAuthenticated: true, loading: false };
        case 'LOGOUT':
            return { ...initialState, loading: false };
        case 'SET_LOADING':
            return { ...state, loading: action.payload };
        case 'UPDATE_PROFILE':
            return {
                ...state,
                currentUser: { ...state.currentUser, ...action.payload },
                players: state.players.map(p => p.id === state.currentUser?.id ? { ...p, ...action.payload } : p),
            };
        case 'SET_TAB':
            return { ...state, activeTab: action.payload };
        case 'SET_SPORT_FILTER':
            return { ...state, selectedSport: action.payload };
        case 'RSVP': {
            const { gameId, playerId, status, position } = action.payload;
            return {
                ...state,
                games: state.games.map(g => {
                    if (g.id !== gameId) return g;
                    const existing = g.rsvps.findIndex(r => r.playerId === playerId);
                    const newRsvps = [...g.rsvps];
                    if (existing >= 0) {
                        newRsvps[existing] = { playerId, status, position };
                    } else {
                        newRsvps.push({ playerId, status, position });
                    }
                    return { ...g, rsvps: newRsvps };
                }),
            };
        }
        case 'CREATE_GAME':
            return { ...state, games: [action.payload, ...state.games] };
        case 'ADD_FRIEND': {
            if (typeof action.payload === 'object' && action.payload.isNew) {
                const newId = action.payload.id || `p${state.players.length + 100}`;
                const newPlayer = {
                    id: newId,
                    name: action.payload.name || 'Unknown Player',
                    phone: action.payload.phone,
                    photo: action.payload.photo || null,
                    location: action.payload.location || 'Unknown Location',
                    sports: action.payload.sports || ['football', 'padel', 'cricket'],
                    positions: action.payload.positions || {},
                    ratings: action.payload.ratings || {},
                    trustScore: action.payload.trustScore || 50,
                    gamesPlayed: action.payload.gamesPlayed || 0,
                    wins: action.payload.wins || 0,
                    losses: action.payload.losses || 0,
                    draws: action.payload.draws || 0,
                    thoughts: [],
                    privacy: action.payload.privacy || 'friends',
                    joined: action.payload.joined || new Date().toISOString().split('T')[0],
                };
                return {
                    ...state,
                    players: [...state.players.filter(p => p.id !== newId), newPlayer],
                    friends: [...new Set([...state.friends, newId])],
                };
            }
            return { ...state, friends: [...new Set([...state.friends, action.payload])] };
        }
        case 'REMOVE_FRIEND':
            return { ...state, friends: state.friends.filter(f => f !== action.payload) };
        case 'SET_FRIEND_TIER': {
            const { friendId, sport, tier } = action.payload;
            const newTiers = { ...(state.friendTiers || {}) };
            if (!newTiers[friendId]) newTiers[friendId] = {};
            if (tier === null) {
                const sportTiers = { ...newTiers[friendId] };
                delete sportTiers[sport];
                if (Object.keys(sportTiers).length === 0) {
                    const cloned = { ...newTiers };
                    delete cloned[friendId];
                    return { ...state, friendTiers: cloned };
                }
                return { ...state, friendTiers: { ...newTiers, [friendId]: sportTiers } };
            }
            return { ...state, friendTiers: { ...newTiers, [friendId]: { ...newTiers[friendId], [sport]: tier } } };
        }
        case 'ADD_THOUGHT': {
            const { playerId, thought } = action.payload;
            return {
                ...state,
                players: state.players.map(p =>
                    p.id === playerId ? { ...p, thoughts: [thought, ...p.thoughts] } : p
                ),
            };
        }
        case 'SUBMIT_RATING': {
            const { playerId, sport, rating } = action.payload;
            return {
                ...state,
                players: state.players.map(p => {
                    if (p.id !== playerId || !p.ratings[sport]) return p;
                    const r = p.ratings[sport];
                    const newCount = r.count + 1;
                    const newOverall = ((r.overall * r.count) + rating) / newCount;
                    return {
                        ...p,
                        ratings: { ...p.ratings, [sport]: { ...r, overall: Math.round(newOverall * 10) / 10, count: newCount } },
                    };
                }),
            };
        }
        case 'READ_NOTIFICATION':
            return {
                ...state,
                notifications: state.notifications.map(n => n.id === action.payload ? { ...n, read: true } : n),
            };
        case 'LOAD_STATE':
            return { ...state, ...action.payload };
        default:
            return state;
    }
}

// ── Build a full user object from DB data ─────────────────────────────────────
function buildUserFromDb(dbUser) {
    return {
        id: 'current',
        dbId: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        phone: dbUser.phone || '',
        photo: dbUser.photo || null,
        location: dbUser.location || '',
        sports: dbUser.sports || [],
        positions: dbUser.positions || {},
        ratings: dbUser.ratings || {},
        trustScore: dbUser.trustScore || 50,
        gamesPlayed: dbUser.gamesPlayed || 0,
        wins: dbUser.wins || 0,
        losses: dbUser.losses || 0,
        draws: dbUser.draws || 0,
        thoughts: [],
        privacy: dbUser.privacy || 'public',
        joined: dbUser.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
    };
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function StoreProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);

    useEffect(() => {
        const loadState = async () => {
            let user = null;

            // ── Step 1: Check localStorage first (synchronous, instant) ──────
            const localAuth = getLocalAuth();
            if (localAuth?.dbId) {
                // Show a skeleton user immediately so the app renders while we validate
                dispatch({
                    type: 'LOAD_STATE', payload: {
                        currentUser: { id: 'current', ...localAuth },
                        isAuthenticated: true,
                    }
                });
            }

            // ── Step 2: Check iron-session cookie ─────────────────────────────
            try {
                const res = await fetch('/api/auth/session');
                const data = await res.json();
                if (data.user?.dbId) {
                    user = data.user;
                    dispatch({ type: 'LOAD_STATE', payload: { currentUser: data.user, isAuthenticated: true } });
                }
            } catch (_) { /* network error — fall through */ }

            // ── Step 3: If cookie was stale/missing but localStorage had a dbId,
            //            re-validate the user directly from the DB ─────────────
            if (!user && localAuth?.dbId) {
                try {
                    const profileRes = await fetch(`/api/users?id=${localAuth.dbId}`);
                    const profileData = await profileRes.json();
                    if (profileData.user) {
                        user = buildUserFromDb(profileData.user);
                        // Refresh the session cookie while we're at it
                        const { photo: _p, ...sessionUser } = user;
                        await fetch('/api/auth/session', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ user: sessionUser, rememberMe: true }),
                        }).catch(() => { });
                        dispatch({ type: 'LOAD_STATE', payload: { currentUser: user, isAuthenticated: true } });
                    } else {
                        // User deleted from DB — force logout
                        clearLocalAuth();
                        dispatch({ type: 'LOGOUT' });
                        return;
                    }
                } catch (_) {
                    // Can't reach DB — keep showing with localStorage data and try again later
                    dispatch({ type: 'SET_LOADING', payload: false });
                    return;
                }
            }

            // Not authenticated at all
            if (!user) {
                dispatch({ type: 'SET_LOADING', payload: false });
                return;
            }

            // ── Step 4: Fetch full photo if missing ───────────────────────────
            if (user.dbId && !user.photo) {
                try {
                    const profileRes = await fetch(`/api/users?id=${user.dbId}`);
                    const profileData = await profileRes.json();
                    if (profileData.user?.photo) {
                        user = { ...user, photo: profileData.user.photo };
                        dispatch({ type: 'LOAD_STATE', payload: { currentUser: user } });
                    }
                } catch (_) { }
            }

            // ── Step 5: Load friends from DB ──────────────────────────────────
            let friendDbIds = [];
            try {
                const fRes = await fetch('/api/friends');
                const fData = await fRes.json();
                if (fData.friends) {
                    const tiers = {};
                    fData.tiers?.forEach(t => {
                        if (!tiers[t.friendId]) tiers[t.friendId] = {};
                        tiers[t.friendId][t.sport] = t.tier;
                    });
                    friendDbIds = fData.friends.map(f => f.id);
                    dispatch({
                        type: 'LOAD_STATE',
                        payload: { friends: friendDbIds, players: [...fData.friends, ...PLAYERS], friendTiers: tiers }
                    });
                }
            } catch (_) { }

            // ── Step 6: Load games from DB (with friendIds for friends-only) ──
            try {
                const friendIdsParam = friendDbIds.length ? `&friendIds=${friendDbIds.join(',')}` : '';
                const gRes = await fetch(`/api/games?userId=${user.dbId}${friendIdsParam}`);
                const gData = await gRes.json();
                if (gData.games?.length > 0) {
                    const extraPlayers = [];
                    const seenIds = new Set();

                    const dbGames = gData.games.map(g => {
                        const orgId = g.organizer?.id || g.organizerId;
                        if (g.organizer && orgId !== user.dbId && !seenIds.has(orgId)) {
                            seenIds.add(orgId);
                            extraPlayers.push({
                                id: orgId, name: g.organizer.name, photo: g.organizer.photo || null,
                                sports: [], positions: {}, ratings: {},
                                trustScore: 50, gamesPlayed: 0, wins: 0, losses: 0, draws: 0, thoughts: [],
                            });
                        }
                        return {
                            ...g,
                            organizer: orgId === user.dbId ? 'current' : orgId,
                            status: g.status || 'open',
                            rsvps: g.rsvps.map(r => {
                                if (r.playerId !== user.dbId && r.playerName && !seenIds.has(r.playerId)) {
                                    seenIds.add(r.playerId);
                                    extraPlayers.push({
                                        id: r.playerId, name: r.playerName, photo: r.playerPhoto || null,
                                        sports: [], positions: {}, ratings: {},
                                        trustScore: 50, gamesPlayed: 0, wins: 0, losses: 0, draws: 0, thoughts: [],
                                    });
                                }
                                return {
                                    playerId: r.playerId === user.dbId ? 'current' : r.playerId,
                                    status: r.status,
                                    position: r.position || '',
                                };
                            }),
                        };
                    });

                    dispatch({ type: 'LOAD_STATE', payload: { games: dbGames } });
                    if (extraPlayers.length > 0) {
                        dispatch({ type: 'LOAD_STATE', payload: { players: [...PLAYERS, ...extraPlayers] } });
                    }
                }
            } catch (_) { }

            dispatch({ type: 'SET_LOADING', payload: false });
        };

        loadState();
    }, []);

    // Persist auth info + ui prefs on state change
    useEffect(() => {
        if (state.isAuthenticated && state.currentUser?.dbId) {
            saveLocalAuth(state.currentUser);
        }
        if (!state.isAuthenticated && !state.loading) {
            clearLocalAuth();
            fetch('/api/auth/session', { method: 'DELETE' }).catch(() => { });
        }
    }, [state.isAuthenticated, state.currentUser?.dbId, state.loading]);

    return (
        <StoreContext.Provider value={{ state, dispatch }}>
            {children}
        </StoreContext.Provider>
    );
}

export function useStore() {
    const ctx = useContext(StoreContext);
    if (!ctx) throw new Error('useStore must be used within StoreProvider');
    return ctx;
}
