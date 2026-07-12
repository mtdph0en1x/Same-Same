const GameSession = require('./gameSession');
const { getPackNames } = require('./gameLogic');

const rooms = {};
const MIN_PLAYERS      = 2;
const MIN_TEAM_PLAYERS = 4;
const MAX_PLAYERS      = 8;

const VALID_ROUND_TYPES    = ['Same Same', 'But Different', 'Rush'];
const VALID_MAX_ROUNDS     = [3, 6, 9];
const VALID_TIME_LIMITS    = [30, 60, 90];
const VALID_WORDS_PER_ROUND = [3, 5, 7];

const DEFAULT_CONFIG = {
    maxRounds:     6,
    timeLimit:     60,
    wordsPerRound: 5,
    roundTypes:    ['Same Same', 'But Different', 'Rush'],
    categoryPack:  'classic',
    teamMode:      false,
};

function validateConfig(incoming) {
    const config = { ...DEFAULT_CONFIG };
    if (VALID_MAX_ROUNDS.includes(incoming.maxRounds))        config.maxRounds     = incoming.maxRounds;
    if (VALID_TIME_LIMITS.includes(incoming.timeLimit))       config.timeLimit     = incoming.timeLimit;
    if (VALID_WORDS_PER_ROUND.includes(incoming.wordsPerRound)) config.wordsPerRound = incoming.wordsPerRound;
    if (Array.isArray(incoming.roundTypes)) {
        const filtered = incoming.roundTypes.filter(t => VALID_ROUND_TYPES.includes(t));
        if (filtered.length > 0) config.roundTypes = filtered;
    }
    const validPacks = ['all', ...getPackNames()];
    if (validPacks.includes(incoming.categoryPack)) config.categoryPack = incoming.categoryPack;
    if (typeof incoming.teamMode === 'boolean') config.teamMode = incoming.teamMode;
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

// Assign a new player to whichever team has fewer members (A wins ties)
function assignTeam(teams) {
    const countA = Object.values(teams).filter(t => t === 'A').length;
    const countB = Object.values(teams).filter(t => t === 'B').length;
    return countA <= countB ? 'A' : 'B';
}

// Rebuild teams map to include only current players (prunes disconnected players)
function pruneTeams(teams, players) {
    const ids = new Set(players.map(p => p.id));
    const pruned = {};
    for (const [id, team] of Object.entries(teams)) {
        if (ids.has(id)) pruned[id] = team;
    }
    return pruned;
}

function safePlayerList(players) {
    return players.map(p => ({ id: p.id, name: p.name, level: p.level || 1, avatar: p.avatar, userId: p.socket?.userId }));
}

function createRoom(io, socket, playerData) {
    const roomCode = generateRoomCode();
    const player = { id: socket.id, name: playerData.name || 'Host', level: playerData.level || 1, avatar: playerData.avatar, socket };
    const teams = { [socket.id]: 'A' };

    rooms[roomCode] = {
        host:        socket.id,
        players:     [player],
        teams:       teams,
        gameSession: null,
        countdown:   null,
        config:      { ...DEFAULT_CONFIG },
        votes:       {},
    };

    socket.join(roomCode);
    socket.emit('room_created', {
        roomCode,
        host:    true,
        players: safePlayerList([player]),
        teams:   teams,
        config:  rooms[roomCode].config,
    });
}

function createPublicRoom(io, players, mmMode = 'solo4') {
    const roomCode = generateRoomCode();
    const hostId = players[0].id;
    const teams = {};
    const isTeamMode = mmMode === 'team2v2' || mmMode === 'team4v4';

    players.forEach(p => {
        p.socket.join(roomCode);
        if (isTeamMode) {
            teams[p.id] = assignTeam(teams); // Auto-assign to A/B
        }
    });

    const roomConfig = { ...DEFAULT_CONFIG, teamMode: isTeamMode };

    rooms[roomCode] = {
        host:        hostId,
        players:     players,
        teams:       teams,
        gameSession: null,
        countdown:   null,
        config:      roomConfig,
        isPublic:    true,
        votes:       {},
    };

    const safePlayers = safePlayerList(players);
    
    players.forEach(p => {
        p.socket.emit('joined_room', {
            roomCode,
            players: safePlayers,
            host:    p.id === hostId,
            config:  rooms[roomCode].config,
            teams:   teams,
            isPublic: true
        });
    });

    // Start 10-second countdown immediately
    startPublicCountdown(io, roomCode);
}

function startPublicCountdown(io, roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    let count = 10;
    io.to(roomCode).emit('countdown_started', { count });

    room.countdown = setInterval(() => {
        if (!rooms[roomCode]) {
            clearInterval(room.countdown);
            return;
        }
        
        count--;
        if (count > 0) {
            io.to(roomCode).emit('countdown_tick', { count });
        } else {
            clearInterval(room.countdown);
            room.countdown = null;

            // Tally votes
            if (Object.keys(room.votes).length > 0) {
                const tallies = {};
                for (const pack of Object.values(room.votes)) {
                    tallies[pack] = (tallies[pack] || 0) + 1;
                }
                
                let winningPack = 'classic';
                let maxVotes = 0;
                
                // Shuffle keys to handle ties randomly
                const packs = Object.keys(tallies).sort(() => Math.random() - 0.5);
                for (const pack of packs) {
                    if (tallies[pack] > maxVotes) {
                        maxVotes = tallies[pack];
                        winningPack = pack;
                    }
                }
                
                room.config.categoryPack = winningPack;
                io.to(roomCode).emit('config_updated', { config: room.config });
            }

            const gamePlayers = safePlayerList(room.players);
            const sessionConfig = {
                ...room.config,
                teams: room.config.teamMode ? { ...room.teams } : null,
            };
            room.gameSession = new GameSession(io, roomCode, gamePlayers, sessionConfig);
            room.gameSession.start();
        }
    }, 1000);
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

    const player = { id: socket.id, name: playerData.name || 'Player', level: playerData.level || 1, avatar: playerData.avatar, socket };
    room.players.push(player);

    // Auto-assign to the smaller team
    room.teams[socket.id] = assignTeam(room.teams);

    socket.join(roomCode);

    const safePlayers = safePlayerList(room.players);
    io.to(roomCode).emit('player_joined', { players: safePlayers, teams: room.teams });
    socket.emit('joined_room', {
        roomCode,
        players: safePlayers,
        host:    false,
        config:  room.config,
        teams:   room.teams,
    });
}

function updateConfig(io, socket, roomCode, incomingConfig) {
    const room = rooms[roomCode];
    if (!room || room.host !== socket.id || room.gameSession || room.countdown || room.isPublic) return;

    room.config = validateConfig(incomingConfig);
    io.to(roomCode).emit('config_updated', { config: room.config });
}

function updateTeams(io, socket, roomCode, incomingTeams) {
    const room = rooms[roomCode];
    if (!room || room.host !== socket.id || room.gameSession || room.countdown || room.isPublic) return;

    // Validate: every key must be a current player, every value must be 'A' or 'B'
    const playerIds = new Set(room.players.map(p => p.id));
    for (const [id, team] of Object.entries(incomingTeams)) {
        if (!playerIds.has(id) || (team !== 'A' && team !== 'B')) return;
    }

    room.teams = { ...incomingTeams };
    io.to(roomCode).emit('teams_updated', { teams: room.teams });
}

function kickPlayer(io, socket, roomCode, targetId) {
    const room = rooms[roomCode];
    if (!room || room.host !== socket.id || room.isPublic) return;
    if (targetId === socket.id) return;

    const target = room.players.find(p => p.id === targetId);
    if (!target) return;

    target.socket.emit('kicked', { message: 'You were removed from the lobby by the host.' });
    target.socket.leave(roomCode);

    room.players = room.players.filter(p => p.id !== targetId);
    room.teams   = pruneTeams(room.teams, room.players);

    const safePlayers = safePlayerList(room.players);
    io.to(roomCode).emit('player_joined', { players: safePlayers, teams: room.teams });
}

function leaveRoom(io, socket, roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);
    room.teams   = pruneTeams(room.teams, room.players);
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

    const safePlayers = safePlayerList(room.players);
    io.to(roomCode).emit('player_joined', { players: safePlayers, teams: room.teams });
}

function startGame(io, socket, roomCode) {
    const room = rooms[roomCode];
    if (!room || room.host !== socket.id || room.gameSession || room.countdown || room.isPublic) return;

    const minPlayers = room.config.teamMode ? MIN_TEAM_PLAYERS : MIN_PLAYERS;
    if (room.players.length < minPlayers) {
        socket.emit('room_error', {
            message: room.config.teamMode
                ? `Team mode needs at least ${MIN_TEAM_PLAYERS} players.`
                : `Need at least ${MIN_PLAYERS} players to start.`,
        });
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

            const gamePlayers = safePlayerList(room.players);
            const sessionConfig = {
                ...room.config,
                teams: room.config.teamMode ? { ...room.teams } : null,
            };
            room.gameSession = new GameSession(io, roomCode, gamePlayers, sessionConfig);
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
        room.teams   = pruneTeams(room.teams, room.players);

        if (room.players.length === 0) {
            delete rooms[code];
            continue;
        }

        if (room.gameSession) {
            room.gameSession.removePlayer(socket.id);
        }

        if (room.host === socket.id) {
            const newHost = room.players[0];
            room.host = newHost.id;
            io.to(code).emit('host_changed', { newHostId: newHost.id, newHostName: newHost.name });
        }

        const safePlayers = safePlayerList(room.players);
        io.to(code).emit('player_joined', { players: safePlayers, teams: room.teams });
    }
}

function submitVote(io, socket, roomCode, packId) {
    const room = rooms[roomCode];
    if (!room || !room.isPublic || room.gameSession) return;
    
    const validPacks = ['all', ...getPackNames()];
    if (!validPacks.includes(packId)) return;

    // Check if player is in the room
    if (!room.players.find(p => p.id === socket.id)) return;

    room.votes[socket.id] = packId;
    
    // Broadcast live vote counts
    const tallies = {};
    for (const pack of Object.values(room.votes)) {
        tallies[pack] = (tallies[pack] || 0) + 1;
    }
    
    io.to(roomCode).emit('votes_updated', { votes: tallies });
}

module.exports = {
    createRoom,
    createPublicRoom,
    joinRoom,
    updateConfig,
    updateTeams,
    kickPlayer,
    leaveRoom,
    startGame,
    submitWord,
    handleDisconnect,
    submitVote,
};


