const roomManager = require('../roomManager');

// Mock socket.io objects
const mockIo = {
    to: jest.fn().mockReturnValue({
        emit: jest.fn()
    })
};

const createMockSocket = (id) => ({
    id,
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn()
});

describe('roomManager', () => {
    beforeEach(() => {
        // Clear the rooms object before each test
        for (const key in roomManager.rooms) {
            delete roomManager.rooms[key];
        }
    });

    describe('seedDefaultLobbies', () => {
        it('seeds permanent public lobbies for all languages', () => {
            roomManager.seedDefaultLobbies();
            const codes = Object.keys(roomManager.rooms);

            // There are 4 default lobbies * 4 languages = 16 lobbies
            expect(codes.length).toBe(16);

            // Check if English, Spanish, Russian, and Ukrainian lobbies exist for PLAY
            expect(roomManager.rooms['PLAY-EN']).toBeDefined();
            expect(roomManager.rooms['PLAY-ES']).toBeDefined();
            expect(roomManager.rooms['PLAY-RU']).toBeDefined();
            expect(roomManager.rooms['PLAY-UK']).toBeDefined();

            // Verify a specific lobby's config
            const playEn = roomManager.rooms['PLAY-EN'];
            expect(playEn.isPublic).toBe(true);
            expect(playEn.isPermanent).toBe(true);
            expect(playEn.config.lang).toBe('en');
        });
    });

    describe('findOrCreatePublicRoom', () => {
        it('isolates players by language in quick play', () => {
            const socketEn1 = createMockSocket('en1');
            const socketEn2 = createMockSocket('en2');
            const socketEs1 = createMockSocket('es1');

            const playerDataEn = { name: 'English Player', lang: 'en' };
            const playerDataEs = { name: 'Spanish Player', lang: 'es' };

            // EN player joins, creates a new public room for EN
            roomManager.findOrCreatePublicRoom(mockIo, socketEn1, playerDataEn);
            
            // Find the room created for the EN player
            const rooms = Object.values(roomManager.rooms);
            expect(rooms.length).toBe(1);
            const enRoomCode = Object.keys(roomManager.rooms)[0];
            const enRoom = rooms[0];
            
            expect(enRoom.config.lang).toBe('en');
            expect(enRoom.players.length).toBe(1);

            // Second EN player joins, should be placed in the same room
            roomManager.findOrCreatePublicRoom(mockIo, socketEn2, playerDataEn);
            expect(Object.keys(roomManager.rooms).length).toBe(1);
            expect(enRoom.players.length).toBe(2);

            // ES player joins, should create a NEW public room because languages don't match
            roomManager.findOrCreatePublicRoom(mockIo, socketEs1, playerDataEs);
            const allRooms = Object.values(roomManager.rooms);
            expect(allRooms.length).toBe(2);

            const esRoom = allRooms.find(r => r.config.lang === 'es');
            expect(esRoom).toBeDefined();
            expect(esRoom.players.length).toBe(1);
            expect(esRoom.players[0].id).toBe('es1');
        });

        it('removes the player from any existing rooms before joining a new one', () => {
            const socket = createMockSocket('ghost1');
            
            // Player joins a custom room first
            roomManager.rooms['GHOST'] = {
                players: [{ id: 'ghost1', name: 'Ghost' }],
                host: 'ghost1',
                teams: {},
                isPublic: false
            };
            
            // Player clicks Quick Play (this calls findOrCreatePublicRoom)
            roomManager.findOrCreatePublicRoom(mockIo, socket, { name: 'Ghost', lang: 'en' });
            
            // The GHOST room becomes empty and should be deleted
            expect(roomManager.rooms['GHOST']).toBeUndefined();
            
            // The player should now be in exactly ONE public room
            const publicRooms = Object.values(roomManager.rooms).filter(r => r.isPublic);
            expect(publicRooms.length).toBe(1);
            expect(publicRooms[0].players[0].id).toBe('ghost1');
        });
    });

    describe('Party Up Logic', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('Hostless Party Up: moves voters to a NEW custom public room and promotes host', () => {
            // Setup a fake hostless public room (e.g., Quick Play) that just finished a game
            roomManager.rooms['HOSTLESS'] = {
                isPublic: true,
                isHostless: true,
                isPermanent: false,
                players: [
                    { id: 'p1', name: 'Voter 1', wantsRematch: false },
                    { id: 'p2', name: 'Voter 2', wantsRematch: false },
                    { id: 'p3', name: 'AFK Player', wantsRematch: false }
                ],
                teams: {},
                config: { lang: 'en' },
                gameSession: { isGameOver: true }
            };

            const socket1 = createMockSocket('p1');
            const socket2 = createMockSocket('p2');

            // P1 and P2 vote for a rematch. P3 goes AFK.
            roomManager.rematchVote(mockIo, socket1, 'HOSTLESS');
            roomManager.rematchVote(mockIo, socket2, 'HOSTLESS');

            expect(roomManager.rooms['HOSTLESS'].rematchCountdown).toBeDefined();
            expect(roomManager.rooms['HOSTLESS'].players.find(p => p.id === 'p1').wantsRematch).toBe(true);

            // Fast forward 16 seconds to trigger executeRematchTransition
            jest.advanceTimersByTime(16000);

            // The original room should now ONLY contain the AFK player (or be deleted if it was temporary and empty, but it's not empty)
            const oldRoom = roomManager.rooms['HOSTLESS'];
            expect(oldRoom.players.length).toBe(1);
            expect(oldRoom.players[0].id).toBe('p3');

            // A new Custom Public room should have been created for P1 and P2
            const newRooms = Object.values(roomManager.rooms).filter(r => r !== oldRoom);
            expect(newRooms.length).toBe(1);
            
            const newRoom = newRooms[0];
            expect(newRoom.isPublic).toBe(true);
            expect(newRoom.isHostless).toBe(false); // It is a normal room now!
            expect(newRoom.host).toBe('p1'); // First voter became host!
            expect(newRoom.players.length).toBe(2);
            expect(newRoom.players.map(p => p.id)).toContain('p1');
            expect(newRoom.players.map(p => p.id)).toContain('p2');
            
            // Their votes should be reset
            expect(newRoom.players[0].wantsRematch).toBe(false);
        });

        it('Custom Public Party Up: kicks AFK players and keeps voters in the SAME room', () => {
            roomManager.rooms['CUSTOM'] = {
                isPublic: true,
                isHostless: false,
                host: 'p1',
                players: [
                    { id: 'p1', name: 'Host Voter', wantsRematch: false },
                    { id: 'p2', name: 'Guest Voter', wantsRematch: false },
                    { id: 'p3', name: 'Guest AFK', wantsRematch: false }
                ],
                teams: {},
                config: { lang: 'en' },
                gameSession: { isGameOver: true }
            };

            const socket1 = createMockSocket('p1');
            const socket2 = createMockSocket('p2');

            // P1 and P2 vote for a rematch
            roomManager.rematchVote(mockIo, socket1, 'CUSTOM');
            roomManager.rematchVote(mockIo, socket2, 'CUSTOM');

            // Fast forward timer
            jest.advanceTimersByTime(16000);

            // The original room should still exist
            const room = roomManager.rooms['CUSTOM'];
            expect(room).toBeDefined();

            // The AFK player should be gone
            expect(room.players.length).toBe(2);
            expect(room.players.map(p => p.id)).not.toContain('p3');

            // The host should still be p1
            expect(room.host).toBe('p1');
        });
    });
});
