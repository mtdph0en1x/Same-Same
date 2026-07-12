'use strict';

const { createServer } = require('http');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const { server, io } = require('../server');
const matchmaker = require('../matchmaker');

// Helpers
function startServer() {
    return new Promise((resolve) => {
        server.listen(0, () => {
            const { port } = server.address();
            resolve(`http://localhost:${port}`);
        });
    });
}

function stopServer() {
    return new Promise((resolve) => {
        io.close(() => {
            server.close((err) => {
                if (err && err.code !== 'ERR_SERVER_NOT_RUNNING') {
                    console.warn('stopServer warning:', err.message);
                }
                resolve();
            });
        });
    });
}

function connect(url) {
    return new Promise((resolve, reject) => {
        const socket = ioClient(url, { forceNew: true });
        socket.once('connect', () => resolve(socket));
        socket.once('connect_error', reject);
    });
}

function waitFor(socket, event, timeout = 3000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`Timed out waiting for "${event}"`)),
            timeout
        );
        socket.once(event, (data) => {
            clearTimeout(timer);
            resolve(data);
        });
    });
}

describe('Matchmaking Flow', () => {
    let url;
    let sockets = [];

    beforeAll(async () => {
        url = await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(() => {
        sockets.forEach(s => s.disconnect());
        sockets = [];
        matchmaker.reset();
    });

    test('4 players join, match is found, all accept -> game starts', async () => {
        const p1 = await connect(url);
        const p2 = await connect(url);
        const p3 = await connect(url);
        const p4 = await connect(url);
        sockets.push(p1, p2, p3, p4);

        const j1 = waitFor(p1, 'matchmaking_joined');
        const j2 = waitFor(p2, 'matchmaking_joined');
        const j3 = waitFor(p3, 'matchmaking_joined');

        p1.emit('join_matchmaking', { name: 'Player 1' });
        p2.emit('join_matchmaking', { name: 'Player 2' });
        p3.emit('join_matchmaking', { name: 'Player 3' });
        
        await Promise.all([j1, j2, j3]);

        // P4 joins, triggers match
        const m1Promise = waitFor(p1, 'match_found');
        const m2Promise = waitFor(p2, 'match_found');
        const m3Promise = waitFor(p3, 'match_found');
        const m4Promise = waitFor(p4, 'match_found');

        p4.emit('join_matchmaking', { name: 'Player 4' });
        
        const [m1, m2, m3, m4] = await Promise.all([m1Promise, m2Promise, m3Promise, m4Promise]);

        expect(m1.matchId).toBeDefined();
        expect(m1.matchId).toBe(m2.matchId);

        const s1 = waitFor(p1, 'joined_room');
        const s2 = waitFor(p2, 'joined_room');
        const s3 = waitFor(p3, 'joined_room');
        const s4 = waitFor(p4, 'joined_room');

        // Everyone accepts
        p1.emit('accept_match', { matchId: m1.matchId });
        p2.emit('accept_match', { matchId: m1.matchId });
        p3.emit('accept_match', { matchId: m1.matchId });
        p4.emit('accept_match', { matchId: m1.matchId });

        // Game should start (creates public room)
        const results = await Promise.all([s1, s2, s3, s4]);
        expect(results[0].isPublic).toBe(true);
    });

    test('Match is cancelled if one person declines, and other players are requeued', async () => {
        const p1 = await connect(url);
        const p2 = await connect(url);
        const p3 = await connect(url);
        const p4 = await connect(url);
        sockets.push(p1, p2, p3, p4);

        const m1Promise = waitFor(p1, 'match_found');
        const m2Promise = waitFor(p2, 'match_found');

        p1.emit('join_matchmaking', { name: 'Player 1' });
        p2.emit('join_matchmaking', { name: 'Player 2' });
        p3.emit('join_matchmaking', { name: 'Player 3' });
        p4.emit('join_matchmaking', { name: 'Player 4' });
        
        const m1 = await m1Promise;
        const m2 = await m2Promise;
        const matchId = m1.matchId;

        const c1Promise = waitFor(p1, 'match_cancelled');
        const c2Promise = waitFor(p2, 'match_cancelled');

        // P1 declines
        p1.emit('decline_match', { matchId });

        const [c1, c2] = await Promise.all([c1Promise, c2Promise]);

        expect(c1.reason).toMatch(/You declined/);
        expect(c2.reason).toMatch(/Someone declined/);

        // Now P5 joins. Since P2, P3, P4 are re-queued (3 players), P5 should trigger a new match
        const p5 = await connect(url);
        sockets.push(p5);
        
        const m2NewPromise = waitFor(p2, 'match_found');
        const m5Promise = waitFor(p5, 'match_found');

        p5.emit('join_matchmaking', { name: 'Player 5' });

        const [m2New, m5] = await Promise.all([m2NewPromise, m5Promise]);

        expect(m2New.matchId).toBeDefined();
        expect(m5.matchId).toBe(m2New.matchId);
    });
});
