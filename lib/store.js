'use client';
import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { PLAYERS, GAMES, NOTIFICATIONS } from './mockData';

const StoreContext = createContext(null);

const initialState = {
    currentUser: null,
    isAuthenticated: false,
    onboardingStep: 0,
    players: PLAYERS,
    games: GAMES,
    notifications: NOTIFICATIONS,
    friends: [],
    friendTiers: {}, // { friendId: { sport: tierNumber } }
    activeTab: 'discover',
    selectedSport: 'all',
};

function reducer(state, action) {
    switch (action.type) {
        case 'LOGIN':
            return { ...state, currentUser: action.payload, isAuthenticated: true };
        case 'LOGOUT':
            return { ...initialState };
        case 'SET_ONBOARDING_STEP':
            return { ...state, onboardingStep: action.payload };
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
                // Use provided ID or generate one
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
                    friends: [...new Set([...state.friends, newId])]
                };
            }
            // Standard ID-based add
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
            } else {
                return { ...state, friendTiers: { ...newTiers, [friendId]: { ...newTiers[friendId], [sport]: tier } } };
            }
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

export function StoreProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);

    // Load from session cookie first, then DB, then localStorage fallback
    useEffect(() => {
        const loadState = async () => {
            let user = null;
            try {
                const res = await fetch('/api/auth/session');
                const data = await res.json();
                if (data.user) {
                    user = data.user;
                    dispatch({ type: 'LOAD_STATE', payload: { currentUser: data.user, isAuthenticated: true } });

                    // Fetch full profile (including photo) from DB to restore it after session strips it
                    if (data.user.dbId) {
                        try {
                            const profileRes = await fetch(`/api/users?id=${data.user.dbId}`);
                            const profileData = await profileRes.json();
                            if (profileData.user?.photo) {
                                user = { ...user, photo: profileData.user.photo };
                                dispatch({ type: 'LOAD_STATE', payload: { currentUser: { ...data.user, photo: profileData.user.photo } } });
                            }
                        } catch (_) { /* no photo restore */ }
                    }
                }
            } catch (_) { /* session API not available */ }

            if (user) {
                // Load friends from DB
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
                        dispatch({ type: 'LOAD_STATE', payload: { friends: friendDbIds, players: [...fData.friends, ...PLAYERS], friendTiers: tiers } });
                    }
                } catch (_) { /* ignore */ }

                // Load games from DB — pass friendIds so friends-only games are visible
                try {
                    const friendIdsParam = friendDbIds.length ? `&friendIds=${friendDbIds.join(',')}` : '';
                    const gRes = await fetch(`/api/games?userId=${user.dbId}${friendIdsParam}`);
                    const gData = await gRes.json();
                    if (gData.games?.length > 0) {
                        const extraPlayers = [];
                        const seenPlayerIds = new Set();

                        const dbGames = gData.games.map(g => {
                            const orgId = g.organizer?.id || g.organizerId;

                            // Collect organizer profile
                            if (g.organizer && orgId !== user.dbId && !seenPlayerIds.has(orgId)) {
                                seenPlayerIds.add(orgId);
                                extraPlayers.push({
                                    id: orgId,
                                    name: g.organizer.name,
                                    photo: g.organizer.photo || null,
                                    sports: [], positions: {}, ratings: {},
                                    trustScore: 50, gamesPlayed: 0,
                                    wins: 0, losses: 0, draws: 0, thoughts: [],
                                });
                            }

                            return {
                                ...g,
                                // Map current user's dbId → 'current' so all UI comparisons work
                                organizer: orgId === user.dbId ? 'current' : orgId,
                                status: g.status || 'open',
                                rsvps: g.rsvps.map(r => {
                                    // Collect RSVP player profiles so GameDetailPage can show them
                                    if (r.playerId !== user.dbId && r.playerName && !seenPlayerIds.has(r.playerId)) {
                                        seenPlayerIds.add(r.playerId);
                                        extraPlayers.push({
                                            id: r.playerId,
                                            name: r.playerName,
                                            photo: r.playerPhoto || null,
                                            sports: [], positions: {}, ratings: {},
                                            trustScore: 50, gamesPlayed: 0,
                                            wins: 0, losses: 0, draws: 0, thoughts: [],
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
                } catch (_) { /* fallback to mock/localStorage games */ }
            }

            // Merge locally-cached UI state (active tab, sport filter, etc.)
            try {
                const saved = localStorage.getItem('sportsvault_state');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    // Don't restore auth, friends, players, or games from localStorage —
                    // those come from the DB now
                    const { currentUser: _, isAuthenticated: __, friends: ___, players: ____, games: _____, ...rest } = parsed;
                    dispatch({ type: 'LOAD_STATE', payload: rest });
                }
            } catch (_) { /* ignore */ }
        };
        loadState();
    }, []);

    // Save to localStorage on state changes
    useEffect(() => {
        if (state.isAuthenticated) {
            try {
                localStorage.setItem('sportsvault_state', JSON.stringify(state));
            } catch (_) { /* ignore */ }
        }
        // Clear on logout
        if (!state.isAuthenticated && typeof window !== 'undefined') {
            localStorage.removeItem('sportsvault_state');
            fetch('/api/auth/session', { method: 'DELETE' }).catch(() => { });
        }
    }, [state]);

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
