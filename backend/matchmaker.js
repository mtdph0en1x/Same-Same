const GameSession = require('./gameSession');
const { v4: uuidv4 } = require('uuid');

let queue = [];
let activeGames = {};

function addPlayer(io, socket, playerData) {
    queue.push({ socket, id: socket.id, name: playerData.name || "Anonymous" });
    socket.emit('matchmaking_joined');

    // For testing, starting with 2 players minimum. In prod, maybe 4.
    if (queue.length >= 2) { 
        const playersToMatch = queue.splice(0, 2); 
        const roomId = uuidv4();
        
        const gamePlayers = [];
        playersToMatch.forEach(p => {
            p.socket.join(roomId);
            gamePlayers.push({ id: p.id, name: p.name });
            p.socket.emit('match_found', { roomId });
        });

        const game = new GameSession(io, roomId, gamePlayers);
        activeGames[roomId] = game;
        game.start();
    }
}

function removePlayer(socketId) {
    queue = queue.filter(p => p.id !== socketId);
}

module.exports = {
    addPlayer,
    removePlayer,
    activeGames
};
