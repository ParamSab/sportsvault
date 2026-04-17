'use client';
import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { PLAYERS, NOTIFICATIONS } from './mockData';

const StoreContext = createContext(null);

const initialState = {
    currentUser: null,
    isAuthenticated: false,
    onboardingStep: 0,
    players: PLAYERS,
    games: [],
    notifications: NOTIFICATIONS,
    friends: [],
    pendingFriends: [],
    friendTiers: {}, // { friendId: { sport: tierNumber } }
    activeTab: 'discover',
    selectedSport: 'all',
};

function reducer(state, action) {
    switch (action.type) {
        case 'LOGIN': {
            const user = action.payload;
            const standardized = user ? { ...user, id: user.dbId || user.id } : null;
            return { ...state, currentUser: standardized, isAuthenticated: !!user };
        }
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
            const { gameId, playerId, status, position, paymentStatus } = action.payload;
            return {
                ...state,
                games: (state.games || []).map(g => {
                    if (String(g.id) !== String(gameId)) return g;
                    const existing = (g.rsvps || []).findIndex(r => String(r.playerId) === String(playerId));
                    const newRsvps = [...(g.rsvps || [])];
                    if (existing >= 0) {
                        newRsvps[existing] = {
                            ...newRsvps[existing],
                            playerId, status, position,
                            ...(paymentStatus !== undefined && { paymentStatus }),
                        };
                    } else {
                        newRsvps.push({ playerId, status, position, paymentStatus: paymentStatus || 'not_required' });
                    }
                    return { ...g, rsvps: newRsvps };
                }),
            };
        }
        case 'UPDATE_GAME':
            return { ...state, games: state.games.map(g => g.id === action.payload.id ? action.payload : g) };
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
        case 'MERGE_GAME': {
            // Replace a single game by ID — no stale-closure risk since runs in reducer
            const updated = action.payload;
            if (!updated?.id) return state;
            const exists = (state.games || []).some(g => String(g.id) === String(updated.id));
            return {
                ...state,
                games: exists
                    ? (state.games || []).map(g => String(g.id) === String(updated.id) ? updated : g)
                    : [updated, ...(state.games || [])],
            };
        }
        case 'LOAD_STATE': {
            const updates = { ...action.payload };
            if (updates.currentUser) {
                updates.currentUser = { ...updates.currentUser, id: updates.currentUser.dbId || updates.currentUser.id };
            }
            // Merge friend player objects into state.players (deduped) when provided by polling/refresh
            if (updates.friendObjects) {
                const existing = state.players || [];
                const merged = [...(updates.friendObjects), ...existing].filter(
                    (p, i, arr) => p && arr.findIndex(x => x && String(x.id) === String(p.id)) === i
                );
                updates.players = merged;
                delete updates.friendObjects;
            }
            return {
                ...state,
                ...updates,
                games: updates.games || state.games || [],
                notifications: updates.notifications || state.notifications || [],
                isLoaded: true
            };
        }
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
                const requests = [
                    fetch('/api/games' + (user?.dbId ? `?userId=${user.dbId}` : ''), { cache: 'no-store' }),
                    fetch('/api/notifications', { cache: 'no-store' }),
                ];
                if (user) requests.push(fetch('/api/friends', { cache: 'no-store' }));

                const [gRes, nRes, fRes] = await Promise.all(requests);

                const updates = {};

                const gData = gRes.ok ? await gRes.json() : null;
                const nData = nRes.ok ? await nRes.json() : null;
                const fData = fRes?.ok ? await fRes.json() : null;

                if (gData?.games) updates.games = gData.games;
                if (nData?.notifications) updates.notifications = nData.notifications;
                if (fData?.friends) {
                    const tiers = {};
                    fData.tiers?.forEach(t => { if (!tiers[t.friendId]) tiers[t.friendId] = {}; tiers[t.friendId][t.sport] = t.tier; });
                    updates.friends = fData.friends.map(f => f.id || f);
                    updates.pendingFriends = fData.pendingRequests || [];
                    updates.friendTiers = tiers;
                    // Pass full objects so LOAD_STATE can merge them into state.players
                    updates.friendObjects = [...fData.friends, ...(fData.pendingRequests || [])];
                }

                if (Object.keys(updates).length > 0) {
                    dispatch({ type: 'LOAD_STATE', payload: updates });
                }
            } catch (_) { /* ignore */ }
        }, 30000);
        return () => clearInterval(interval);
    }, [state.isLoaded, state.currentUser]);

    // Load initial state: show localStorage instantly, then fetch fresh data in parallel
    useEffect(() => {
        const loadState = async () => {
            // 1. Read localStorage SYNCHRONOUSLY first — instant display of cached data
            let cachedUser = null;
            try {
                const saved = localStorage.getItem('sportsvault_state');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed.isAuthenticated && parsed.currentUser) {
                        cachedUser = parsed.currentUser;
                        // Show cached user + friends + games immediately from cache
                        dispatch({ type: 'LOAD_STATE', payload: { ...parsed, games: parsed.games || [], isLoaded: false } });
                    }
                }
            } catch (_) { /* ignore bad localStorage */ }

            // 2. Fire session + games + notifications + friends ALL in parallel
            const cachedUserId = cachedUser?.dbId || cachedUser?.id;
            const [sessionRes, gRes, nRes, fRes] = await Promise.all([
                fetch('/api/auth/session').catch(() => null),
                fetch('/api/games' + (cachedUserId ? `?userId=${cachedUserId}` : ''), { cache: 'no-store' }).catch(() => null),
                fetch('/api/notifications', { cache: 'no-store' }).catch(() => null),
                cachedUser ? fetch('/api/friends', { cache: 'no-store' }).catch(() => null) : Promise.resolve(null),
            ]);

            // 3. Process session
            let sessionUser = cachedUser;
            try {
                if (sessionRes?.ok) {
                    const data = await sessionRes.json();
                    if (data.user) {
                        sessionUser = { ...data.user, id: data.user.dbId || data.user.id };
                        dispatch({ type: 'LOAD_STATE', payload: { currentUser: sessionUser, isAuthenticated: true } });
                    } else if (!cachedUser) {
                        dispatch({ type: 'LOAD_STATE', payload: { currentUser: null, isAuthenticated: false } });
                    }
                }
            } catch (_) { /* ignore */ }

            // 4. Games — if userId changed between cache and session, re-fetch with real userId
            try {
                const realUserId = sessionUser?.dbId || sessionUser?.id;
                let gameRes = gRes;
                if (realUserId && realUserId !== cachedUserId) {
                    gameRes = await fetch(`/api/games?userId=${realUserId}`, { cache: 'no-store' }).catch(() => null);
                }
                if (gameRes?.ok) {
                    const gData = await gameRes.json();
                    if (gData.games) dispatch({ type: 'LOAD_STATE', payload: { games: gData.games } });
                }
            } catch (_) { /* ignore */ }

            // 5. Notifications
            try {
                if (nRes?.ok) {
                    const nData = await nRes.json();
                    if (nData.notifications) dispatch({ type: 'LOAD_STATE', payload: { notifications: nData.notifications } });
                }
            } catch (_) { /* ignore */ }

            // 6. Friends
            try {
                // If session found a user but we had no cache, fetch friends now
                const friendRes = fRes || (sessionUser && !cachedUser
                    ? await fetch('/api/friends', { cache: 'no-store' }).catch(() => null)
                    : null);
                if (friendRes?.ok) {
                    const fData = await friendRes.json();
                    if (fData.friends) {
                        const tiers = {};
                        fData.tiers?.forEach(t => {
                            if (!tiers[t.friendId]) tiers[t.friendId] = {};
                            tiers[t.friendId][t.sport] = t.tier;
                        });
                        dispatch({ type: 'LOAD_STATE', payload: {
                            friends: fData.friends.map(f => f.id),
                            pendingFriends: fData.pendingRequests || [],
                            players: [...fData.friends, ...(fData.pendingRequests || []), ...PLAYERS],
                            friendTiers: tiers
                        } });
                    }
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
