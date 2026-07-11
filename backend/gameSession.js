const { getRandomCategory, calculateScores } = require('./gameLogic');

const VALID_ROUND_TYPES = ['Same Same', 'But Different', 'Rush'];

class GameSession {
    constructor(io, roomId, players, config = {}) {
        this.io = io;
        this.roomId = roomId;
        this.players = players; // Array of { id, name }
        this.scores = {};
        this.players.forEach(p => this.scores[p.id] = 0);
        this.currentRound = 0;
        this.playerWords = {}; // { [playerId]: { name, words: [], done: false } }

        const roundTypes = Array.isArray(config.roundTypes) && config.roundTypes.length > 0
            ? config.roundTypes.filter(t => VALID_ROUND_TYPES.includes(t))
            : ['Same Same', 'But Different', 'Rush'];

        this.config = {
            maxRounds:     [3, 6, 9].includes(config.maxRounds)       ? config.maxRounds     : 6,
            timeLimit:     [30, 60, 90].includes(config.timeLimit)     ? config.timeLimit     : 60,
            wordsPerRound: [3, 5, 7].includes(config.wordsPerRound)   ? config.wordsPerRound : 5,
            roundTypes:    roundTypes.length > 0 ? roundTypes : ['Same Same', 'But Different', 'Rush'],
            categoryPack:  config.categoryPack || 'classic',
        };
    }

    start() {
        this.io.to(this.roomId).emit('game_started', { players: this.players });

        // Short delay before first round
        setTimeout(() => {
            this.nextRound();
        }, 3000);
    }

    currentRoundType() {
        // Cycle through configured round types, repeating if needed
        const types = this.config.roundTypes;
        return types[(this.currentRound - 1) % types.length];
    }

    nextRound() {
        if (this.currentRound >= this.config.maxRounds) {
            this.io.to(this.roomId).emit('game_over', { scores: this.scores });
            return;
        }

        this.currentRound++;

        // Reset per-player word tracking for this round
        this.playerWords = {};
        this.players.forEach(p => {
            this.playerWords[p.id] = { name: p.name, words: [], done: false };
        });

        const roundType = this.currentRoundType();
        const category = getRandomCategory(this.config.categoryPack);

        this.io.to(this.roomId).emit('round_started', {
            roundNumber:   this.currentRound,
            totalRounds:   this.config.maxRounds,
            roundType:     roundType,
            category:      category,
            timeLimit:     this.config.timeLimit,
            wordsPerRound: this.config.wordsPerRound,
        });

        this.timer = setTimeout(() => {
            this.endRound(roundType);
        }, this.config.timeLimit * 1000);
    }

    submitWord(playerId, word) {
        const pw = this.playerWords[playerId];
        if (!pw || pw.done) return;

        const trimmed = word.trim();
        if (!trimmed) return;

        pw.words.push(trimmed);

        // Notify everyone this player submitted a word
        this.io.to(this.roomId).emit('word_submitted', {
            playerId,
            wordCount: pw.words.length,
        });

        // Check if this player hit their word limit
        if (pw.words.length >= this.config.wordsPerRound) {
            pw.done = true;
            this.io.to(this.roomId).emit('player_finished', { playerId });

            // End round early if everyone is done
            const allDone = Object.values(this.playerWords).every(p => p.done);
            if (allDone) {
                clearTimeout(this.timer);
                this.endRound(this.currentRoundType());
            }
        }
    }

    endRound(roundType) {
        // Build playerWords snapshot for scoring (words only, no socket refs)
        const wordSnapshot = {};
        for (const [id, data] of Object.entries(this.playerWords)) {
            wordSnapshot[id] = { name: data.name, words: data.words };
        }

        const { groups, scoreUpdates } = calculateScores(wordSnapshot, roundType);

        for (let pid in scoreUpdates) {
            this.scores[pid] += scoreUpdates[pid];
        }

        // Build a playerNames map so the client can display names in scores
        const playerNames = {};
        this.players.forEach(p => { playerNames[p.id] = p.name; });

        this.io.to(this.roomId).emit('round_ended', {
            groups:       groups,
            scoreUpdates: scoreUpdates,
            newScores:    this.scores,
            playerNames:  playerNames,
        });

        // 10 seconds to show results before next round
        setTimeout(() => {
            this.nextRound();
        }, 10000);
    }
}

module.exports = GameSession;
