const GameSession = require('./gameSession');
const { v4: uuidv4 } = require('uuid');

const MIN_PLAYERS = 4;
const ACCEPT_TIMEOUT_MS = 15000;

let queue = [];
let pendingMatches = {};
let activeGames = {};

function addPlayer(io, socket, playerData) {
    // Avoid duplicate queueing
    if (!queue.find(p => p.id === socket.id)) {
        queue.push({ socket, id: socket.id, name: playerData.name || "Anonymous" });
    }
    
    socket.emit('matchmaking_joined');
    checkQueue(io);
}

function removePlayer(socketId) {
    // Remove from queue if they are in it
    queue = queue.filter(p => p.id !== socketId);

    // If they were in a pending match, treat it as a decline
    for (const matchId in pendingMatches) {
        const match = pendingMatches[matchId];
        if (match.players.find(p => p.id === socketId)) {
            handleDecline(matchId, socketId);
        }
    }
}

function checkQueue(io) {
    if (queue.length >= MIN_PLAYERS) {
        const playersToMatch = queue.splice(0, MIN_PLAYERS);
        const matchId = uuidv4();
        
        pendingMatches[matchId] = {
            id: matchId,
            io: io,
            players: playersToMatch,
            acceptedIds: new Set(),
            timeout: setTimeout(() => handleTimeout(matchId), ACCEPT_TIMEOUT_MS)
        };

        playersToMatch.forEach(p => {
            p.socket.emit('match_found', { matchId, timeoutMs: ACCEPT_TIMEOUT_MS });
        });
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

    // Anyone who wasn't the decliner goes back to the FRONT of the queue
    match.players.forEach(p => {
        if (p.id === decliningSocketId) {
            p.socket.emit('match_cancelled', { reason: 'You declined the match.' });
        } else {
            p.socket.emit('match_cancelled', { reason: 'Someone declined or failed to accept. Returning to queue...' });
            queue.unshift(p); // Put back at the front
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
            queue.unshift(p);
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
        socket: p.socket
    }));

    roomManager.createPublicRoom(match.io, roomPlayers);
}

function reset() {
    queue = [];
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
    MIN_PLAYERS, // exported for testing if needed
    reset
};
