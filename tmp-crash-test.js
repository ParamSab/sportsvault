const PLAYERS = [ { id: 'p1', name: 'Mock' } ];

const state = {
    friends: ['u1'], // string mapped
    pendingFriends: [{ id: 'u2', isSender: false }], // object mapped
    players: [ { id: 'u1', name: 'User 1' }, { id: 'u2', name: 'User 2' }, ...PLAYERS ]
};

const playerId = 'u2';

// Simulated FriendsPage re-render computations
try {
    const friendPlayers = (state.friends || [])
        .map(fId => PLAYERS.find(p => p.id === fId) || (state.players || []).find(p => p.id === fId))
        .filter(Boolean);

    console.log('friendPlayers:', friendPlayers);

    const isPendingSent = (state.pendingFriends || []).some(f => String(f.id) === playerId && f.isSender);
    const isPendingReceived = (state.pendingFriends || []).some(f => String(f.id) === playerId && !f.isSender);

    console.log('isPendingSent:', isPendingSent);
    console.log('isPendingReceived:', isPendingReceived);

    const pendingReceived = (state.pendingFriends || []).filter(f => !f.isSender) || [];

    console.log('pendingReceived:', pendingReceived);

} catch (err) {
    console.error('CRASH!', err.message, err.stack);
}
