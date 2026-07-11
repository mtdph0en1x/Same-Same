# Word Match - Cross-Platform Multiplayer Game

This plan outlines the architecture and implementation strategy for building the word-matching game. Based on your feedback, we will target **iOS/Android natively** for the true online matchmaking experience, while offering a **Web/PWA version** for couch multiplayer (room codes), all powered by the same backend.

## 🏗️ Proposed Tech Stack

*   **Frontend (Cross-Platform):** **React Native with Expo**. This is the perfect tool for this task because it allows us to write one codebase that compiles into native iOS/Android apps *and* a responsive web application (using React Native for Web).
*   **Backend (The Online Server):** Node.js with Express.
*   **Real-time Communication:** **Socket.io**. This is the industry standard for real-time multiplayer. It works seamlessly across React Native mobile apps and standard web browsers.

## 🔄 Multiplayer Architecture & Game Flow

We will support two distinct modes, routed depending on where the user is playing:

### Mode 1: True Online Matchmaking (Native App Focus)
1.  **Matchmaking Lobby:** A player opens the iOS/Android app, enters a display name, and taps "Find Match".
2.  **Server Queue:** The Node.js server places the player in a matchmaking queue. Once 4-6 players join, it creates an isolated "Game Room" for them.

### Mode 2: Couch Multiplayer (Web PWA Focus)
1.  **Lobby Creation:** A player visits the web version, clicks "Host Couch Game". The server generates a 4-letter Room Code.
2.  **Joining:** Friends scan a QR code or enter the 4-letter code on their phones to join the specific room.

### Shared Round Flow (For Both Modes)
*   Server randomly selects a category and a round type (Owls, Larks, or Blitz).
*   Server broadcasts the start of the round and starts a 60-second timer.
*   Clients display the category and a text input.
*   Players submit answers to the server.
*   Once the timer ends, the server runs the scoring logic.
*   Server broadcasts the results to everyone's screen.

## 🗂️ Project Structure

We will set up a monorepo in a new directory: `D:\gamedev\word-match-game`

### 1. `backend/`
*   `server.js`: Initializes Socket.io and Express.
*   `gameLogic.js`: Handles scoring rules and round generation.
*   `matchmaker.js`: Logic for grouping queued players (for Mode 1).
*   `roomManager.js`: Logic for custom 4-letter room codes (for Mode 2).

### 2. `frontend/` (React Native Expo)
*   `src/components/`: Cross-platform UI components.
*   `src/screens/`: Main game views (Home, Lobby, PlayRound, Results).
*   `src/socket.js`: Client-side Socket.io connection logic.

## 🎯 Decisions Made

1.  **Language:** We will start with English, but architect the app using `react-i18next`. This means all text will be stored in translation files, making it incredibly easy to add Russian (and other languages) later without rewriting UI code.
2.  **Scoring System (NLP):** An advanced NLP model (like ChatGPT or Gemini API) *could* work, but it introduces API costs and latency. Instead, we will use a **lightweight, local NLP library** (like `natural` for Node.js). 
    *   This allows us to perform **Stemming** (automatically grouping "tree", "trees", "tree's" together).
    *   We can also use **Fuzzy Matching** (Levenshtein distance) to group minor typos (like "strawbery" and "strawberry") without needing an external AI.
    *   This provides a smooth, automated experience for online strangers without costing you money to run.

## 🧪 Verification Plan
*   Setup the Node server locally.
*   Run the Expo frontend for Web to test Mode 2 (Couch Multiplayer).
*   Run the Expo frontend in an Android/iOS emulator to test Mode 1 (Matchmaking).
*   Verify that the NLP library correctly stems and groups similar words.
*   Verify that Socket.io successfully routes players and game states in both modes.
