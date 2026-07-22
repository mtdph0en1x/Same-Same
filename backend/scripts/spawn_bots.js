const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';
const targetRoom = process.argv[2] || 'PLAY';
const NUM_BOTS = parseInt(process.argv[3], 10) || 3;

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

console.log(`🤖 Spawning ${NUM_BOTS} bots to connect to ${SERVER_URL} for room '${targetRoom}'...`);

for (let i = 1; i <= NUM_BOTS; i++) {
    const socket = io(SERVER_URL);
    const botName = `Bot_${i}`;
    let currentRoomCode = null;

    socket.on('connect', () => {
        console.log(`[${botName}] Connected! Joining room '${targetRoom}'...`);
        socket.emit('join_room', { roomCode: targetRoom, playerData: { name: botName, level: 1 } });
    });

    socket.on('joined_room', (data) => {
        console.log(`[${botName}] Joined room ${data.roomCode}`);
        currentRoomCode = data.roomCode;
        
        // Randomly vote for a pack
        if (data.isPublic) {
            const randomPack = 'classic';
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
    
    socket.on('round_ended', (data) => {
        console.log(`[${botName}] Round ended. Entering Review Phase...`);
        // The bot script doesn't have the global timeline length unless we extract it from data
        const maxSteps = data.timeline ? Math.max(1, data.timeline.length) : 1;
        
        socket.once('review_step_advanced', function voteListener(stepData) {
            if (stepData.step >= maxSteps) {
                setTimeout(() => {
                    socket.emit('vote_next_step', { roomId: currentRoomCode });
                    console.log(`[${botName}] Voted to advance round on scoreboard.`);
                }, Math.random() * 2000 + 1000);
            } else {
                // Re-attach if not done
                socket.once('review_step_advanced', voteListener);
            }
        });
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
