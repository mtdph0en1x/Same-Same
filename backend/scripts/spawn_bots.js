const { io } = require('socket.io-client');
const { MODE_CONFIG } = require('../matchmaker');

const SERVER_URL = 'http://localhost:3000';
const mode = process.argv[2] || 'solo4';

if (!MODE_CONFIG[mode]) {
    console.error(`Invalid mode: ${mode}. Available modes: ${Object.keys(MODE_CONFIG).join(', ')}`);
    process.exit(1);
}

const NUM_BOTS = Math.max(1, MODE_CONFIG[mode].minPlayers - 1); // Leave 1 spot for human

// A small dictionary of words for the bots to use.
// We include some duplicates to ensure "Same Same" matches happen.
const BOT_DICTIONARY = [
    'apple', 'banana', 'orange', 'apple', 'grape',
    'car', 'bus', 'train', 'car', 'bicycle',
    'dog', 'cat', 'bird', 'dog', 'fish',
    'red', 'blue', 'green', 'red', 'yellow'
];

function getRandomWord() {
    return BOT_DICTIONARY[Math.floor(Math.random() * BOT_DICTIONARY.length)];
}

console.log(`🤖 Spawning ${NUM_BOTS} bots to connect to ${SERVER_URL} for mode '${mode}'...`);

for (let i = 1; i <= NUM_BOTS; i++) {
    const socket = io(SERVER_URL);
    const botName = `Bot_${i}`;
    let currentRoomCode = null;

    socket.on('connect', () => {
        console.log(`[${botName}] Connected! Joining matchmaking for '${mode}'...`);
        socket.emit('join_matchmaking', { name: botName, mode: mode });
    });

    socket.on('match_found', (data) => {
        console.log(`[${botName}] Match found! Accepting...`);
        socket.emit('accept_match', { matchId: data.matchId });
    });

    socket.on('joined_room', (data) => {
        console.log(`[${botName}] Joined room ${data.roomCode}`);
        currentRoomCode = data.roomCode;
        
        // Randomly vote for a pack
        if (data.isPublic) {
            const packs = ['classic', 'food', 'nature', 'pop_culture', 'challenge'];
            const randomPack = packs[Math.floor(Math.random() * packs.length)];
            setTimeout(() => {
                socket.emit('submit_vote', { roomCode: currentRoomCode, packId: randomPack });
                console.log(`[${botName}] Voted for ${randomPack}`);
            }, Math.random() * 2000 + 1000); // Vote after 1-3 seconds
        }
    });

    socket.on('round_started', (data) => {
        console.log(`[${botName}] Round started! Category: "${data.category}". Submitting ${data.wordsPerRound} words...`);
        
        let wordsSubmitted = 0;
        
        const interval = setInterval(() => {
            if (wordsSubmitted >= data.wordsPerRound) {
                clearInterval(interval);
                return;
            }
            
            const word = getRandomWord();
            socket.emit('submit_word', { roomId: currentRoomCode, word });
            console.log(`[${botName}] Submitted word: ${word}`);
            
            wordsSubmitted++;
        }, 1000); // Submit a word every second
    });
    
    socket.on('round_ended', () => {
        console.log(`[${botName}] Round ended.`);
    });
    
    socket.on('game_over', () => {
        console.log(`[${botName}] Game over. Leaving room...`);
        socket.emit('leave_room', { roomCode: currentRoomCode });
        
        // Rejoin matchmaking to keep testing if needed, or just stay idle.
        // For now, we'll let them disconnect.
        setTimeout(() => {
            console.log(`[${botName}] Disconnecting.`);
            socket.disconnect();
        }, 2000);
    });

    socket.on('disconnect', () => {
        console.log(`[${botName}] Disconnected.`);
    });
}
