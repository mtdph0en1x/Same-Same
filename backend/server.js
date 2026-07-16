const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

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
