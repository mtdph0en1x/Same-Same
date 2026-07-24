const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const leoProfanity = require('leo-profanity');
const rateLimit = require('express-rate-limit');

const app = express();

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:8081', 'http://localhost:3000', 'https://same-same-one.vercel.app', 'https://same-same.fun', 'https://www.same-same.fun'];

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

// Initialize profanity filter for English and Russian
leoProfanity.loadDictionary('en');
try { leoProfanity.add(leoProfanity.getDictionary('ru')); } catch(e) {}

// HTTP Rate limiter for username checks (50 requests per 15 mins per IP)
const usernameLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { error: 'Too many username checks. Please try again later.' }
});

app.post('/check-username', usernameLimiter, (req, res) => {
    const { username } = req.body;
    if (!username || typeof username !== 'string') {
        return res.status(400).json({ error: 'Username is required' });
    }
    
    if (leoProfanity.check(username)) {
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
        origin: ALLOWED_ORIGINS,
        methods: ["GET", "POST"]
    }
});

const roomManager = require('./roomManager');
const { supabase } = require('./supabase');
const { loadTopics, getPackNames } = require('./gameLogic');
const announcementsManager = require('./announcementsManager');

// Socket Rate Limiter State
const socketRateLimits = new Map();
const SOCKET_EVENT_LIMIT = 40; // 40 events per 5 seconds
const SOCKET_EVENT_WINDOW = 5000; 

function checkRateLimit(socketId) {
    const now = Date.now();
    let records = socketRateLimits.get(socketId) || [];
    records = records.filter(time => now - time < SOCKET_EVENT_WINDOW);
    
    if (records.length >= SOCKET_EVENT_LIMIT) {
        return false;
    }
    
    records.push(now);
    socketRateLimits.set(socketId, records);
    return true;
}

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

    // Send latest announcements immediately
    socket.emit('announcements_data', announcementsManager.getAnnouncements());

    // Global event rate limiter to drop spam
    socket.use(([event, ...args], next) => {
        if (!checkRateLimit(socket.id)) {
            // Drop event silently or pass error to protect the server
            return next(new Error('Rate limit exceeded')); 
        }
        next();
    });

    // Mode 2: Couch Multiplayer
    socket.on('create_room', (playerData) => {
        roomManager.createRoom(io, socket, playerData);
    });

    socket.on('rejoin_room', ({ roomCode, sessionId }) => {
        roomManager.rejoinRoom(io, socket, roomCode, sessionId);
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

    socket.on('rematch_vote', ({ roomCode }) => {
        roomManager.rematchVote(io, socket, roomCode);
    });

    socket.on('get_available_packs', ({ lang = 'en' } = {}) => {
        const packs = getPackNames(lang);
        socket.emit('available_packs', { packs });
    });

    socket.on('get_public_lobbies', ({ lang = 'en' } = {}) => {
        const lobbies = [];
        const seenPermanent = new Set();

        // 1. Add all open public lobbies and open clones
        for (const [code, room] of Object.entries(roomManager.rooms)) {
            if (room.isPublic && !room.gameSession && room.config.lang === lang) {
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
            if (room.isPermanent && room.isPublic && room.config.lang === lang && !seenPermanent.has(code)) {
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
        if (typeof word !== 'string') return;
        const pId = socket.sessionId || socket.id;
        roomManager.submitWord(roomId, pId, word.trim().substring(0, 50));
    });

    socket.on('submit_vote', ({ roomCode, packId }) => {
        roomManager.submitVote(io, socket, roomCode, packId);
    });

    socket.on('vote_next_step', ({ roomId }) => {
        const pId = socket.sessionId || socket.id;
        roomManager.voteNextStep(roomId, pId);
    });

    socket.on('force_next_step', ({ roomId }) => {
        const pId = socket.sessionId || socket.id;
        roomManager.forceNextStep(roomId, pId);
    });

    socket.on('send_reaction', ({ roomId, reactionId, senderName }) => {
        if (typeof reactionId !== 'string' || typeof senderName !== 'string') return;
        io.to(roomId).emit('reaction_received', { 
            reactionId: reactionId.substring(0, 20), 
            senderName: senderName.trim().substring(0, 30), 
            xOffset: Math.random() 
        });
    });

    socket.on('send_chat', ({ roomId, message, senderName }) => {
        if (typeof message !== 'string' || typeof senderName !== 'string') return;
        const safeMsg = message.trim().substring(0, 250);
        if (!safeMsg) return;
        io.to(roomId).emit('chat_received', { 
            message: safeMsg, 
            senderName: senderName.trim().substring(0, 30), 
            timestamp: Date.now() 
        });
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        socketRateLimits.delete(socket.id);
        roomManager.handleDisconnect(io, socket);
    });
});

// Only bind a port when run directly (not when required by tests)
if (require.main === module) {
    (async () => {
        try {
            await loadTopics();
            roomManager.seedDefaultLobbies();
            announcementsManager.startAutoRefresh();
            
            const PORT = process.env.PORT || 3000;
            server.listen(PORT, () => {
                console.log(`Backend server running on port ${PORT}`);
            });
        } catch (err) {
            console.error("Failed to boot server:", err);
            process.exit(1);
        }
    })();
} else {
    // If required for tests, we just seed lobbies for safety (tests will handle topics)
    roomManager.seedDefaultLobbies();
}

module.exports = { app, server, io };
