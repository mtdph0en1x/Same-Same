const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Filter = require('bad-words');

const app = express();
app.use(cors());
app.use(express.json());

const filter = new Filter();

app.post('/check-username', (req, res) => {
    const { username } = req.body;
    if (!username || typeof username !== 'string') {
        return res.status(400).json({ error: 'Username is required' });
    }
    
    if (filter.isProfane(username)) {
        return res.status(400).json({ error: 'Inappropriate username detected.' });
    }
    
    const regex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!regex.test(username)) {
        return res.status(400).json({ error: 'Username must be 3-20 characters, alphanumeric and underscores only.' });
    }

    if (/^\d+$/.test(username)) {
        return res.status(400).json({ error: 'Username cannot be only numbers.' });
    }
    
    const reserved = ['admin', 'moderator', 'samesame', 'system', 'host', 'bot', 'guest'];
    if (reserved.includes(username.toLowerCase())) {
        return res.status(400).json({ error: 'This username is reserved.' });
    }
    
    res.json({ success: true });
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const matchmaker = require('./matchmaker');
const roomManager = require('./roomManager');
const { supabase } = require('./supabase');

// Seed the permanent default public lobbies
roomManager.seedDefaultLobbies();

io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
        try {
            const { data, error } = await supabase.auth.getUser(token);
            if (!error && data?.user) {
                socket.userId = data.user.id;
            }
        } catch (err) {
            console.error('Error verifying token:', err.message);
        }
    }
    next();
});

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id} (Auth: ${socket.userId || 'Guest'})`);

    // Mode 1: Matchmaking
    socket.on('join_matchmaking', (playerData) => {
        matchmaker.addPlayer(io, socket, playerData);
    });

    socket.on('leave_matchmaking', () => {
        matchmaker.removePlayer(socket.id);
    });

    socket.on('accept_match', ({ matchId }) => {
        matchmaker.acceptMatch(socket.id, matchId);
    });

    socket.on('decline_match', ({ matchId }) => {
        matchmaker.declineMatch(socket.id, matchId);
    });

    // Mode 2: Couch Multiplayer
    socket.on('create_room', (playerData) => {
        roomManager.createRoom(io, socket, playerData);
    });


    socket.on('join_room', ({ roomCode, playerData }) => {
        roomManager.joinRoom(io, socket, roomCode, playerData);
    });

    socket.on('kick_player', ({ roomCode, targetId }) => {
        roomManager.kickPlayer(io, socket, roomCode, targetId);
    });

    socket.on('leave_room', ({ roomCode }) => {
        roomManager.leaveRoom(io, socket, roomCode);
    });

    socket.on('update_config', ({ roomCode, config }) => {
        roomManager.updateConfig(io, socket, roomCode, config);
    });

    socket.on('update_teams', ({ roomCode, teams }) => {
        roomManager.updateTeams(io, socket, roomCode, teams);
    });

    socket.on('start_game', ({ roomCode }) => {
        roomManager.startGame(io, socket, roomCode);
    });

    socket.on('quick_play', (playerData) => {
        roomManager.findOrCreatePublicRoom(io, socket, playerData);
    });

    socket.on('play_again', ({ roomCode }) => {
        roomManager.playAgain(io, socket, roomCode);
    });

    socket.on('get_public_lobbies', () => {
        const lobbies = [];
        const seenPermanent = new Set();

        // 1. Add all open public lobbies and open clones
        for (const [code, room] of Object.entries(roomManager.rooms)) {
            if (room.isPublic && !room.gameSession) {
                lobbies.push({
                    code,
                    label:       room.config.roomName || room.label || code,
                    playerCount: room.players.length,
                    maxPlayers:  8,
                    hasCountdown: !!room.countdown,
                    roundTypes:  room.config.roundTypes,
                    timeLimit:   room.config.timeLimit,
                    isPermanent: !!room.isPermanent,
                });
                if (room.isPermanent) seenPermanent.add(code);
                if (room.isOverflowFor) seenPermanent.add(room.isOverflowFor);
            }
        }

        // 2. Guarantee permanent lobbies always appear, even if fully occupied
        for (const [code, room] of Object.entries(roomManager.rooms)) {
            if (room.isPermanent && room.isPublic && !seenPermanent.has(code)) {
                lobbies.push({
                    code,
                    label:       room.config.roomName || room.label || code,
                    playerCount: 0, // Since there are no open clones, the next player will start a fresh one
                    maxPlayers:  8,
                    hasCountdown: false,
                    roundTypes:  room.config.roundTypes,
                    timeLimit:   room.config.timeLimit,
                    isPermanent: true,
                });
                seenPermanent.add(code);
            }
        }

        socket.emit('public_lobbies', { lobbies });
    });

    // Gameplay actions
    socket.on('submit_word', ({ roomId, word }) => {
        roomManager.submitWord(roomId, socket.id, word);
    });

    socket.on('submit_vote', ({ roomCode, packId }) => {
        roomManager.submitVote(io, socket, roomCode, packId);
    });

    socket.on('vote_next_step', ({ roomId }) => {
        roomManager.voteNextStep(roomId, socket.id);
    });

    socket.on('force_next_step', ({ roomId }) => {
        roomManager.forceNextStep(roomId, socket.id);
    });

    socket.on('send_reaction', ({ roomId, reactionId, senderName }) => {
        io.to(roomId).emit('reaction_received', { reactionId, senderName, xOffset: Math.random() });
    });

    socket.on('send_chat', ({ roomId, message, senderName }) => {
        io.to(roomId).emit('chat_received', { message, senderName, timestamp: Date.now() });
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        matchmaker.removePlayer(socket.id);
        roomManager.handleDisconnect(io, socket);
    });
});

// Only bind a port when run directly (not when required by tests)
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Backend server running on port ${PORT}`);
    });
}

module.exports = { app, server, io };
