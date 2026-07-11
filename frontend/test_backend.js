const { io } = require("socket.io-client");

const SERVER_URL = "http://localhost:4000";

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log("Starting E2E tests...");
    
    // --- MODE 1: MATCHMAKING TEST ---
    console.log("--- Mode 1: Matchmaking ---");
    let p1_m1 = io(SERVER_URL);
    let p2_m1 = io(SERVER_URL);
    
    let p1_m1_roomId = null;
    let p2_m1_roomId = null;
    let roundStartedEventCount = 0;
    
    p1_m1.on("match_found", (data) => p1_m1_roomId = data.roomId);
    p2_m1.on("match_found", (data) => p2_m1_roomId = data.roomId);
    
    p1_m1.on("round_started", () => roundStartedEventCount++);
    
    p1_m1.emit("join_matchmaking", { name: "Player 1 M1" });
    p2_m1.emit("join_matchmaking", { name: "Player 2 M1" });
    
    await sleep(4000); // Wait for match + game_started + 3s delay for nextRound
    
    if (p1_m1_roomId && p1_m1_roomId === p2_m1_roomId) {
        console.log("✅ Mode 1: Matchmaking succeeded (same room ID).");
    } else {
        console.error("❌ Mode 1: Matchmaking failed.");
    }
    
    if (roundStartedEventCount > 0) {
        console.log("✅ Mode 1: Round started successfully.");
    } else {
        console.error("❌ Mode 1: Round failed to start.");
    }
    
    let roundEnded = false;
    p1_m1.on("round_ended", (data) => {
        roundEnded = true;
        console.log("Mode 1 Scores:", data.newScores);
    });
    
    p1_m1.emit("submit_answer", { roomId: p1_m1_roomId, answer: "test answer" });
    p2_m1.emit("submit_answer", { roomId: p1_m1_roomId, answer: "test answer" });
    
    await sleep(2000);
    
    if (roundEnded) {
        console.log("✅ Mode 1: Answers submitted and round ended early.");
    } else {
        console.error("❌ Mode 1: Round did not end after answers.");
    }

    p1_m1.disconnect();
    p2_m1.disconnect();
    
    // --- MODE 2: COUCH MULTIPLAYER TEST ---
    console.log("--- Mode 2: Couch Multiplayer ---");
    let host = io(SERVER_URL);
    let guest = io(SERVER_URL);
    
    let roomCode = null;
    let guestJoined = false;
    let m2RoundStarted = false;
    
    host.on("room_created", (data) => {
        roomCode = data.roomCode;
        console.log("Room created with code:", roomCode);
    });
    
    host.on("player_joined", (data) => {
        if (data.players.some(p => p.name === "Guest")) guestJoined = true;
    });
    
    host.on("round_started", () => m2RoundStarted = true);
    
    host.emit("create_room", { name: "Host" });
    await sleep(500);
    
    if (roomCode) {
        console.log("✅ Mode 2: Room created successfully.");
        guest.emit("join_room", { roomCode: roomCode, playerData: { name: "Guest" } });
        await sleep(500);
        
        if (guestJoined) {
            console.log("✅ Mode 2: Guest joined room.");
            host.emit("start_game", { roomCode: roomCode });
            await sleep(3500);
            
            if (m2RoundStarted) {
                console.log("✅ Mode 2: Game started successfully.");
            } else {
                console.error("❌ Mode 2: Game failed to start.");
            }
        } else {
            console.error("❌ Mode 2: Guest failed to join.");
        }
    } else {
        console.error("❌ Mode 2: Room creation failed.");
    }
    
    host.disconnect();
    guest.disconnect();
    
    console.log("Testing complete.");
    process.exit(0);
}

runTests();
