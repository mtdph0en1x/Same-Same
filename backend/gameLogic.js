const natural = require('natural');
const JaroWinklerDistance = natural.JaroWinklerDistance;
const PorterStemmer = natural.PorterStemmer;
const { supabase } = require('./supabase');

// ---------------------------------------------------------------------------
// Category Packs
// Loaded dynamically from Supabase `topics` table at startup.
// ---------------------------------------------------------------------------
let PACKS = {};

async function loadTopics() {
    console.log('Fetching topics from Supabase...');
    // We fetch pack_id, lang, and topic.
    const { data, error } = await supabase.from('topics').select('pack_id, lang, topic');
    
    if (error) {
        console.error('Failed to load topics:', error);
        return;
    }
    
    // Reset PACKS
    PACKS = {};
    
    data.forEach(row => {
        // Default to 'en' if lang is missing
        const lang = row.lang || 'en';
        const packId = row.pack_id;
        
        if (!PACKS[lang]) PACKS[lang] = {};
        if (!PACKS[lang][packId]) PACKS[lang][packId] = [];
        
        PACKS[lang][packId].push(row.topic);
    });
    
    let total = 0;
    Object.keys(PACKS).forEach(lang => {
        Object.keys(PACKS[lang]).forEach(packId => {
            const count = PACKS[lang][packId].length;
            total += count;
            console.log(`Loaded [${lang}] pack '${packId}': ${count} topics`);
        });
    });
    console.log(`Successfully loaded ${total} topics into memory cache.`);
}

function getRandomCategory(packId = 'classic', lang = 'en') {
    console.log(`[DEBUG-TOPIC] getRandomCategory called with packId="${packId}", lang="${lang}"`);
    console.log(`[DEBUG-TOPIC] Available languages in PACKS cache:`, Object.keys(PACKS));
    
    let pool;
    const langPacks = PACKS[lang] || PACKS['en'] || {};
    console.log(`[DEBUG-TOPIC] langPacks resolved for lang "${lang}" has packs:`, Object.keys(langPacks));

    if (packId === 'all') {
        pool = Object.values(langPacks).flat();
    } else if (langPacks[packId]) {
        pool = langPacks[packId];
    } else {
        if (Object.keys(langPacks).length > 0) {
            console.warn(`Unknown pack "${packId}" for lang "${lang}", falling back to classic`);
        }
        pool = langPacks['classic'] || Object.values(langPacks).flat();
    }
    
    if (!pool || pool.length === 0) return "Oops! No topics found.";
    
    return pool[Math.floor(Math.random() * pool.length)];
}

function getPackNames(lang = 'en') {
    return Object.keys(PACKS[lang] || PACKS['en'] || {});
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

                const isMatch = modifiers.includes('Hardcore') ? (g.canonical.toLowerCase() === w.toLowerCase()) : (g.stem === stem || JaroWinklerDistance(g.canonical, w) > 0.85);
                if (isMatch) {
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
                    let fastest = null;
                    if (modifiers.includes('Rush')) {
                        fastest = g.playerIds.reduce((prev, curr) => (curr.time < prev.time ? curr : prev));
                    }

                    g.playerIds.forEach(p => {
                        scoreUpdates[p.id] = (scoreUpdates[p.id] || 0) + g.playerIds.length;
                        if (fastest && p.id === fastest.id) {
                            scoreUpdates[p.id] += 2;
                        }
                    });
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
                        let fastest = null;
                        if (modifiers.includes('Rush')) {
                            fastest = members.reduce((prev, curr) => (curr.time < prev.time ? curr : prev));
                        }

                        members.forEach(p => {
                            scoreUpdates[p.id] = (scoreUpdates[p.id] || 0) + members.length;
                            if (fastest && p.id === fastest.id) {
                                scoreUpdates[p.id] += 2;
                            }
                        });
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
    loadTopics,
    getRandomCategory,
    getPackNames,
    calculateScores
};
