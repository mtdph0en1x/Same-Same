const { getRandomCategory, calculateScores } = require('./gameLogic');
const { v4: uuidv4 } = require('uuid'); // Add this to package.json later if needed, or use a simple random string generator
// Actually we can just generate a random string for roomId if we need to.

class GameSession {
    constructor(io, roomId, players) {
        this.io = io;
        this.roomId = roomId;
        this.players = players; // Array of { id, name }
        this.scores = {};
        this.players.forEach(p => this.scores[p.id] = 0);
        this.currentRound = 0;
        this.maxRounds = 6;
        this.answers = [];
    }

    start() {
        this.io.to(this.roomId).emit('game_started', { players: this.players });
        
        // Short delay before first round
        setTimeout(() => {
            this.nextRound();
        }, 3000);
    }

    nextRound() {
        if (this.currentRound >= this.maxRounds) {
            this.io.to(this.roomId).emit('game_over', { scores: this.scores });
            return;
        }

        this.currentRound++;
        this.answers = [];
        
        let roundType = 'Same Same';
        if (this.currentRound === 2 || this.currentRound === 5) roundType = 'But Different';
        if (this.currentRound === 3 || this.currentRound === 6) roundType = 'Rush';

        const category = getRandomCategory();

        this.io.to(this.roomId).emit('round_started', {
            roundNumber: this.currentRound,
            roundType: roundType,
            category: category,
            timeLimit: 60
        });

        this.timer = setTimeout(() => {
            this.endRound(roundType);
        }, 60000);
    }

    submitAnswer(playerId, answer) {
        if (this.answers.find(a => a.playerId === playerId)) return; // prevent duplicate
        
        const player = this.players.find(p => p.id === playerId);
        const playerName = player ? player.name : "Unknown";

        this.answers.push({ playerId, playerName, answer });
        this.io.to(this.roomId).emit('player_answered', { playerId });

        if (this.answers.length === this.players.length) {
            clearTimeout(this.timer);
            this.endRound(this.currentRoundType());
        }
    }

    currentRoundType() {
        if (this.currentRound === 2 || this.currentRound === 5) return 'But Different';
        if (this.currentRound === 3 || this.currentRound === 6) return 'Rush';
        return 'Same Same';
    }

    endRound(roundType) {
        const { groups, scoreUpdates } = calculateScores(this.answers, roundType);
        
        for (let pid in scoreUpdates) {
            this.scores[pid] += scoreUpdates[pid];
        }

        this.io.to(this.roomId).emit('round_ended', {
            groups: groups,
            scoreUpdates: scoreUpdates,
            newScores: this.scores
        });

        // 10 seconds to show results before next round
        setTimeout(() => {
            this.nextRound();
        }, 10000);
    }
}

module.exports = GameSession;
