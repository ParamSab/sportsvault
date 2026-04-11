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
    pendingFriends: [],
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
                    photo: null,
                    location: 'Unknown Location',
                    sports: ['football', 'padel', 'cricket'], // Default to some sports
                    positions: {},
                    ratings: {},
                    trustScore: 50, // Default trust score
                    gamesPlayed: 0,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    thoughts: [],
                    privacy: 'friends',
                    joined: new Date().toISOString().split('T')[0],
                };
                return {
                    ...state,
                    players: [...state.players, newPlayer],
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
            return { 
                ...state, 
                ...action.payload, 
                games: action.payload.games || state.games || [],
                notifications: action.payload.notifications || state.notifications || [],
                isLoaded: true 
            };
        default:
            return state;
    }
}

export function StoreProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);

    // Polling for real-time updates (every 30 seconds)
    useEffect(() => {
        if (!state.isLoaded) return;
        const interval = setInterval(async () => {
            try {
                const user = state.currentUser;
                const [gRes, nRes] = await Promise.all([
                    fetch('/api/games' + (user?.dbId ? `?userId=${user.dbId}` : ''), { cache: 'no-store' }),
                    fetch('/api/notifications', { cache: 'no-store' })
                ]);
                
                const updates = {};
                
                // Fetch games and notifications
                const gData = gRes.ok ? await gRes.json() : null;
                const nData = nRes.ok ? await nRes.json() : null;
                
                if (gData?.games) updates.games = gData.games;
                if (nData?.notifications) updates.notifications = nData.notifications;
                
                if (Object.keys(updates).length > 0) {
                    dispatch({ type: 'LOAD_STATE', payload: updates });
                }
            } catch (_) { /* ignore */ }
        }, 30000);
        return () => clearInterval(interval);
    }, [state.isLoaded, state.currentUser]);

    // Load from session cookie first, then localStorage fallback
    useEffect(() => {
        const loadState = async () => {
            let sessionUser = null;
            try {
                // Try server session cookie first (iron-session)
                const res = await fetch('/api/auth/session');
                const data = await res.json();
                if (data.user) {
                    sessionUser = { ...data.user, id: data.user.dbId || data.user.id };
                    dispatch({ type: 'LOAD_STATE', payload: { currentUser: sessionUser, isAuthenticated: true } });
                } else {
                    // Fallback to localStorage if no server session
                    const saved = localStorage.getItem('sportsvault_state');
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        if (parsed.isAuthenticated && parsed.currentUser) {
                            sessionUser = parsed.currentUser;
                            dispatch({ type: 'LOAD_STATE', payload: { currentUser: sessionUser, isAuthenticated: true } });
                        }
                    }
                }
            } catch (_) { /* session API not available */ }

            // Load games AND notifications from API
            try {
                const userId = sessionUser?.dbId || sessionUser?.id;
                const [gRes, nRes] = await Promise.all([
                    fetch('/api/games' + (userId ? `?userId=${userId}` : ''), { cache: 'no-store' }),
                    fetch('/api/notifications', { cache: 'no-store' })
                ]);
                
                const updates = {};
                if (gRes.ok) {
                    const gData = await gRes.json();
                    if (gData.games) updates.games = gData.games;
                }
                if (nRes.ok) {
                    const nData = await nRes.json();
                    if (nData.notifications) updates.notifications = nData.notifications;
                }
                
                if (Object.keys(updates).length > 0) {
                    dispatch({ type: 'LOAD_STATE', payload: updates });
                }
            } catch (_) { /* ignore */ }

            // Load friends from API if authenticated
            if (sessionUser) {
                try {
                    const fRes = await fetch('/api/friends');
                    const fData = await fRes.json();
                    if (fData.friends) {
                        const tiers = {};
                        fData.tiers?.forEach(t => {
                            if (!tiers[t.friendId]) tiers[t.friendId] = {};
                            tiers[t.friendId][t.sport] = t.tier;
                        });
                        // Merge database players with mock data
                        dispatch({ type: 'LOAD_STATE', payload: { 
                            friends: fData.friends.map(f => f.id), 
                            pendingFriends: fData.pendingRequests || [],
                            players: [...fData.friends, ...(fData.pendingRequests || []), ...PLAYERS], 
                            friendTiers: tiers 
                        } });
                    }
                } catch (_) { /* ignore */ }
            }

            // Finally merge any other locally-cached state (tab preferences etc)
            try {
                const saved = localStorage.getItem('sportsvault_state');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    const { currentUser: _, isAuthenticated: __, friends: ___, players: ____, games: _____, ...rest } = parsed;
                    dispatch({ type: 'LOAD_STATE', payload: rest });
                }
            } catch (_) { /* ignore */ }

            // Mark as loaded
            dispatch({ type: 'LOAD_STATE', payload: { isLoaded: true } });
        };
        loadState();
    }, []);

    // Save to localStorage + Sync to APIs on state changes
    useEffect(() => {
        if (!state.isLoaded) return; // Wait until initial load is done

        if (state.isAuthenticated && state.currentUser?.id) {
            try {
                // LocalStorage sync
                const toSave = { ...state };
                localStorage.setItem('sportsvault_state', JSON.stringify(toSave));

                // Note: In a production app, we'd only sync the deltas.
                // For this prototype, we've handled the specific actions (ADD_FRIEND, etc)
                // but we'll add a simple sync here if needed.
            } catch (_) { /* ignore */ }
        }

        // Clear on logout (EXPLICIT LOGOUT ONLY)
        // We can detect logout if isLoaded is true but isAuthenticated is false 
        // AND we don't have a currentUser anymore.
        if (state.isLoaded && !state.isAuthenticated && !state.currentUser && typeof window !== 'undefined') {
            localStorage.removeItem('sportsvault_state');
            fetch('/api/auth/session', { method: 'DELETE' }).catch(() => { });
        }
    }, [state.isAuthenticated, state.currentUser, state.isLoaded]);

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
