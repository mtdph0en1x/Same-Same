const natural = require('natural');
const JaroWinklerDistance = natural.JaroWinklerDistance;
const PorterStemmer = natural.PorterStemmer;
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Category Packs
// Loaded dynamically from backend/categories/*.json at startup.
// To add a new pack: drop a new <packname>.json file in that folder and restart.
// ---------------------------------------------------------------------------
const PACKS = {};
const categoriesDir = path.join(__dirname, 'categories');
fs.readdirSync(categoriesDir).forEach(file => {
    if (file.endsWith('.json')) {
        const packId = file.replace('.json', '');
        PACKS[packId] = JSON.parse(fs.readFileSync(path.join(categoriesDir, file), 'utf8'));
        console.log(`Loaded category pack: ${packId} (${PACKS[packId].length} categories)`);
    }
});

function getRandomCategory(packId = 'classic') {
    let pool;
    if (packId === 'all') {
        pool = Object.values(PACKS).flat();
    } else if (PACKS[packId]) {
        pool = PACKS[packId];
    } else {
        console.warn(`Unknown pack "${packId}", falling back to classic`);
        pool = PACKS['classic'] || Object.values(PACKS).flat();
    }
    return pool[Math.floor(Math.random() * pool.length)];
}

function getPackNames() {
    return Object.keys(PACKS);
}

// ---------------------------------------------------------------------------
// Scoring
//
// playerWords shape:
//   { [playerId]: { name: string, words: string[] } }
//
// teams shape (optional):
//   { [playerId]: 'A' | 'B' }
//   When null/undefined: solo mode — existing rules apply unchanged.
//
// Team mode rules (symmetric — the team is the unit of comparison):
//   Same Same / Rush : intra-team matches score (2+ teammates said the same word).
//                      Cross-team word overlaps do NOT score.
//   But Different    : intra-team unique words score (only 1 player from your
//                      team said it). What the opposing team said is irrelevant.
//
// Returns:
//   groups: [{ canonical: string, stem: string, playerIds: [{ id, name }] }]
//   scoreUpdates: { [playerId]: pointsEarned }
// ---------------------------------------------------------------------------
function calculateScores(playerWords, roundType, modifiers = [], teams = null) {
    // ── Step 1: Build word groups (global fuzzy matching, same as before) ──
    const groups = [];

    for (const [playerId, data] of Object.entries(playerWords)) {
        // Deduplicate words per player before grouping
        const seenStems = new Set();

        for (let i = 0; i < data.words.length; i++) {
            const wordObj = data.words[i];
            // Support both old string format (for tests) and new object format
            const text = typeof wordObj === 'string' ? wordObj : wordObj.text;
            const time = typeof wordObj === 'string' ? 0 : (wordObj.time || 0);

            const w = text.toLowerCase().trim();
            if (!w) continue;

            const stem = PorterStemmer.stem(w);
            if (seenStems.has(stem)) continue; // skip duplicate stems from same player
            seenStems.add(stem);

            let foundGroup = false;
            for (const g of groups) {
                if (roundType === 'Blitz' && g.topicIndex !== i) continue;

                if (g.stem === stem || JaroWinklerDistance(g.canonical, w) > 0.85) {
                    // Only add this player once per group
                    if (!g.playerIds.find(p => p.id === playerId)) {
                        g.playerIds.push({ id: playerId, name: data.name, time, wordIndex: i, text: w });
                    }
                    foundGroup = true;
                    break;
                }
            }

            if (!foundGroup) {
                groups.push({
                    canonical: w,
                    stem:      stem,
                    topicIndex: roundType === 'Blitz' ? i : -1,
                    playerIds: [{ id: playerId, name: data.name, time, wordIndex: i, text: w }],
                });
            }
        }
    }

    // ── Step 2: Score ────────────────────────────────────────────────────────
    const scoreUpdates = {};

    if (!teams) {
        // ── Solo mode (unchanged) ──────────────────────────────────────────
        // Same Same / Blitz: shared answers score (points = group size)
        // But Different: unique answers score (3 points)
        groups.forEach(g => {
            if (roundType === 'Same Same' || roundType === 'Blitz') {
                if (g.playerIds.length > 1) {
                    let fastestPlayer = null;
                    let minTime = Infinity;

                    g.playerIds.forEach(p => {
                        scoreUpdates[p.id] = (scoreUpdates[p.id] || 0) + g.playerIds.length;
                        if (modifiers.includes('Rush') && p.time < minTime) {
                            minTime = p.time;
                            fastestPlayer = p.id;
                        }
                    });

                    // Award speed bonus in Rush mode
                    if (modifiers.includes('Rush') && fastestPlayer) {
                        scoreUpdates[fastestPlayer] += 2;
                    }
                }
            } else if (roundType === 'But Different') {
                if (g.playerIds.length === 1) {
                    scoreUpdates[g.playerIds[0].id] = (scoreUpdates[g.playerIds[0].id] || 0) + 3;
                }
            }
        });
    } else {
        // ── Team mode (team is the unit of comparison) ─────────────────────
        groups.forEach(g => {
            // Split the group's players by team
            const byTeam = { A: [], B: [] };
            g.playerIds.forEach(p => {
                const t = teams[p.id];
                if (t === 'A' || t === 'B') byTeam[t].push(p);
            });

            if (roundType === 'Same Same' || roundType === 'Blitz') {
                // Intra-team matches: each team independently checks if 2+ teammates said it
                ['A', 'B'].forEach(team => {
                    const members = byTeam[team];
                    if (members.length > 1) {
                        let fastestPlayer = null;
                        let minTime = Infinity;

                        members.forEach(p => {
                            scoreUpdates[p.id] = (scoreUpdates[p.id] || 0) + members.length;
                            if (modifiers.includes('Rush') && p.time < minTime) {
                                minTime = p.time;
                                fastestPlayer = p.id;
                            }
                        });

                        // Award speed bonus in Rush mode
                        if (modifiers.includes('Rush') && fastestPlayer) {
                            scoreUpdates[fastestPlayer] += 2;
                        }
                    }
                });
            } else if (roundType === 'But Different') {
                // Intra-team unique: score if only 1 person from your team said it
                ['A', 'B'].forEach(team => {
                    const members = byTeam[team];
                    if (members.length === 1) {
                        const p = members[0];
                        scoreUpdates[p.id] = (scoreUpdates[p.id] || 0) + 3;
                    }
                });
            }
        });
    }

    return { groups, scoreUpdates };
}

module.exports = {
    getRandomCategory,
    getPackNames,
    calculateScores
};
