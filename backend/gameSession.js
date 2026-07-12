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

        // teams: { [playerId]: 'A' | 'B' } or null for solo mode
        this.teams      = config.teams || null;
        this.teamScores = this.teams ? { A: 0, B: 0 } : null;
    }

    start() {
        this.io.to(this.roomId).emit('game_started', {
            players: this.players,
            teams:   this.teams,
        });

        // Short delay before first round (countdown already happened in roomManager)
        setTimeout(() => {
            this.nextRound();
        }, 500);
    }

    currentRoundType() {
        // Cycle through configured round types, repeating if needed
        const types = this.config.roundTypes;
        return types[(this.currentRound - 1) % types.length];
    }

    nextRound() {
        if (this.currentRound >= this.config.maxRounds) {
            this.io.to(this.roomId).emit('game_over', {
                scores:     this.scores,
                teams:      this.teams,
                teamScores: this.teamScores,
            });
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

            this.checkRoundEarlyEnd();
        }
    }

    removePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
        if (this.playerWords[playerId]) {
            this.playerWords[playerId].done = true; // Pretend they are done so we don't wait
        }
        this.checkRoundEarlyEnd();
    }

    checkRoundEarlyEnd() {
        // Only consider players who are still in the session
        const activeIds = new Set(this.players.map(p => p.id));
        const allDone = Object.entries(this.playerWords)
            .filter(([id, _]) => activeIds.has(id))
            .every(([_, p]) => p.done);
            
        if (allDone && this.players.length > 0) {
            clearTimeout(this.timer);
            this.endRound(this.currentRoundType());
        }
    }

    endRound(roundType) {
        // Build playerWords snapshot for scoring (words only, no socket refs)
        const wordSnapshot = {};
        for (const [id, data] of Object.entries(this.playerWords)) {
            wordSnapshot[id] = { name: data.name, words: data.words };
        }

        const { groups, scoreUpdates } = calculateScores(wordSnapshot, roundType, this.teams);

        for (let pid in scoreUpdates) {
            this.scores[pid] += scoreUpdates[pid];
        }

        // Recompute cumulative team scores from per-player totals
        if (this.teams && this.teamScores) {
            this.teamScores = { A: 0, B: 0 };
            for (const pid in this.scores) {
                const team = this.teams[pid];
                if (team === 'A' || team === 'B') {
                    this.teamScores[team] += this.scores[pid];
                }
            }
        }

        // Build a playerNames map so the client can display names in scores
        const playerNames = {};
        this.players.forEach(p => { playerNames[p.id] = p.name; });

        this.io.to(this.roomId).emit('round_ended', {
            groups:       groups,
            scoreUpdates: scoreUpdates,
            newScores:    this.scores,
            playerNames:  playerNames,
            teams:        this.teams,
            teamScores:   this.teamScores,
        });

        // 10 seconds to show results before next round
        setTimeout(() => {
            this.nextRound();
        }, 10000);
    }
}

module.exports = GameSession;
