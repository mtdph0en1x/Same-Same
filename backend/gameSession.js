const { getRandomCategory, calculateScores } = require('./gameLogic');
const { supabase } = require('./supabase');
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
            timeLimit:     config.modifiers?.includes('Zen') ? 0 : ([30, 60, 90].includes(config.timeLimit) ? config.timeLimit : 60),
            wordsPerRound: [3, 5, 7].includes(config.wordsPerRound)   ? config.wordsPerRound : 5,
            roundTypes:    roundTypes.length > 0 ? roundTypes : ['Same Same', 'But Different', 'Blitz'],
            categoryPack:  config.categoryPack || 'classic',
            modifiers:     config.modifiers || [],
            lang:          config.lang || 'en',
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
            const playerNames = {};
            const playerAvatars = {};
            const playerFrames = {};
            this.players.forEach(p => { playerNames[p.id] = p.name; playerAvatars[p.id] = p.avatar; playerFrames[p.id] = p.frame; });

            this.isGameOver = true;
            this.io.to(this.roomId).emit('game_over', {
                scores:       this.scores,
                teams:        this.teams,
                teamScores:   this.teamScores,
                playerNames,
                playerAvatars,
                playerFrames,
                isPublic:     this.config.isPublic || false,
                roomCode:     this.roomId,
            });
            this.recordStatsToDatabase();
            return;
        }

        this.currentRound++;

        // Reset per-player word tracking for this round
        this.playerWords = {};
        this.players.forEach(p => {
            this.playerWords[p.id] = { name: p.name, words: [], done: false };
        });

        const roundType = this.currentRoundType();
        let category;
        if (roundType === 'Blitz') {
            category = [];
            for (let i = 0; i < this.config.wordsPerRound; i++) {
                category.push(getRandomCategory(this.config.categoryPack, this.config.lang));
            }
        } else {
            category = getRandomCategory(this.config.categoryPack, this.config.lang);
        }
        this.currentCategory = category;

        this.io.to(this.roomId).emit('round_started', {
            roundNumber:   this.currentRound,
            totalRounds:   this.config.maxRounds,
            roundType:     roundType,
            category:      category,
            timeLimit:     this.config.timeLimit,
            wordsPerRound: this.config.wordsPerRound,
        });

        if (this.config.timeLimit > 0) {
            this.timer = setTimeout(() => {
            this.endRound(roundType);
        }, this.config.timeLimit * 1000);
        }
    }

    submitWord(playerId, word) {
        const pw = this.playerWords[playerId];
        if (!pw || pw.done) return;

        const trimmed = word.trim();
        if (!trimmed) return;

        pw.words.push({ text: trimmed, time: Date.now() });

        // Notify everyone this player submitted a word
        this.io.to(this.roomId).emit('word_submitted', {
            playerId,
            wordCount: pw.words.length,
        });

        // Check if this player hit their word limit
        if (pw.words.length >= this.config.wordsPerRound) {
            pw.done = true;
            pw.doneTime = Date.now();
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

    markPlayerOffline(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            player.isOffline = true;
        }
        if (this.playerWords[playerId]) {
            this.playerWords[playerId].done = true; // Skip them in the round timer
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

    async endRound(roundType) {
        // Build playerWords snapshot for scoring (words only, no socket refs)
        const wordSnapshot = {};
        for (const [id, data] of Object.entries(this.playerWords)) {
            wordSnapshot[id] = { name: data.name, words: data.words };
        }

        const { groups, scoreUpdates } = calculateScores(wordSnapshot, roundType, this.config.modifiers, this.teams);

        const rejectedWordsList = [];
        if (roundType === 'But Different') {
            const { validateWords } = require('./aiValidator');
            const uniqueWordsToValidate = [];
            const wordToPlayersMap = {}; // mapping word canonical to array of player IDs who need to lose points if invalid

            groups.forEach(g => {
                let isUnique = false;
                if (!this.teams) {
                    if (g.playerIds.length === 1) isUnique = true;
                } else {
                    const byTeam = { A: [], B: [] };
                    g.playerIds.forEach(p => { const t = this.teams[p.id]; if (t) byTeam[t].push(p); });
                    if (byTeam.A.length === 1 || byTeam.B.length === 1) isUnique = true;
                }

                if (isUnique) {
                    uniqueWordsToValidate.push(g.canonical);
                    // Keep track of which players submitted this unique word
                    wordToPlayersMap[g.canonical] = g.playerIds.map(p => p.id);
                }
            });

            if (uniqueWordsToValidate.length > 0) {
                // Notify clients we are thinking
                this.io.to(this.roomId).emit('ai_validating', {});
                console.log(`[AI] Validating unique words for category "${this.currentCategory}":`, uniqueWordsToValidate);
                
                const validationResults = await validateWords(this.currentCategory, uniqueWordsToValidate);
                
                for (const word of uniqueWordsToValidate) {
                    const lowerWord = word.toLowerCase();
                    const aiDecision = validationResults[lowerWord];
                    
                    // If the AI explicitly says false (boolean or string), reject it.
                    if (aiDecision === false || aiDecision === 'false') {
                        const playerIds = wordToPlayersMap[word] || [];
                        playerIds.forEach(pid => {
                            // Revoke the 3 points
                            if (scoreUpdates[pid] >= 3) {
                                scoreUpdates[pid] -= 3;
                            }
                            rejectedWordsList.push({ playerId: pid, word: word });
                        });
                    }
                }
            }
        }

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
        const playerAvatars = {};
        const playerFrames = {};
        this.players.forEach(p => { 
            playerNames[p.id] = p.name; 
            playerAvatars[p.id] = p.avatar;
            playerFrames[p.id] = p.frame;
        });

        const timeline = [];
        const revealed = new Set(); // store `${playerId}-${wordIndex}`

        if (roundType === 'Blitz') {
            for (let i = 0; i < this.config.wordsPerRound; i++) {
                timeline.push({ type: 'topic', topicIndex: i, title: this.currentCategory[i] });
                for (const p of this.players) {
                    const wordObj = wordSnapshot[p.id]?.words[i];
                    if (wordObj && !revealed.has(`${p.id}-${i}`)) {
                        const group = groups.find(g => g.topicIndex === i && g.playerIds.some(pid => pid.id === p.id));
                        if (group) {
                            // Primary player reveals
                            timeline.push({ type: 'reveal_word', playerId: p.id, wordIndex: i, text: group.canonical });
                            revealed.add(`${p.id}-${i}`);
                            
                            // Sequential reveals for matching players
                            const others = group.playerIds.filter(pid => !(pid.id === p.id && pid.wordIndex === i));
                            for (const op of others) {
                                timeline.push({ type: 'reveal_word', playerId: op.id, wordIndex: op.wordIndex, text: group.canonical });
                                revealed.add(`${op.id}-${op.wordIndex}`);
                            }
                            
                            // Resolve the group
                            timeline.push({ type: 'resolve_group', group, isMatch: group.playerIds.length > 1 });
                        } else if (wordObj.text.trim()) {
                            timeline.push({ type: 'reveal_word', playerId: p.id, wordIndex: i, text: wordObj.text.trim() });
                            revealed.add(`${p.id}-${i}`);
                            timeline.push({ type: 'resolve_group', group: { playerIds: [{ id: p.id, wordIndex: i }] }, isMatch: false });
                        }
                    }
                }
            }
        } else {
            // Normal game, reveal player by player
            for (const p of this.players) {
                const words = wordSnapshot[p.id]?.words || [];
                for (let i = 0; i < words.length; i++) {
                    if (!revealed.has(`${p.id}-${i}`)) {
                        const group = groups.find(g => g.playerIds.some(pid => pid.id === p.id && pid.wordIndex === i));
                        if (group) {
                            // Primary player reveals
                            timeline.push({ type: 'reveal_word', playerId: p.id, wordIndex: i, text: group.canonical });
                            revealed.add(`${p.id}-${i}`);
                            
                            // Sequential reveals for matching players
                            const others = group.playerIds.filter(pid => !(pid.id === p.id && pid.wordIndex === i));
                            for (const op of others) {
                                timeline.push({ type: 'reveal_word', playerId: op.id, wordIndex: op.wordIndex, text: group.canonical });
                                revealed.add(`${op.id}-${op.wordIndex}`);
                            }
                            
                            // Resolve the group
                            timeline.push({ type: 'resolve_group', group, isMatch: group.playerIds.length > 1 });
                        } else if (words[i] && words[i].text.trim()) {
                            timeline.push({ type: 'reveal_word', playerId: p.id, wordIndex: i, text: words[i].text.trim() });
                            revealed.add(`${p.id}-${i}`);
                            timeline.push({ type: 'resolve_group', group: { playerIds: [{ id: p.id, wordIndex: i }] }, isMatch: false });
                        }
                    }
                }
            }
        }

        
        let fastestFinisher = null;
        if (this.config.modifiers?.includes('Rush')) {
            let minDoneTime = Infinity;
            for (const p of this.players) {
                const pw = wordSnapshot[p.id];
                if (pw && pw.done && pw.doneTime < minDoneTime) {
                    minDoneTime = pw.doneTime;
                    fastestFinisher = p.id;
                }
            }
            if (fastestFinisher) {
                // Add +2 points directly
                scoreUpdates[fastestFinisher] = (scoreUpdates[fastestFinisher] || 0) + 2;
                // Prepend to timeline or append at the end? Append before scoreboard
                timeline.push({ type: 'rush_bonus', playerId: fastestFinisher });
            }
        }
        
        this.timeline = timeline;
        this.reviewVotes = new Set();
        this.reviewMaxSteps = Math.max(1, this.timeline.length);
        this.reviewCurrentStep = -1;
        this.lastWordSnapshot = wordSnapshot;
        this.lastGroups = groups;
        this.lastScoreUpdates = scoreUpdates;
        this.lastRejectedWords = rejectedWordsList;

        this.io.to(this.roomId).emit('round_ended', {
            timeline:     this.timeline,
            playerWords:  wordSnapshot,
            groups:       groups,
            roundType:    roundType,
            wordsPerRound: this.config.wordsPerRound,
            scoreUpdates: scoreUpdates,
            newScores:    this.scores,
            playerNames:  playerNames,
            playerAvatars: playerAvatars,
            playerFrames: playerFrames,
            teams:        this.teams,
            teamScores:   this.teamScores,
            rejectedWords: rejectedWordsList, // send to clients to display funny alert
        });

        // Start auto-advancing the review steps
        this.scheduleNextReviewStep();
    }

    scheduleNextReviewStep() {
        if (this.reviewCurrentStep >= this.reviewMaxSteps) {
            return;
        }

        let duration = 2500; 
        if (this.reviewCurrentStep >= 0 && this.reviewCurrentStep < this.timeline.length) {
            const stepData = this.timeline[this.reviewCurrentStep];
            if (stepData.type === 'topic') {
                duration = 2000;
            } else if (stepData.type === 'reveal_word') {
                duration = 1000; // Fast pop
            } else if (stepData.type === 'resolve_group') {
                if (stepData.isMatch) {
                    duration = 3000; // Time to celebrate a match
                } else {
                    duration = 1500; // Faster for a miss
                }
            }
        }

        this.reviewTimer = setTimeout(() => {
            this.advanceReviewStep();
        }, duration);
    }

    advanceReviewStep() {
        if (this.reviewCurrentStep >= this.reviewMaxSteps) return;

        this.reviewCurrentStep++;
        this.io.to(this.roomId).emit('review_step_advanced', {
            step: this.reviewCurrentStep
        });

        if (this.reviewCurrentStep >= this.reviewMaxSteps) {
            // Re-emit vote updates to trigger UI if anyone voted early
            const activePlayerIds = this.players.map(p => p.id);
            const threshold = Math.floor(activePlayerIds.length / 2) + 1;
            this.io.to(this.roomId).emit('review_votes_updated', {
                votes: this.reviewVotes.size,
                threshold: threshold
            });
        } else {
            this.scheduleNextReviewStep();
        }
    }

    voteNextStep(playerId) {
        // Can only vote to advance round when on the scoreboard
        if (this.reviewCurrentStep < this.reviewMaxSteps) return;

        this.reviewVotes.add(playerId);
        
        const activePlayerIds = this.players.map(p => p.id);
        this.reviewVotes = new Set([...this.reviewVotes].filter(id => activePlayerIds.includes(id)));

        const threshold = Math.floor(activePlayerIds.length / 2) + 1;
        
        this.io.to(this.roomId).emit('review_votes_updated', {
            votes: this.reviewVotes.size,
            threshold: threshold
        });

        if (this.reviewVotes.size >= threshold) {
            this.reviewVotes.clear();
            clearTimeout(this.reviewTimer);
            this.nextRound();
        }
    }

    forceNextStep() {
        if (this.reviewCurrentStep < this.reviewMaxSteps) {
            // Force skip to scoreboard
            this.reviewCurrentStep = this.reviewMaxSteps;
            clearTimeout(this.reviewTimer);
            this.io.to(this.roomId).emit('review_step_advanced', {
                step: this.reviewCurrentStep
            });
            const threshold = Math.floor(this.players.length / 2) + 1;
            this.io.to(this.roomId).emit('review_votes_updated', {
                votes: 0,
                threshold: threshold
            });
            return;
        }
        
        // If already on scoreboard, force next round
        this.reviewVotes.clear();
        clearTimeout(this.reviewTimer);
        this.nextRound();
    }

    async recordStatsToDatabase() {
        const authenticatedPlayers = this.players.filter(p => p.userId);
        if (authenticatedPlayers.length === 0) return;

        // Determine winners
        const winners = new Set();
        if (this.teams && this.teamScores) {
            if (this.teamScores.A > this.teamScores.B) {
                Object.keys(this.teams).forEach(id => { if (this.teams[id] === 'A') winners.add(id); });
            } else if (this.teamScores.B > this.teamScores.A) {
                Object.keys(this.teams).forEach(id => { if (this.teams[id] === 'B') winners.add(id); });
            } else {
                // Tie: both teams win
                Object.keys(this.teams).forEach(id => winners.add(id));
            }
        } else {
            let maxScore = -1;
            for (const pid in this.scores) {
                if (this.scores[pid] > maxScore) maxScore = this.scores[pid];
            }
            for (const pid in this.scores) {
                if (this.scores[pid] === maxScore) winners.add(pid);
            }
        }

        // Update each authenticated player's profile
        for (const p of authenticatedPlayers) {
            try {
                // Fetch current stats to increment (Race conditions possible but acceptable for indie game without RPC)
                const { data, error } = await supabase
                    .from('profiles')
                    .select('games_played, wins, xp, level, unlocked_frames, daily_xp, last_active_date')
                    .eq('id', p.userId)
                    .single();

                if (error) throw error;

                const isWinner = winners.has(p.id);
                const playerScore = this.scores[p.id] || 0;
                
                // Calculate earned XP
                let earnedXp = 50; // base completion
                earnedXp += (playerScore * 10); // score bonus
                if (isWinner) earnedXp += 100; // win bonus

                let currentXp = (data.xp || 0) + earnedXp;
                let currentLevel = data.level || 1;

                // Daily XP Tracking
                let todayStr = new Date().toISOString().split('T')[0];
                let currentDailyXp = data.daily_xp || 0;
                let lastActive = data.last_active_date || todayStr;
                
                if (lastActive !== todayStr) {
                    currentDailyXp = 0;
                }
                currentDailyXp += earnedXp;

                // Level up scaling: 500 base, increases 10% each level
                let nextLevelXp = Math.floor(500 * Math.pow(1.10, currentLevel - 1));
                while (currentXp >= nextLevelXp) {
                    currentXp -= nextLevelXp;
                    currentLevel++;
                    nextLevelXp = Math.floor(500 * Math.pow(1.10, currentLevel - 1));
                }

                // Check for frame unlocks based on currentLevel
                let unlocked = new Set(data.unlocked_frames || ['none']);
                if (currentLevel >= 5) unlocked.add('bronze');
                if (currentLevel >= 10) unlocked.add('silver');
                if (currentLevel >= 20) unlocked.add('gold');
                if (currentLevel >= 35) unlocked.add('neon');
                if (currentLevel >= 50) unlocked.add('glitch');

                await supabase
                    .from('profiles')
                    .update({
                        games_played: (data.games_played || 0) + 1,
                        wins: (data.wins || 0) + (isWinner ? 1 : 0),
                        xp: currentXp,
                        level: currentLevel,
                        unlocked_frames: Array.from(unlocked),
                        daily_xp: currentDailyXp,
                        last_active_date: todayStr
                    })
                    .eq('id', p.userId);

                console.log(`Updated stats & XP for ${p.name} (${p.userId}): +${earnedXp} XP (Level ${currentLevel})`);
            } catch (err) {
                console.error(`Failed to update stats for ${p.name}:`, err.message);
            }
        }
    }
}

module.exports = GameSession;
