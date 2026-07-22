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
    });
});
