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
const VALID_MODIFIERS      = ['Rush', 'Hardcore', 'Zen'];

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
    lang:          'en',
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
    const langs = ['en', 'es', 'ru', 'uk'];
    langs.forEach(lang => {
        DEFAULT_LOBBIES.forEach(lobby => {
            createDefaultLobby({
                code: `${lobby.code}-${lang.toUpperCase()}`,
                label: lobby.label,
                config: { ...lobby.config, lang }
            });
        });
    });
}

function validateConfig(incoming, currentConfig = DEFAULT_CONFIG) {
    const config = { ...currentConfig };
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
    
    const validLangs = ['en', 'es', 'ru', 'uk'];
    if (validLangs.includes(incoming.lang)) config.lang = incoming.lang;

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
    return players.map(p => ({ id: p.id, name: p.name, level: p.level || 1, avatar: p.avatar, frame: p.frame, userId: p.socket?.userId }));
}

function createRoom(io, socket, playerData) {
    const roomCode = generateRoomCode();
    const sessionId = playerData.sessionId || socket.id;
    socket.sessionId = sessionId;
    const player = { id: sessionId, name: playerData.name || 'Host', level: playerData.level || 1, avatar: playerData.avatar, frame: playerData.frame, socket };
    const teams = { [sessionId]: 'A' };

    rooms[roomCode] = {
        host:        sessionId,
        players:     [player],
        teams:       teams,
        gameSession: null,
        countdown:   null,
        config:      { ...DEFAULT_CONFIG, lang: playerData.lang || 'en' },
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
               room.config.lang === (playerData.lang || 'en') &&
               room.players.length < MAX_PLAYERS;
    });

    const sessionId = playerData.sessionId || socket.id;
    socket.sessionId = sessionId;

    const player = {
        id: sessionId,
        name: playerData.name || 'Player',
        level: playerData.level || 1,
        avatar: playerData.avatar,
        frame: playerData.frame,
        socket
    };

    if (openRoom) {
        const [roomCode, room] = openRoom;
        
        const existingPlayer = room.players.find(p => p.id === sessionId);
        if (!existingPlayer) {
            room.players.push(player);
            room.teams[sessionId] = assignTeam(room.teams);
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
        const teams = { [sessionId]: 'A' };

        rooms[roomCode] = {
            host: sessionId,
            players: [player],
            teams,
            gameSession: null,
            countdown: null,
            config: { ...DEFAULT_CONFIG, lang: playerData.lang || 'en' },
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

    const pId = socket.sessionId || socket.id;
    if (!room.isHostless && room.host !== pId) return;

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
            console.log(`[DEBUG-TOPIC] startGame -> roomCode: ${roomCode}, room.config.lang: ${room.config.lang}, sessionConfig.lang: ${sessionConfig.lang}, room.config.categoryPack: ${room.config.categoryPack}`);
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

    const sessionId = playerData.sessionId || socket.id;
    socket.sessionId = sessionId;

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
            const player = { id: sessionId, name: playerData.name || 'Player', level: playerData.level || 1, avatar: playerData.avatar, frame: playerData.frame, socket };
            const teams = { [sessionId]: 'A' };
            
            rooms[newCode] = {
                host: sessionId, // technically hostless, but ID stored for migration
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

    const player = { id: sessionId, name: playerData.name || 'Player', level: playerData.level || 1, avatar: playerData.avatar, frame: playerData.frame, socket };
    
    const existingPlayer = room.players.find(p => p.id === sessionId);
    if (!existingPlayer) {
        room.players.push(player);
        // Auto-assign to the smaller team
        room.teams[sessionId] = assignTeam(room.teams);
    }

    socket.join(roomCode);

    const safePlayers = safePlayerList(room.players);
    io.to(roomCode).emit('player_joined', { players: safePlayers, teams: room.teams });
    socket.emit('joined_room', {
        roomCode,
        players: safePlayers,
        host:    !room.isHostless && room.host === sessionId,
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
    const pId = socket.sessionId || socket.id;
    if (!room || room.host !== pId || room.gameSession || room.countdown || room.isHostless) return;

    room.config = validateConfig(incomingConfig, room.config);
    room.isPublic = room.config.isPublic; // Sync top-level flag
    
    io.to(roomCode).emit('config_updated', { config: room.config });
}

function updateTeams(io, socket, roomCode, incomingTeams) {
    const room = rooms[roomCode];
    const pId = socket.sessionId || socket.id;
    if (!room || room.host !== pId || room.gameSession || room.countdown || room.isHostless) return;

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
    const pId = socket.sessionId || socket.id;
    if (!room || room.host !== pId || room.isHostless) return;
    if (targetId === pId) return;

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

    const pId = socket.sessionId || socket.id;
    room.players = room.players.filter(p => p.id !== pId);
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

    if (room.host === pId) {
        const newHost = room.players[0];
        room.host = newHost.id;
        io.to(roomCode).emit('host_changed', { newHostId: newHost.id, newHostName: newHost.name });
    }

    const safePlayers = safePlayerList(room.players);
    io.to(roomCode).emit('player_joined', { players: safePlayers, teams: room.teams });
}

function startGame(io, socket, roomCode) {
    const room = rooms[roomCode];
    const pId = socket.sessionId || socket.id;
    if (!room || room.host !== pId || room.gameSession || room.countdown || room.isHostless) return;

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
    const room = rooms[roomId];
    if (room && room.gameSession) {
        room.gameSession.submitWord(playerId, word);
    }
}

function voteNextStep(roomId, playerId) {
    const room = rooms[roomId];
    if (room && room.gameSession) {
        room.gameSession.voteNextStep(playerId);
    }
}

function forceNextStep(roomId, playerId) {
    const room = rooms[roomId];
    if (room && room.host === playerId && room.gameSession) {
        room.gameSession.forceNextStep();
    }
}

function handleDisconnect(io, socket) {
    const pId = socket.sessionId || socket.id;
    for (let code in rooms) {
        const room = rooms[code];
        const wasInRoom = room.players.find(p => p.id === pId);
        if (!wasInRoom) continue;

        wasInRoom.disconnected = true;

        wasInRoom.disconnectTimer = setTimeout(() => {
            if (!rooms[code]) return;
            const p = rooms[code].players.find(p => p.id === pId);
            if (!p || !p.disconnected) return; // They reconnected!

            room.players = room.players.filter(p => p.id !== pId);
            room.teams   = pruneTeams(room.teams, room.players);

            if (room.players.length === 0) {
                if (room.isPermanent) {
                    room.gameSession = null;
                    room.countdown   = null;
                    room.votes       = {};
                    room.teams       = {};
                    room.host        = null;
                } else {
                    delete rooms[code];
                }
                return;
            }

            if (room.gameSession) {
                room.gameSession.removePlayer(pId);
            }

            if (room.host === pId) {
                const newHost = room.players[0];
                room.host = newHost.id;
                io.to(code).emit('host_changed', { newHostId: newHost.id, newHostName: newHost.name });
            }

            const safePlayers = safePlayerList(room.players);
            io.to(code).emit('player_joined', { players: safePlayers, teams: room.teams });
        }, 30000); // 30 second grace period
    }
}

function rejoinRoom(io, socket, roomCode, sessionId) {
    const room = rooms[roomCode];
    if (!room) {
        socket.emit('room_error', { message: 'Room no longer exists.' });
        return;
    }

    const player = room.players.find(p => p.id === sessionId);
    if (!player) {
        socket.emit('room_error', { message: 'Player not found in room.' });
        return;
    }

    if (player.disconnectTimer) {
        clearTimeout(player.disconnectTimer);
        player.disconnectTimer = null;
    }
    
    player.disconnected = false;
    player.socket = socket;
    socket.sessionId = sessionId;
    
    socket.join(roomCode);
    
    const safePlayers = safePlayerList(room.players);
    socket.emit('joined_room', {
        roomCode,
        players: safePlayers,
        host:    !room.isHostless && room.host === sessionId,
        config:  room.config,
        teams:   room.teams,
        isPublic: room.isPublic,
        isHostless: room.isHostless || false,
    });
    
    if (room.gameSession) {
        const gs = room.gameSession;
        
        if (gs.isGameOver) {
            const playerNames = {};
            const playerAvatars = {};
            const playerFrames = {};
            gs.players.forEach(p => { playerNames[p.id] = p.name; playerAvatars[p.id] = p.avatar; playerFrames[p.id] = p.frame; });
            socket.emit('game_over', {
                scores:       gs.scores,
                teams:        gs.teams,
                teamScores:   gs.teamScores,
                playerNames,
                playerAvatars,
                playerFrames,
                isPublic:     gs.config.isPublic || false,
                roomCode,
            });
        } else {
            socket.emit('game_started', {
                players: safePlayers,
                teams: room.teams
            });
            
            if (gs.timeline) {
                // Return them to ResultsScreen
                const playerNames = {};
                const playerAvatars = {};
                const playerFrames = {};
                gs.players.forEach(p => { 
                    playerNames[p.id] = p.name; 
                    playerAvatars[p.id] = p.avatar;
                    playerFrames[p.id] = p.frame;
                });
                
                socket.emit('round_ended', {
                    timeline:     gs.timeline,
                    playerWords:  gs.lastWordSnapshot || {},
                    groups:       gs.lastGroups || [],
                    roundType:    gs.currentRoundType(),
                    wordsPerRound: gs.config.wordsPerRound,
                    scoreUpdates: gs.lastScoreUpdates || {},
                    newScores:    gs.scores,
                    playerNames:  playerNames,
                    playerAvatars: playerAvatars,
                    playerFrames: playerFrames,
                    teams:        gs.teams,
                    teamScores:   gs.teamScores,
                    rejectedWords: gs.lastRejectedWords || [], 
                });
                // Sync review step
                socket.emit('review_step_advanced', {
                    step: gs.reviewCurrentStep
                });
                socket.emit('review_votes_updated', {
                    votes: gs.reviewVotes ? gs.reviewVotes.size : 0,
                    threshold: Math.floor(gs.players.length / 2) + 1
                });
            } else if (gs.currentRound > 0) {
                 socket.emit('round_started', {
                    roundNumber:   gs.currentRound,
                    totalRounds:   gs.config.maxRounds,
                    roundType:     gs.currentRoundType(),
                    category:      gs.currentCategory,
                    timeLimit:     gs.config.timeLimit,
                    wordsPerRound: gs.config.wordsPerRound,
                });
            }
        }
    }
}

function submitVote(io, socket, roomCode, packId) {
    const room = rooms[roomCode];
    if (!room || !room.isPublic || room.gameSession) return;
    
    const validPacks = ['all', ...getPackNames()];
    if (!validPacks.includes(packId)) return;

    const pId = socket.sessionId || socket.id;

    // Check if player is in the room
    if (!room.players.find(p => p.id === pId)) return;

    room.votes[pId] = packId;
    
    // Broadcast live vote counts
    const tallies = {};
    for (const pack of Object.values(room.votes)) {
        tallies[pack] = (tallies[pack] || 0) + 1;
    }
    
    io.to(roomCode).emit('votes_updated', { votes: tallies });
}

module.exports = {
    createRoom,
    findOrCreatePublicRoom,
    joinRoom,
    rejoinRoom,
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


