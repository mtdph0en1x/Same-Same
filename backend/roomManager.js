const GameSession = require('./gameSession');
const { getPackNames } = require('./gameLogic');

const rooms = {};
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;

const VALID_ROUND_TYPES   = ['Same Same', 'But Different', 'Rush'];
const VALID_MAX_ROUNDS    = [3, 6, 9];
const VALID_TIME_LIMITS   = [30, 60, 90];
const VALID_WORDS_PER_ROUND = [3, 5, 7];

const DEFAULT_CONFIG = {
    maxRounds:     6,
    timeLimit:     60,
    wordsPerRound: 5,
    roundTypes:    ['Same Same', 'But Different', 'Rush'],
    categoryPack:  'classic',
};

function validateConfig(incoming) {
    const config = { ...DEFAULT_CONFIG };
    if (VALID_MAX_ROUNDS.includes(incoming.maxRounds))       config.maxRounds     = incoming.maxRounds;
    if (VALID_TIME_LIMITS.includes(incoming.timeLimit))      config.timeLimit     = incoming.timeLimit;
    if (VALID_WORDS_PER_ROUND.includes(incoming.wordsPerRound)) config.wordsPerRound = incoming.wordsPerRound;
    if (Array.isArray(incoming.roundTypes)) {
        const filtered = incoming.roundTypes.filter(t => VALID_ROUND_TYPES.includes(t));
        if (filtered.length > 0) config.roundTypes = filtered;
    }
    const validPacks = ['all', ...getPackNames()];
    if (validPacks.includes(incoming.categoryPack)) config.categoryPack = incoming.categoryPack;
    return config;
}

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
    const safePlayers = [{ id: socket.id, name: playerData.name || "Host" }];
    rooms[roomCode] = {
        host: socket.id,
        players: [{ id: socket.id, name: playerData.name || "Host", socket }],
        gameSession: null,
        countdown: null,
        config: { ...DEFAULT_CONFIG },
    };

    socket.join(roomCode);
    socket.emit('room_created', {
        roomCode,
        host: true,
        players: safePlayers,
        config: rooms[roomCode].config,
    });
}

function joinRoom(io, socket, roomCode, playerData) {
    const room = rooms[roomCode];
    if (!room) {
        socket.emit('room_error', { message: 'Room not found.' });
        return;
    }
    if (room.gameSession || room.countdown) {
        socket.emit('room_error', { message: 'Game has already started.' });
        return;
    }
    if (room.players.length >= MAX_PLAYERS) {
        socket.emit('room_error', { message: `Room is full (max ${MAX_PLAYERS} players).` });
        return;
    }

    room.players.push({ id: socket.id, name: playerData.name || "Player", socket });
    socket.join(roomCode);

    const safePlayers = room.players.map(p => ({ id: p.id, name: p.name }));
    io.to(roomCode).emit('player_joined', { players: safePlayers });
    socket.emit('joined_room', { roomCode, players: safePlayers, host: false, config: room.config });
}

function updateConfig(io, socket, roomCode, incomingConfig) {
    const room = rooms[roomCode];
    if (!room || room.host !== socket.id || room.gameSession || room.countdown) return;

    room.config = validateConfig(incomingConfig);
    io.to(roomCode).emit('config_updated', { config: room.config });
}

function kickPlayer(io, socket, roomCode, targetId) {
    const room = rooms[roomCode];
    if (!room || room.host !== socket.id) return;
    if (targetId === socket.id) return;

    const target = room.players.find(p => p.id === targetId);
    if (!target) return;

    target.socket.emit('kicked', { message: 'You were removed from the lobby by the host.' });
    target.socket.leave(roomCode);

    room.players = room.players.filter(p => p.id !== targetId);
    const safePlayers = room.players.map(p => ({ id: p.id, name: p.name }));
    io.to(roomCode).emit('player_joined', { players: safePlayers });
}

function leaveRoom(io, socket, roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);
    socket.leave(roomCode);

    if (room.players.length === 0) {
        delete rooms[roomCode];
        return;
    }

    if (room.host === socket.id) {
        const newHost = room.players[0];
        room.host = newHost.id;
        io.to(roomCode).emit('host_changed', { newHostId: newHost.id, newHostName: newHost.name });
    }

    const safePlayers = room.players.map(p => ({ id: p.id, name: p.name }));
    io.to(roomCode).emit('player_joined', { players: safePlayers });
}

function startGame(io, socket, roomCode) {
    const room = rooms[roomCode];
    if (!room || room.host !== socket.id || room.gameSession || room.countdown) return;
    if (room.players.length < MIN_PLAYERS) {
        socket.emit('room_error', { message: `Need at least ${MIN_PLAYERS} players to start.` });
        return;
    }

    let count = 3;
    io.to(roomCode).emit('countdown_started', { count });

    room.countdown = setInterval(() => {
        count--;
        if (count > 0) {
            io.to(roomCode).emit('countdown_tick', { count });
        } else {
            clearInterval(room.countdown);
            room.countdown = null;

            const gamePlayers = room.players.map(p => ({ id: p.id, name: p.name }));
            room.gameSession = new GameSession(io, roomCode, gamePlayers, room.config);
            room.gameSession.start();
        }
    }, 1000);
}

function submitWord(roomId, playerId, word) {
    const matchmaker = require('./matchmaker'); // Lazy load
    let game = null;

    if (matchmaker.activeGames[roomId]) {
        game = matchmaker.activeGames[roomId];
    } else if (rooms[roomId] && rooms[roomId].gameSession) {
        game = rooms[roomId].gameSession;
    }

    if (game) {
        game.submitWord(playerId, word);
    }
}

function handleDisconnect(io, socket) {
    for (let code in rooms) {
        const room = rooms[code];
        const wasInRoom = room.players.find(p => p.id === socket.id);
        if (!wasInRoom) continue;

        room.players = room.players.filter(p => p.id !== socket.id);

        if (room.players.length === 0) {
            delete rooms[code];
            continue;
        }

        if (room.host === socket.id) {
            const newHost = room.players[0];
            room.host = newHost.id;
            io.to(code).emit('host_changed', { newHostId: newHost.id, newHostName: newHost.name });
        }

        const safePlayers = room.players.map(p => ({ id: p.id, name: p.name }));
        io.to(code).emit('player_joined', { players: safePlayers });
    }
}

module.exports = {
    createRoom,
    joinRoom,
    updateConfig,
    kickPlayer,
    leaveRoom,
    startGame,
    submitWord,
    handleDisconnect,
};
