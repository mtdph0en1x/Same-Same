const GameSession = require('./gameSession');
const { getPackNames } = require('./gameLogic');

const rooms = {};
const MIN_PLAYERS      = 2;
const MIN_TEAM_PLAYERS = 4;
const MAX_PLAYERS      = 8;

const VALID_ROUND_TYPES    = ['Same Same', 'But Different', 'Blitz'];
const VALID_MAX_ROUNDS     = [3, 6, 9];
const VALID_TIME_LIMITS    = [30, 60, 90];
const VALID_WORDS_PER_ROUND = [3, 5, 7];
const VALID_MODIFIERS      = ['Rush'];

const DEFAULT_CONFIG = {
    roomName:      '', // Used for Custom Public Lobbies
    maxRounds:     6,
    timeLimit:     60,
    wordsPerRound: 5,
    roundTypes:    ['Same Same', 'But Different', 'Blitz'],
    categoryPack:  'classic',
    teamMode:      false,
    modifiers:     [],
    isPublic:      false,
};

// ── Default permanent public lobbies seeded on startup ────────────────────────
const DEFAULT_LOBBIES = [
    {
        code: 'PLAY',
        label: 'Classic Mix',
        config: { ...DEFAULT_CONFIG, maxRounds: 6, timeLimit: 60, wordsPerRound: 5, roundTypes: ['Same Same', 'But Different', 'Blitz'] },
    },
    {
        code: 'FAST',
        label: 'Speed Round',
        config: { ...DEFAULT_CONFIG, maxRounds: 6, timeLimit: 30, wordsPerRound: 3, roundTypes: ['Same Same', 'Blitz'] },
    },
    {
        code: 'LONG',
        label: 'Marathon',
        config: { ...DEFAULT_CONFIG, maxRounds: 9, timeLimit: 90, wordsPerRound: 7, roundTypes: ['Same Same', 'But Different', 'Blitz'] },
    },
    {
        code: 'TEAM',
        label: 'Team Battle',
        config: { ...DEFAULT_CONFIG, maxRounds: 6, timeLimit: 60, wordsPerRound: 5, roundTypes: ['Same Same', 'But Different'], teamMode: true },
    },
];

function createDefaultLobby({ code, label, config }) {
    if (rooms[code]) return; // Already exists
    rooms[code] = {
        host:        null,
        players:     [],
        teams:       {},
        gameSession: null,
        countdown:   null,
        config:      { ...config },
        isPublic:    true,
        isHostless:  true,
        isPermanent: true,
        label,
        votes:       {},
    };
}

function seedDefaultLobbies() {
    DEFAULT_LOBBIES.forEach(createDefaultLobby);
}

function validateConfig(incoming) {
    const config = { ...DEFAULT_CONFIG };
    if (VALID_MAX_ROUNDS.includes(incoming.maxRounds))        config.maxRounds     = incoming.maxRounds;
    if (VALID_TIME_LIMITS.includes(incoming.timeLimit))       config.timeLimit     = incoming.timeLimit;
    if (VALID_WORDS_PER_ROUND.includes(incoming.wordsPerRound)) config.wordsPerRound = incoming.wordsPerRound;
    if (Array.isArray(incoming.roundTypes)) {
        const filtered = incoming.roundTypes.filter(t => VALID_ROUND_TYPES.includes(t));
        if (filtered.length > 0) config.roundTypes = filtered;
    }
    if (Array.isArray(incoming.modifiers)) {
        config.modifiers = incoming.modifiers.filter(m => VALID_MODIFIERS.includes(m));
    }
    const validPacks = ['all', ...getPackNames()];
    if (validPacks.includes(incoming.categoryPack)) config.categoryPack = incoming.categoryPack;
    if (typeof incoming.teamMode === 'boolean') config.teamMode = incoming.teamMode;
    if (typeof incoming.isPublic === 'boolean') config.isPublic = incoming.isPublic;
    if (typeof incoming.roomName === 'string') config.roomName = incoming.roomName.substring(0, 20); // Limit name length
    return config;
}

function generateRoomCode() {
    let result;
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    do {
        result = '';
        for (let i = 0; i < 4; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
    } while (rooms[result]); // Ensure uniqueness
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
        isPublic:    false,
        isHostless:  false,
        votes:       {},
    };

    socket.join(roomCode);
    socket.emit('room_created', {
        roomCode,
        host:    true,
        players: safePlayerList([player]),
        teams:   teams,
        config:  rooms[roomCode].config,
        isPublic: false,
        isHostless: false,
    });
}



// ── Quick Play: find an open public lobby or create a new one ────────────────
function findOrCreatePublicRoom(io, socket, playerData) {
    // Find an existing public room that hasn't started and has room
    const openRoom = Object.entries(rooms).find(([code, room]) => {
        return room.isPublic &&
               !room.gameSession &&
               room.players.length < MAX_PLAYERS;
    });

    const player = {
        id: socket.id,
        name: playerData.name || 'Player',
        level: playerData.level || 1,
        avatar: playerData.avatar,
        socket
    };

    if (openRoom) {
        const [roomCode, room] = openRoom;
        
        const existingPlayer = room.players.find(p => p.id === socket.id);
        if (!existingPlayer) {
            room.players.push(player);
            room.teams[socket.id] = assignTeam(room.teams);
        }
        
        socket.join(roomCode);

        const safePlayers = safePlayerList(room.players);
        io.to(roomCode).emit('player_joined', { players: safePlayers, teams: room.teams });
        socket.emit('joined_room', {
            roomCode,
            players: safePlayers,
            host: false,
            config: room.config,
            teams: room.teams,
            isPublic: true,
        });

        // If enough players and no countdown yet, start one
        if (room.players.length >= MIN_PLAYERS && !room.countdown) {
            startPublicCountdown(io, roomCode);
        }
    } else {
        // Create a new public room with this player as the first (and only)
        const roomCode = generateRoomCode();
        const teams = { [socket.id]: 'A' };

        rooms[roomCode] = {
            host: socket.id,
            players: [player],
            teams,
            gameSession: null,
            countdown: null,
            config: { ...DEFAULT_CONFIG },
            isPublic: true,
            isHostless: true,
            votes: {},
        };

        socket.join(roomCode);
        socket.emit('joined_room', {
            roomCode,
            players: safePlayerList([player]),
            host: true,
            config: rooms[roomCode].config,
            teams,
            isPublic: true,
            waitingForPlayers: true,
        });
    }
}

// ── Play Again: reset game session and return everyone to the lobby ────────────
function playAgain(io, socket, roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    // For private rooms or hosted public rooms, only the host can do this
    if (!room.isHostless && room.host !== socket.id) return;

    // Clear game state
    if (room.gameSession) {
        room.gameSession = null;
    }
    if (room.countdown) {
        clearInterval(room.countdown);
        room.countdown = null;
    }
    room.votes = {};

    // Broadcast lobby return to all connected players
    io.to(roomCode).emit('force_lobby', {
        roomCode,
        players: safePlayerList(room.players),
        host: room.host,
        config: room.config,
        teams: room.teams,
        isPublic: room.isPublic,
    });

    // For hostless public rooms, restart the countdown if enough players remain
    if (room.isHostless && room.players.length >= MIN_PLAYERS) {
        setTimeout(() => startPublicCountdown(io, roomCode), 2000);
    }
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
        isHostless:  true,
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
                isPublic: room.isPublic || false,
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

    // Overflow logic for permanent lobbies
    if (room.isPermanent && (room.gameSession || room.players.length >= MAX_PLAYERS)) {
        // Find existing overflow clone that is open
        const openClone = Object.entries(rooms).find(([code, r]) => {
            return r.isOverflowFor === roomCode && !r.gameSession && r.players.length < MAX_PLAYERS;
        });

        if (openClone) {
            return joinRoom(io, socket, openClone[0], playerData);
        } else {
            // Create a new overflow clone
            const newCode = generateRoomCode();
            const player = { id: socket.id, name: playerData.name || 'Player', level: playerData.level || 1, avatar: playerData.avatar, socket };
            const teams = { [socket.id]: 'A' };
            
            rooms[newCode] = {
                host: socket.id, // technically hostless, but ID stored for migration
                players: [player],
                teams,
                gameSession: null,
                countdown: null,
                config: { ...room.config },
                isPublic: true,
                isHostless: true,
                isOverflowFor: roomCode,
                label: room.label,
                votes: {},
            };
            
            socket.join(newCode);
            socket.emit('joined_room', {
                roomCode: newCode,
                players: safePlayerList([player]),
                host: false,
                config: rooms[newCode].config,
                teams,
                isPublic: true,
                isHostless: true,
                waitingForPlayers: true,
            });
            return;
        }
    }

    if (room.gameSession) {
        socket.emit('room_error', { message: 'Game has already started.' });
        return;
    }
    if (room.players.length >= MAX_PLAYERS) {
        socket.emit('room_error', { message: `Room is full (max ${MAX_PLAYERS} players).` });
        return;
    }

    const player = { id: socket.id, name: playerData.name || 'Player', level: playerData.level || 1, avatar: playerData.avatar, socket };
    
    const existingPlayer = room.players.find(p => p.id === socket.id);
    if (!existingPlayer) {
        room.players.push(player);
        // Auto-assign to the smaller team
        room.teams[socket.id] = assignTeam(room.teams);
    }

    socket.join(roomCode);

    const safePlayers = safePlayerList(room.players);
    io.to(roomCode).emit('player_joined', { players: safePlayers, teams: room.teams });
    socket.emit('joined_room', {
        roomCode,
        players: safePlayers,
        host:    !room.isHostless && room.host === socket.id,
        config:  room.config,
        teams:   room.teams,
        isPublic: room.isPublic,
        isHostless: room.isHostless || false,
    });

    // Auto-start for hostless public rooms
    if (room.isPublic && room.isHostless && room.players.length >= MAX_PLAYERS && !room.countdown && !room.gameSession) {
        startPublicCountdown(io, roomCode);
    }
}

function updateConfig(io, socket, roomCode, incomingConfig) {
    const room = rooms[roomCode];
    if (!room || room.host !== socket.id || room.gameSession || room.countdown || room.isHostless) return;

    room.config = validateConfig(incomingConfig);
    room.isPublic = room.config.isPublic; // Sync top-level flag
    
    io.to(roomCode).emit('config_updated', { config: room.config });
}

function updateTeams(io, socket, roomCode, incomingTeams) {
    const room = rooms[roomCode];
    if (!room || room.host !== socket.id || room.gameSession || room.countdown || room.isHostless) return;

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
    if (!room || room.host !== socket.id || room.isHostless) return;
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
        if (room.isPermanent) {
            room.gameSession = null;
            room.countdown   = null;
            room.votes       = {};
            room.teams       = {};
            room.host        = null;
        } else {
            delete rooms[roomCode];
        }
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
    if (!room || room.host !== socket.id || room.gameSession || room.countdown || room.isHostless) return;

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

function voteNextStep(roomId, playerId) {
    const matchmaker = require('./matchmaker'); // Lazy load
    let game = null;

    if (matchmaker.activeGames[roomId]) {
        game = matchmaker.activeGames[roomId];
    } else if (rooms[roomId] && rooms[roomId].gameSession) {
        game = rooms[roomId].gameSession;
    }

    if (game) {
        game.voteNextStep(playerId);
    }
}

function forceNextStep(roomId, playerId) {
    const room = rooms[roomId];
    if (room && room.host === playerId && room.gameSession) {
        room.gameSession.forceNextStep();
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
            if (room.isPermanent) {
                // Recreate the lobby skeleton instead of deleting it
                room.gameSession = null;
                room.countdown   = null;
                room.votes       = {};
                room.teams       = {};
                room.host        = null;
            } else {
                delete rooms[code];
            }
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
    findOrCreatePublicRoom,
    joinRoom,
    updateConfig,
    updateTeams,
    kickPlayer,
    leaveRoom,
    startGame,
    playAgain,
    submitWord,
    voteNextStep,
    forceNextStep,
    handleDisconnect,
    submitVote,
    seedDefaultLobbies,
    rooms,
};


