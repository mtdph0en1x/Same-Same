const { io } = require("socket.io-client");
const socket = io("http://localhost:3000");

socket.on("connect", () => {
    console.log("Connected");
    socket.emit("join_room", { roomCode: "XXXX", playerData: { name: "Test" } });
});

socket.on("room_error", (data) => {
    console.log("Got room_error:", data);
    process.exit(0);
});

socket.on("joined_room", (data) => {
    console.log("Got joined_room:", data);
    process.exit(0);
});

socket.on("room_created", (data) => {
    console.log("Got room_created:", data);
    process.exit(0);
});
