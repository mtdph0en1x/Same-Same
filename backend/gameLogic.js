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
// Returns:
//   groups: [{ canonical: string, stem: string, playerIds: [{ id, name }] }]
//   scoreUpdates: { [playerId]: pointsEarned }
// ---------------------------------------------------------------------------
function calculateScores(playerWords, roundType) {
    const groups = [];

    for (const [playerId, data] of Object.entries(playerWords)) {
        // Deduplicate words per player before grouping
        const seenStems = new Set();

        for (const word of data.words) {
            const w = word.toLowerCase().trim();
            if (!w) continue;

            const stem = PorterStemmer.stem(w);
            if (seenStems.has(stem)) continue; // skip duplicate stems from same player
            seenStems.add(stem);

            let foundGroup = false;
            for (const g of groups) {
                if (g.stem === stem || JaroWinklerDistance(g.canonical, w) > 0.85) {
                    // Only add this player once per group
                    if (!g.playerIds.find(p => p.id === playerId)) {
                        g.playerIds.push({ id: playerId, name: data.name });
                    }
                    foundGroup = true;
                    break;
                }
            }

            if (!foundGroup) {
                groups.push({
                    canonical: w,
                    stem: stem,
                    playerIds: [{ id: playerId, name: data.name }],
                });
            }
        }
    }

    const scoreUpdates = {};

    // Same Same: shared answers score (points = group size)
    // But Different: unique answers score (3 points)
    // Rush: same as Same Same (speed mechanic deferred)
    groups.forEach(g => {
        if (roundType === 'Same Same' || roundType === 'Rush') {
            if (g.playerIds.length > 1) {
                g.playerIds.forEach(p => {
                    scoreUpdates[p.id] = (scoreUpdates[p.id] || 0) + g.playerIds.length;
                });
            }
        } else if (roundType === 'But Different') {
            if (g.playerIds.length === 1) {
                scoreUpdates[g.playerIds[0].id] = (scoreUpdates[g.playerIds[0].id] || 0) + 3;
            }
        }
    });

    return { groups, scoreUpdates };
}

module.exports = {
    getRandomCategory,
    getPackNames,
    calculateScores
};
