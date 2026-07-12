'use strict';

const { createServer } = require('http');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');

// ---------------------------------------------------------------------------
// We require the server module which wires up all socket handlers onto io/server
// without auto-listening (require.main !== module).
// ---------------------------------------------------------------------------
const { server, io } = require('../server');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Start the server on a random OS-assigned port, return the URL. */
function startServer() {
    return new Promise((resolve) => {
        server.listen(0, () => {
            const { port } = server.address();
            resolve(`http://localhost:${port}`);
        });
    });
}

/** Close server + all active socket connections. */
function stopServer() {
    return new Promise((resolve) => {
        io.close(() => {
            server.close((err) => {
                // Ignore 'Server is not running' — can happen on forceExit
                if (err && err.code !== 'ERR_SERVER_NOT_RUNNING') {
                    console.warn('stopServer warning:', err.message);
                }
                resolve();
            });
        });
    });
}

/** Create a client socket and wait for it to connect. */
function connect(url) {
    return new Promise((resolve, reject) => {
        const socket = ioClient(url, { forceNew: true });
        socket.once('connect', () => resolve(socket));
        socket.once('connect_error', reject);
    });
}

/** Wait for a specific event on a socket, resolving with its payload. */
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

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let url;
let clients = [];

beforeAll(async () => {
    url = await startServer();
});

afterAll(async () => {
    // Disconnect all clients first — this triggers disconnect handlers which
    // stop any running game timers before we close the server.
    clients.forEach((c) => c.connected && c.disconnect());
    await new Promise((r) => setTimeout(r, 200)); // allow disconnect events to flush
    await stopServer();
});

/** Utility: create a fresh connected socket and track it for cleanup. */
async function makeClient() {
    const s = await connect(url);
    clients.push(s);
    return s;
}

/** Utility: disconnect a client and remove from tracking list. */
function closeClient(s) {
    s.disconnect();
    clients = clients.filter((c) => c !== s);
}

// ---------------------------------------------------------------------------
// Room creation & joining
// ---------------------------------------------------------------------------

describe('Room lifecycle', () => {
    test('host receives room_created with roomCode, players list, config, teams', async () => {
        const host = await makeClient();

        const [data] = await Promise.all([
            waitFor(host, 'room_created'),
            host.emit('create_room', { name: 'Host' }),
        ]);

        expect(data.roomCode).toMatch(/^[A-Z]{4}$/);
        expect(data.players).toHaveLength(1);
        expect(data.players[0].name).toBe('Host');
        expect(data.config).toBeDefined();
        expect(data.config.teamMode).toBe(false);
        expect(data.teams).toBeDefined();

        closeClient(host);
    });

    test('joining player receives joined_room with existing players', async () => {
        const host   = await makeClient();
        const guest  = await makeClient();

        const { roomCode } = await new Promise((resolve) => {
            host.emit('create_room', { name: 'Host' });
            host.once('room_created', resolve);
        });

        const [joined] = await Promise.all([
            waitFor(guest, 'joined_room'),
            guest.emit('join_room', { roomCode, playerData: { name: 'Guest' } }),
        ]);

        expect(joined.players).toHaveLength(2);
        expect(joined.players.map((p) => p.name)).toContain('Guest');

        closeClient(host);
        closeClient(guest);
    });

    test('all players receive player_joined when someone joins', async () => {
        const host  = await makeClient();
        const guest = await makeClient();

        const { roomCode } = await new Promise((resolve) => {
            host.emit('create_room', { name: 'Host' });
            host.once('room_created', resolve);
        });

        const [update] = await Promise.all([
            waitFor(host, 'player_joined'),
            guest.emit('join_room', { roomCode, playerData: { name: 'Guest' } }),
        ]);

        expect(update.players).toHaveLength(2);

        closeClient(host);
        closeClient(guest);
    });

    test('joining a non-existent room emits room_error', async () => {
        const s = await makeClient();

        const [err] = await Promise.all([
            waitFor(s, 'room_error'),
            s.emit('join_room', { roomCode: 'XXXX', playerData: { name: 'X' } }),
        ]);

        expect(err.message).toMatch(/not found/i);
        closeClient(s);
    });
});

// ---------------------------------------------------------------------------
// Config updates
// ---------------------------------------------------------------------------

describe('Config updates', () => {
    test('host can update config and all players receive config_updated', async () => {
        const host  = await makeClient();
        const guest = await makeClient();

        const { roomCode } = await new Promise((resolve) => {
            host.emit('create_room', { name: 'Host' });
            host.once('room_created', resolve);
        });
        await new Promise((resolve) => {
            guest.emit('join_room', { roomCode, playerData: { name: 'Guest' } });
            guest.once('joined_room', resolve);
        });

        const newConfig = {
            maxRounds: 3,
            timeLimit: 30,
            wordsPerRound: 3,
            roundTypes: ['Same Same'],
            categoryPack: 'classic',
            teamMode: false,
        };

        const [hostUpdate, guestUpdate] = await Promise.all([
            waitFor(host, 'config_updated'),
            waitFor(guest, 'config_updated'),
            host.emit('update_config', { roomCode, config: newConfig }),
        ]);

        expect(hostUpdate.config.maxRounds).toBe(3);
        expect(guestUpdate.config.timeLimit).toBe(30);

        closeClient(host);
        closeClient(guest);
    });

    test('non-host cannot update config (no response expected)', async () => {
        const host  = await makeClient();
        const guest = await makeClient();

        const { roomCode } = await new Promise((resolve) => {
            host.emit('create_room', { name: 'Host' });
            host.once('room_created', resolve);
        });
        await new Promise((resolve) => {
            guest.emit('join_room', { roomCode, playerData: { name: 'Guest' } });
            guest.once('joined_room', resolve);
        });

        // Guest tries to update — should be silently ignored
        const noEvent = new Promise((resolve, reject) => {
            const t = setTimeout(resolve, 500); // no event in 500ms = success
            guest.once('config_updated', () => {
                clearTimeout(t);
                reject(new Error('Guest should not be able to update config'));
            });
        });

        guest.emit('update_config', { roomCode, config: { maxRounds: 9 } });
        await expect(noEvent).resolves.toBeUndefined();

        closeClient(host);
        closeClient(guest);
    });
});

// ---------------------------------------------------------------------------
// Team mode — teams update
// ---------------------------------------------------------------------------

describe('Team mode', () => {
    async function createRoomWithGuest(teamMode = false) {
        const host  = await makeClient();
        const guest = await makeClient();

        const { roomCode } = await new Promise((resolve) => {
            host.emit('create_room', { name: 'Host' });
            host.once('room_created', resolve);
        });

        const joined = await new Promise((resolve) => {
            guest.emit('join_room', { roomCode, playerData: { name: 'Guest' } });
            guest.once('joined_room', resolve);
        });

        return { host, guest, roomCode, players: joined.players };
    }

    test('new joiners are auto-assigned to a team', async () => {
        const { host, guest, roomCode } = await createRoomWithGuest();

        // We need the teams — they arrive in joined_room.
        // Let's add a third player and check teams are still balanced.
        const guest2 = await makeClient();
        const joined2 = await new Promise((resolve) => {
            guest2.emit('join_room', { roomCode, playerData: { name: 'Guest2' } });
            guest2.once('joined_room', resolve);
        });

        const teamValues = Object.values(joined2.teams);
        const countA = teamValues.filter((t) => t === 'A').length;
        const countB = teamValues.filter((t) => t === 'B').length;
        // With 3 players the split should be 2/1 max
        expect(Math.abs(countA - countB)).toBeLessThanOrEqual(1);

        closeClient(host);
        closeClient(guest);
        closeClient(guest2);
    });

    test('host can swap a player to another team and all clients receive teams_updated', async () => {
        const { host, guest, roomCode, players } = await createRoomWithGuest();
        const guestId = players.find((p) => p.name === 'Guest').id;

        // Enable team mode first
        await new Promise((resolve) => {
            host.emit('update_config', { roomCode, config: { teamMode: true, maxRounds: 3, timeLimit: 30, wordsPerRound: 3, roundTypes: ['Same Same'], categoryPack: 'classic' } });
            host.once('config_updated', resolve);
        });

        // Swap guest to team B
        const hostId   = players.find((p) => p.name === 'Host').id;
        const newTeams = { [hostId]: 'A', [guestId]: 'B' };

        const [hostUpdate, guestUpdate] = await Promise.all([
            waitFor(host, 'teams_updated'),
            waitFor(guest, 'teams_updated'),
            host.emit('update_teams', { roomCode, teams: newTeams }),
        ]);

        expect(hostUpdate.teams[guestId]).toBe('B');
        expect(guestUpdate.teams[guestId]).toBe('B');

        closeClient(host);
        closeClient(guest);
    });

    test('non-host cannot update teams', async () => {
        const { host, guest, roomCode, players } = await createRoomWithGuest();
        const hostId  = players.find((p) => p.name === 'Host').id;
        const guestId = players.find((p) => p.name === 'Guest').id;

        const noEvent = new Promise((resolve, reject) => {
            const t = setTimeout(resolve, 500);
            host.once('teams_updated', () => {
                clearTimeout(t);
                reject(new Error('Non-host should not be able to update teams'));
            });
        });

        guest.emit('update_teams', { roomCode, teams: { [hostId]: 'B', [guestId]: 'A' } });
        await expect(noEvent).resolves.toBeUndefined();

        closeClient(host);
        closeClient(guest);
    });
});

// ---------------------------------------------------------------------------
// Kick player
// ---------------------------------------------------------------------------

describe('Kick player', () => {
    test('host can kick a player; kicked player receives kicked event', async () => {
        const host  = await makeClient();
        const guest = await makeClient();

        const { roomCode } = await new Promise((resolve) => {
            host.emit('create_room', { name: 'Host' });
            host.once('room_created', resolve);
        });

        const joined = await new Promise((resolve) => {
            guest.emit('join_room', { roomCode, playerData: { name: 'Guest' } });
            guest.once('joined_room', resolve);
        });

        const guestId = joined.players.find((p) => p.name === 'Guest').id;

        const [kickedData, hostPlayerList] = await Promise.all([
            waitFor(guest, 'kicked'),
            waitFor(host, 'player_joined'),
            host.emit('kick_player', { roomCode, targetId: guestId }),
        ]);

        expect(kickedData.message).toBeDefined();
        expect(hostPlayerList.players).toHaveLength(1);

        closeClient(host);
        closeClient(guest);
    });
});

// ---------------------------------------------------------------------------
// Game start — countdown
// ---------------------------------------------------------------------------

describe('Game start — countdown', () => {
    test('host starts a game and all clients receive countdown_started', async () => {
        const host  = await makeClient();
        const guest = await makeClient();

        const { roomCode } = await new Promise((resolve) => {
            host.emit('create_room', { name: 'Host' });
            host.once('room_created', resolve);
        });
        await new Promise((resolve) => {
            guest.emit('join_room', { roomCode, playerData: { name: 'Guest' } });
            guest.once('joined_room', resolve);
        });

        const [hostCountdown, guestCountdown] = await Promise.all([
            waitFor(host, 'countdown_started'),
            waitFor(guest, 'countdown_started'),
            host.emit('start_game', { roomCode }),
        ]);

        expect(hostCountdown.count).toBe(3);
        expect(guestCountdown.count).toBe(3);

        // Wait for round_started so we don't leave a dangling game timer
        await Promise.all([
            waitFor(host, 'round_started', 8000),
            waitFor(guest, 'round_started', 8000),
        ]);

        closeClient(host);
        closeClient(guest);
    }, 10000);

    test('team mode requires 4 players; starting with 2 emits room_error', async () => {
        const host  = await makeClient();
        const guest = await makeClient();

        const { roomCode } = await new Promise((resolve) => {
            host.emit('create_room', { name: 'Host' });
            host.once('room_created', resolve);
        });
        await new Promise((resolve) => {
            guest.emit('join_room', { roomCode, playerData: { name: 'Guest' } });
            guest.once('joined_room', resolve);
        });

        // Enable team mode
        await new Promise((resolve) => {
            host.emit('update_config', {
                roomCode,
                config: { teamMode: true, maxRounds: 3, timeLimit: 30, wordsPerRound: 3, roundTypes: ['Same Same'], categoryPack: 'classic' },
            });
            host.once('config_updated', resolve);
        });

        const [err] = await Promise.all([
            waitFor(host, 'room_error'),
            host.emit('start_game', { roomCode }),
        ]);

        expect(err.message).toMatch(/team mode/i);

        closeClient(host);
        closeClient(guest);
    });
});

// ---------------------------------------------------------------------------
// Full round flow
// ---------------------------------------------------------------------------

describe('Full round flow', () => {
    test('all players submitting words triggers round_ended with scores', async () => {
        const host  = await makeClient();
        const guest = await makeClient();

        const { roomCode } = await new Promise((resolve) => {
            host.emit('create_room', { name: 'Host' });
            host.once('room_created', resolve);
        });
        await new Promise((resolve) => {
            guest.emit('join_room', { roomCode, playerData: { name: 'Guest' } });
            guest.once('joined_room', resolve);
        });

        // Configure: 3 words per round (minimum valid), 1 round, Same Same
        await new Promise((resolve) => {
            host.emit('update_config', {
                roomCode,
                config: { maxRounds: 1, timeLimit: 90, wordsPerRound: 3, roundTypes: ['Same Same'], categoryPack: 'classic', teamMode: false },
            });
            host.once('config_updated', resolve);
        });

        host.emit('start_game', { roomCode });

        // Wait for both to get round_started
        const [hostRound, guestRound] = await Promise.all([
            waitFor(host, 'round_started', 8000),
            waitFor(guest, 'round_started', 8000),
        ]);

        const roomId = hostRound.roomId || roomCode;

        // Both submit 3 words (wordsPerRound = 3) → triggers allDone → endRound early
        for (const word of ['pizza', 'burger', 'sushi']) {
            host.emit('submit_word', { roomId, word });
            guest.emit('submit_word', { roomId, word });
        }

        const [hostResult] = await Promise.all([
            waitFor(host, 'round_ended', 6000),
            waitFor(guest, 'round_ended', 6000),
        ]);

        expect(hostResult).toHaveProperty('groups');
        expect(hostResult).toHaveProperty('newScores');

        // At least one player should have scored
        const totalScore = Object.values(hostResult.newScores).reduce((s, v) => s + v, 0);
        expect(totalScore).toBeGreaterThan(0);

        closeClient(host);
        closeClient(guest);
    }, 15000);
});
