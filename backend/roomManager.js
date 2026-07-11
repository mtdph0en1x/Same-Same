const GameSession = require('./gameSession');

const rooms = {};

function generateRoomCode() {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < 4; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function createRoom(io, socket, playerData) {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
        host: socket.id,
        players: [{ id: socket.id, name: playerData.name || "Host", socket }],
        gameSession: null
    };
    
    socket.join(roomCode);
    socket.emit('room_created', { roomCode, host: true });
}

function joinRoom(io, socket, roomCode, playerData) {
    const room = rooms[roomCode];
    if (room && !room.gameSession) {
        room.players.push({ id: socket.id, name: playerData.name || "Player", socket });
        socket.join(roomCode);
        
        const safePlayers = room.players.map(p => ({ id: p.id, name: p.name }));
        io.to(roomCode).emit('player_joined', { players: safePlayers });
        socket.emit('joined_room', { roomCode, players: safePlayers, host: false });
    } else {
        socket.emit('room_error', { message: 'Room not found or game already started' });
    }
}

function startGame(io, socket, roomCode) {
    const room = rooms[roomCode];
    if (room && room.host === socket.id && !room.gameSession) {
        const gamePlayers = room.players.map(p => ({ id: p.id, name: p.name }));
        room.gameSession = new GameSession(io, roomCode, gamePlayers);
        room.gameSession.start();
    }
}

function submitAnswer(roomId, playerId, answer) {
    const matchmaker = require('./matchmaker'); // Lazy load
    let game = null;

    if (matchmaker.activeGames[roomId]) {
        game = matchmaker.activeGames[roomId];
    } else if (rooms[roomId] && rooms[roomId].gameSession) {
        game = rooms[roomId].gameSession;
    }

    if (game) {
        game.submitAnswer(playerId, answer);
    }
}

function handleDisconnect(io, socket) {
    for (let code in rooms) {
        let room = rooms[code];
        room.players = room.players.filter(p => p.id !== socket.id);
        if (room.players.length === 0) {
            delete rooms[code];
        } else if (room.host === socket.id) {
            room.host = room.players[0].id;
            io.to(code).emit('host_changed', { host: room.host });
        }
    }
}

module.exports = {
    createRoom,
    joinRoom,
    startGame,
    submitAnswer,
    handleDisconnect
};
