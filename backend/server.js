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

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Mode 1: Matchmaking
    socket.on('join_matchmaking', (playerData) => {
        matchmaker.addPlayer(io, socket, playerData);
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
