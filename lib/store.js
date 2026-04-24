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
                            ...newRsvps[existing], playerId, status, position,
                            ...(paymentStatus !== undefined && { paymentStatus }),
                        };
                    } else {
                        newRsvps.push({ playerId, status, position, paymentStatus: paymentStatus || 'not_required' });
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

    // Polling — single /api/init call every 30s
    useEffect(() => {
        if (!state.isLoaded) return;
        const interval = setInterval(async () => {
            try {
                const uid = state.currentUser?.dbId || state.currentUser?.id;
                const res = await fetch('/api/init' + (uid ? `?userId=${uid}` : ''), { cache: 'no-store' });
                if (!res.ok) return;
                const data = await res.json();
                const updates = {};
                if (data.games) updates.games = data.games;
                if (data.notifications) updates.notifications = data.notifications;
                if (data.friends) {
                    const tiers = {};
                    (data.tiers || []).forEach(t => { if (!tiers[t.friendId]) tiers[t.friendId] = {}; tiers[t.friendId][t.sport] = t.tier; });
                    updates.friends = data.friends.map(f => f.id || f);
                    updates.pendingFriends = data.pendingRequests || [];
                    updates.friendTiers = tiers;
                    updates.friendObjects = [...data.friends, ...(data.pendingRequests || [])];
                }
                if (Object.keys(updates).length > 0) dispatch({ type: 'LOAD_STATE', payload: updates });
            } catch (_) { /* ignore */ }
        }, 30000);
        return () => clearInterval(interval);
    }, [state.isLoaded, state.currentUser]);

    // Initial load: localStorage instantly → session + /api/init in parallel
    useEffect(() => {
        const loadState = async () => {
            // 1. Show localStorage cache immediately and mark loaded so UI renders at once
            let cachedUser = null;
            try {
                const saved = localStorage.getItem('sportsvault_state');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed.isAuthenticated && parsed.currentUser) {
                        cachedUser = parsed.currentUser;
                        dispatch({ type: 'LOAD_STATE', payload: { ...parsed, games: parsed.games || [], isLoaded: true } });
                    }
                }
            } catch (_) { /* ignore */ }

            // 2. Session + data in parallel
            const cachedUserId = cachedUser?.dbId || cachedUser?.id;
            const [sessionRes, initRes] = await Promise.all([
                fetch('/api/auth/session').catch(() => null),
                fetch('/api/init' + (cachedUserId ? `?userId=${cachedUserId}` : ''), { cache: 'no-store' }).catch(() => null),
            ]);

            // 3. Resolve session user
            let sessionUser = cachedUser;
            try {
                if (sessionRes?.ok) {
                    const sData = await sessionRes.json();
                    if (sData.user) {
                        sessionUser = { ...sData.user, id: sData.user.dbId || sData.user.id };
                        dispatch({ type: 'LOAD_STATE', payload: { currentUser: sessionUser, isAuthenticated: true } });
                    } else if (!cachedUser) {
                        dispatch({ type: 'LOAD_STATE', payload: { currentUser: null, isAuthenticated: false, isLoaded: true } });
                    }
                }
            } catch (_) { /* ignore */ }

            // 4. Apply init data (re-fetch if userId changed from cache to session)
            try {
                const realUserId = sessionUser?.dbId || sessionUser?.id;
                let data = null;
                if (realUserId && realUserId !== cachedUserId) {
                    const refetch = await fetch(`/api/init?userId=${realUserId}`, { cache: 'no-store' }).catch(() => null);
                    if (refetch?.ok) data = await refetch.json();
                } else if (initRes?.ok) {
                    data = await initRes.json();
                }
                if (data) {
                    if (data.games) dispatch({ type: 'LOAD_STATE', payload: { games: data.games } });
                    if (data.notifications) dispatch({ type: 'LOAD_STATE', payload: { notifications: data.notifications } });
                    if (data.friends) {
                        const tiers = {};
                        (data.tiers || []).forEach(t => { if (!tiers[t.friendId]) tiers[t.friendId] = {}; tiers[t.friendId][t.sport] = t.tier; });
                        dispatch({ type: 'LOAD_STATE', payload: {
                            friends: data.friends.map(f => f.id),
                            pendingFriends: data.pendingRequests || [],
                            players: [...data.friends, ...(data.pendingRequests || []), ...PLAYERS],
                            friendTiers: tiers,
                        } });
                    }
                }
            } catch (_) { /* ignore */ }

            dispatch({ type: 'LOAD_STATE', payload: { isLoaded: true } });
        };
        loadState();
    }, []);

    // Save slim state to localStorage whenever key data changes
    useEffect(() => {
        if (!state.isLoaded || !state.isAuthenticated || !state.currentUser?.id) return;
        try {
            const toSave = {
                currentUser: state.currentUser,
                isAuthenticated: state.isAuthenticated,
                activeTab: state.activeTab,
                friends: state.friends,
                pendingFriends: state.pendingFriends,
                friendTiers: state.friendTiers,
                games: (state.games || []).slice(0, 50).map(g => ({
                    ...g,
                    rsvps: (g.rsvps || []).map(r => ({ playerId: r.playerId, status: r.status, position: r.position || '', paymentStatus: r.paymentStatus || 'not_required' })),
                })),
                notifications: (state.notifications || []).slice(0, 20),
            };
            localStorage.setItem('sportsvault_state', JSON.stringify(toSave));
        } catch (_) { /* ignore */ }

        if (!state.isAuthenticated && !state.currentUser && typeof window !== 'undefined') {
            localStorage.removeItem('sportsvault_state');
            fetch('/api/auth/session', { method: 'DELETE' }).catch(() => { });
        }
    }, [state.isAuthenticated, state.currentUser, state.isLoaded, state.games, state.friends, state.friendTiers, state.notifications]);

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
