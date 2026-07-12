const GameSession = require('./gameSession');
const { v4: uuidv4 } = require('uuid');

const ACCEPT_TIMEOUT_MS = 15000;

const MODE_CONFIG = {
    duel: { minPlayers: 2, teamMode: false },
    team2v2: { minPlayers: 4, teamMode: true },
    team4v4: { minPlayers: 8, teamMode: true },
    solo4: { minPlayers: 4, teamMode: false },
    solo6: { minPlayers: 6, teamMode: false },
    solo8: { minPlayers: 8, teamMode: false }
};

let queues = {
    duel: [],
    team2v2: [],
    team4v4: [],
    solo4: [],
    solo6: [],
    solo8: []
};

let pendingMatches = {};
let activeGames = {};

function addPlayer(io, socket, playerData) {
    const mode = playerData.mode || 'solo4';
    if (!MODE_CONFIG[mode]) return;

    // Avoid duplicate queueing across all queues
    for (const q of Object.values(queues)) {
        if (q.find(p => p.id === socket.id)) return;
    }
    
    queues[mode].push({ socket, id: socket.id, name: playerData.name || "Anonymous", level: playerData.level || 1, avatar: playerData.avatar, mode });
    
    socket.emit('matchmaking_joined');
    checkQueue(io);
}

function removePlayer(socketId) {
    // Remove from all queues if they are in any
    for (const mode in queues) {
        queues[mode] = queues[mode].filter(p => p.id !== socketId);
    }

    // If they were in a pending match, treat it as a decline
    for (const matchId in pendingMatches) {
        const match = pendingMatches[matchId];
        if (match.players.find(p => p.id === socketId)) {
            handleDecline(matchId, socketId);
        }
    }
}

function checkQueue(io) {
    for (const [mode, q] of Object.entries(queues)) {
        const minPlayers = MODE_CONFIG[mode].minPlayers;
        if (q.length >= minPlayers) {
            const playersToMatch = q.splice(0, minPlayers);
            const matchId = uuidv4();
            
            pendingMatches[matchId] = {
                id: matchId,
                mode: mode,
                io: io,
                players: playersToMatch,
                acceptedIds: new Set(),
                timeout: setTimeout(() => handleTimeout(matchId), ACCEPT_TIMEOUT_MS)
            };

            playersToMatch.forEach(p => {
                p.socket.emit('match_found', { matchId, timeoutMs: ACCEPT_TIMEOUT_MS, mode });
            });
        }
    }
}

function acceptMatch(socketId, matchId) {
    const match = pendingMatches[matchId];
    if (!match) return;

    match.acceptedIds.add(socketId);
    
    // Check if everyone accepted
    if (match.acceptedIds.size === match.players.length) {
        clearTimeout(match.timeout);
        startMatch(matchId);
    }
}

function declineMatch(socketId, matchId) {
    handleDecline(matchId, socketId);
}

function handleDecline(matchId, decliningSocketId) {
    const match = pendingMatches[matchId];
    if (!match) return;

    clearTimeout(match.timeout);
    delete pendingMatches[matchId];

    // Anyone who wasn't the decliner goes back to the FRONT of their queue
    match.players.forEach(p => {
        if (p.id === decliningSocketId) {
            p.socket.emit('match_cancelled', { reason: 'You declined the match.' });
        } else {
            p.socket.emit('match_cancelled', { reason: 'Someone declined or failed to accept. Returning to queue...' });
            queues[p.mode].unshift(p); // Put back at the front
        }
    });

    // We put players back, so see if we can form a match again
    checkQueue(match.io);
}

function handleTimeout(matchId) {
    const match = pendingMatches[matchId];
    if (!match) return;

    delete pendingMatches[matchId];

    match.players.forEach(p => {
        if (match.acceptedIds.has(p.id)) {
            p.socket.emit('match_cancelled', { reason: 'Someone failed to accept. Returning to queue...' });
            queues[p.mode].unshift(p);
        } else {
            p.socket.emit('match_cancelled', { reason: 'You failed to accept the match.' });
        }
    });

    checkQueue(match.io);
}

function startMatch(matchId) {
    const match = pendingMatches[matchId];
    if (!match) return;

    delete pendingMatches[matchId];

    // Lazy load roomManager to avoid circular dependencies
    const roomManager = require('./roomManager');
    
    // Convert Matchmaker array to Player array format used by roomManager
    const roomPlayers = match.players.map(p => ({
        id: p.id,
        name: p.name,
        level: p.level || 1,
        avatar: p.avatar,
        socket: p.socket
    }));

    roomManager.createPublicRoom(match.io, roomPlayers, match.mode);
}

function reset() {
    queues = {
        duel: [], team2v2: [], team4v4: [], solo4: [], solo6: [], solo8: []
    };
    for (const matchId in pendingMatches) {
        clearTimeout(pendingMatches[matchId].timeout);
    }
    pendingMatches = {};
    activeGames = {};
}

module.exports = {
    addPlayer,
    removePlayer,
    acceptMatch,
    declineMatch,
    activeGames,
    MODE_CONFIG, // exported for testing if needed
    reset
};
