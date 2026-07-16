'use strict';

const { calculateScores } = require('../gameLogic');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a playerWords map from a plain object: { playerId: ['word1', 'word2'] } */
function words(map) {
    const result = {};
    for (const [id, ws] of Object.entries(map)) {
        // If the element is already an object (like { text, time }), leave it as is.
        // Otherwise, wrap it in an object with time: 0 to simulate the new format.
        const mappedWords = ws.map(w => typeof w === 'string' ? { text: w, time: 0 } : w);
        result[id] = { name: id, words: mappedWords };
    }
    return result;
}

// ---------------------------------------------------------------------------
// Solo mode — Same Same
// ---------------------------------------------------------------------------

describe('Solo · Same Same', () => {
    test('players sharing a word both score (group size points)', () => {
        const { scoreUpdates } = calculateScores(
            words({ alice: ['pizza'], bob: ['pizza'] }),
            'Same Same'
        );
        // Group size = 2, so each scores 2
        expect(scoreUpdates.alice).toBe(2);
        expect(scoreUpdates.bob).toBe(2);
    });

    test('three-way match gives 3 points each', () => {
        const { scoreUpdates } = calculateScores(
            words({ a: ['cat'], b: ['cat'], c: ['cat'] }),
            'Same Same'
        );
        expect(scoreUpdates.a).toBe(3);
        expect(scoreUpdates.b).toBe(3);
        expect(scoreUpdates.c).toBe(3);
    });

    test('unique word earns no points', () => {
        const { scoreUpdates } = calculateScores(
            words({ alice: ['pizza'], bob: ['burger'] }),
            'Same Same'
        );
        expect(scoreUpdates.alice).toBeUndefined();
        expect(scoreUpdates.bob).toBeUndefined();
    });

    test('player with mixed shared + unique only scores the shared word', () => {
        const { scoreUpdates } = calculateScores(
            words({ alice: ['cat', 'unicorn'], bob: ['cat', 'dragon'] }),
            'Same Same'
        );
        expect(scoreUpdates.alice).toBe(2);
        expect(scoreUpdates.bob).toBe(2);
    });

    test('multiple shared words accumulate', () => {
        const { scoreUpdates } = calculateScores(
            words({ a: ['cat', 'dog'], b: ['cat', 'dog'] }),
            'Same Same'
        );
        // 2 shared words × 2 points each = 4
        expect(scoreUpdates.a).toBe(4);
        expect(scoreUpdates.b).toBe(4);
    });
});

// ---------------------------------------------------------------------------
// Solo mode — But Different
// ---------------------------------------------------------------------------

describe('Solo · But Different', () => {
    test('unique word earns 3 points', () => {
        const { scoreUpdates } = calculateScores(
            words({ alice: ['unicorn'], bob: ['dragon'] }),
            'But Different'
        );
        expect(scoreUpdates.alice).toBe(3);
        expect(scoreUpdates.bob).toBe(3);
    });

    test('shared word earns no points', () => {
        const { scoreUpdates } = calculateScores(
            words({ alice: ['pizza'], bob: ['pizza'] }),
            'But Different'
        );
        expect(scoreUpdates.alice).toBeUndefined();
        expect(scoreUpdates.bob).toBeUndefined();
    });

    test('multiple unique words accumulate', () => {
        const { scoreUpdates } = calculateScores(
            words({ a: ['sun', 'moon'], b: ['star', 'comet'] }),
            'But Different'
        );
        // All 4 words unique → each player gets 6
        expect(scoreUpdates.a).toBe(6);
        expect(scoreUpdates.b).toBe(6);
    });

    test('only the unique word scores when one is shared', () => {
        const { scoreUpdates } = calculateScores(
            words({ a: ['pizza', 'unicorn'], b: ['pizza', 'dragon'] }),
            'But Different'
        );
        // 'pizza' shared — no score; unique ones score 3 each
        expect(scoreUpdates.a).toBe(3);
        expect(scoreUpdates.b).toBe(3);
    });
});

// ---------------------------------------------------------------------------
// Solo mode — Rush (same scoring as Same Same)
// ---------------------------------------------------------------------------

describe('Solo · Rush', () => {
    test('shared words score base points just like Same Same', () => {
        const { scoreUpdates } = calculateScores(
            words({ a: ['cat'], b: ['cat'] }),
            'Same Same',
            ['Rush']
        );
        // We aren't testing times here, so they default to 0. The first player 'a' will be picked as fastest if times are equal.
        // Group size is 2, plus 2 for speed bonus for 'a' = 4 points. 'b' gets 2 points.
        expect(scoreUpdates.a).toBe(4);
        expect(scoreUpdates.b).toBe(2);
    });

    test('unique words score nothing', () => {
        const { scoreUpdates } = calculateScores(
            words({ a: ['sun'], b: ['moon'] }),
            'Same Same',
            ['Rush']
        );
        expect(scoreUpdates.a).toBeUndefined();
        expect(scoreUpdates.b).toBeUndefined();
    });

    test('fastest player gets +2 speed bonus', () => {
        const { scoreUpdates } = calculateScores(
            words({
                slow: [{ text: 'apple', time: 5000 }],
                fast: [{ text: 'apple', time: 1000 }],
                medium: [{ text: 'apple', time: 3000 }]
            }),
            'Same Same',
            ['Rush']
        );
        // Group size is 3. Everyone gets 3 points.
        // 'fast' gets an extra +2 for being fastest.
        expect(scoreUpdates.slow).toBe(3);
        expect(scoreUpdates.fast).toBe(5); // 3 + 2
        expect(scoreUpdates.medium).toBe(3);
    });
});

// ---------------------------------------------------------------------------
// Fuzzy / stemming
// ---------------------------------------------------------------------------

describe('Fuzzy matching', () => {
    test('plural and singular are grouped together', () => {
        const { scoreUpdates } = calculateScores(
            words({ a: ['cat'], b: ['cats'] }),
            'Same Same'
        );
        // Stemmer reduces both to the same stem → shared group
        expect(scoreUpdates.a).toBe(2);
        expect(scoreUpdates.b).toBe(2);
    });

    test('very similar spellings are grouped (Jaro-Winkler)', () => {
        const { scoreUpdates } = calculateScores(
            words({ a: ['colour'], b: ['color'] }),
            'Same Same'
        );
        // Similarity > 0.85 → treated as the same word
        expect(scoreUpdates.a).toBe(2);
        expect(scoreUpdates.b).toBe(2);
    });

    test('clearly different words are not grouped', () => {
        const { scoreUpdates } = calculateScores(
            words({ a: ['cat'], b: ['dog'] }),
            'Same Same'
        );
        expect(scoreUpdates).toEqual({});
    });
});

// ---------------------------------------------------------------------------
// Player deduplication
// ---------------------------------------------------------------------------

describe('Player deduplication', () => {
    test('same player submitting the same word twice only counts once', () => {
        const { scoreUpdates } = calculateScores(
            words({ a: ['cat', 'cat'], b: ['cat'] }),
            'Same Same'
        );
        // a submitted 'cat' twice — deduped → group size 2, not 3
        expect(scoreUpdates.a).toBe(2);
        expect(scoreUpdates.b).toBe(2);
    });

    test('same player submitting stem-equivalent words only counts once', () => {
        // 'run' and 'running' share the same stem
        const { scoreUpdates } = calculateScores(
            words({ a: ['run', 'running'], b: ['run'] }),
            'Same Same'
        );
        expect(scoreUpdates.a).toBe(2);
        expect(scoreUpdates.b).toBe(2);
    });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
    test('single player returns no scores', () => {
        const { scoreUpdates } = calculateScores(
            words({ solo: ['cat', 'dog'] }),
            'Same Same'
        );
        expect(scoreUpdates).toEqual({});
    });

    test('empty words arrays return no scores', () => {
        const { scoreUpdates } = calculateScores(
            words({ a: [], b: [] }),
            'Same Same'
        );
        expect(scoreUpdates).toEqual({});
    });

    test('whitespace-only words are ignored', () => {
        const { scoreUpdates } = calculateScores(
            words({ a: ['  ', 'cat'], b: ['cat'] }),
            'Same Same'
        );
        expect(scoreUpdates.a).toBe(2);
        expect(scoreUpdates.b).toBe(2);
    });

    test('always returns a groups array and scoreUpdates object', () => {
        const result = calculateScores(words({ a: ['cat'] }), 'Same Same');
        expect(result).toHaveProperty('groups');
        expect(result).toHaveProperty('scoreUpdates');
        expect(Array.isArray(result.groups)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Team mode — Same Same
// ---------------------------------------------------------------------------

describe('Team mode · Same Same', () => {
    const teams = { a1: 'A', a2: 'A', b1: 'B', b2: 'B' };

    test('intra-team match scores (2 teammates said the same word)', () => {
        const { scoreUpdates } = calculateScores(
            words({ a1: ['pizza'], a2: ['pizza'], b1: ['burger'], b2: ['sushi'] }),
            'Same Same',
            [],
            teams
        );
        expect(scoreUpdates.a1).toBe(2);
        expect(scoreUpdates.a2).toBe(2);
        expect(scoreUpdates.b1).toBeUndefined();
        expect(scoreUpdates.b2).toBeUndefined();
    });

    test('cross-team match does NOT score', () => {
        // Both teams say the same word but no intra-team repeat
        const { scoreUpdates } = calculateScores(
            words({ a1: ['pizza'], b1: ['pizza'] }),
            'Same Same',
            [],
            { a1: 'A', b1: 'B' }
        );
        // Group has a1 + b1, but each team only has 1 member → no intra-team match
        expect(scoreUpdates).toEqual({});
    });

    test('both teams can independently score on different words', () => {
        const { scoreUpdates } = calculateScores(
            words({ a1: ['cat'], a2: ['cat'], b1: ['dog'], b2: ['dog'] }),
            'Same Same',
            [],
            teams
        );
        expect(scoreUpdates.a1).toBe(2);
        expect(scoreUpdates.a2).toBe(2);
        expect(scoreUpdates.b1).toBe(2);
        expect(scoreUpdates.b2).toBe(2);
    });

    test('three-way intra-team match gives 3 points each', () => {
        const bigTeams = { a1: 'A', a2: 'A', a3: 'A', b1: 'B' };
        const { scoreUpdates } = calculateScores(
            words({ a1: ['cat'], a2: ['cat'], a3: ['cat'], b1: ['dog'] }),
            'Same Same',
            [],
            bigTeams
        );
        expect(scoreUpdates.a1).toBe(3);
        expect(scoreUpdates.a2).toBe(3);
        expect(scoreUpdates.a3).toBe(3);
        expect(scoreUpdates.b1).toBeUndefined();
    });

    test('all-cross-team word with no intra-team repeats scores nothing', () => {
        const { scoreUpdates } = calculateScores(
            words({ a1: ['pizza'], b1: ['pizza'], b2: ['pizza'] }),
            'Same Same',
            [],
            { a1: 'A', b1: 'B', b2: 'B' }
        );
        // Team A: only a1 said 'pizza' → no intra match
        // Team B: b1 + b2 said 'pizza' → scores 2 each
        expect(scoreUpdates.a1).toBeUndefined();
        expect(scoreUpdates.b1).toBe(2);
        expect(scoreUpdates.b2).toBe(2);
    });
});

// ---------------------------------------------------------------------------
// Team mode — But Different
// ---------------------------------------------------------------------------

describe('Team mode · But Different', () => {
    const teams = { a1: 'A', a2: 'A', b1: 'B', b2: 'B' };

    test('player scores if no teammate said the same word', () => {
        const { scoreUpdates } = calculateScores(
            words({ a1: ['unicorn'], a2: ['dragon'], b1: ['phoenix'], b2: ['griffin'] }),
            'But Different',
            [],
            teams
        );
        // Every player's word is unique within their own team
        expect(scoreUpdates.a1).toBe(3);
        expect(scoreUpdates.a2).toBe(3);
        expect(scoreUpdates.b1).toBe(3);
        expect(scoreUpdates.b2).toBe(3);
    });

    test('player does NOT score if a teammate said the same word', () => {
        const { scoreUpdates } = calculateScores(
            words({ a1: ['pizza'], a2: ['pizza'], b1: ['burger'], b2: ['sushi'] }),
            'But Different',
            [],
            teams
        );
        // a1 + a2 share 'pizza' → intra-team duplicate → no score for either
        expect(scoreUpdates.a1).toBeUndefined();
        expect(scoreUpdates.a2).toBeUndefined();
        // b1 and b2 have different words → score
        expect(scoreUpdates.b1).toBe(3);
        expect(scoreUpdates.b2).toBe(3);
    });

    test('opponent having the same word does not affect your score', () => {
        // a1 says 'pizza', b1 also says 'pizza' — but a2 did NOT say 'pizza'
        // So a1's 'pizza' is unique within Team A → should score
        const { scoreUpdates } = calculateScores(
            words({ a1: ['pizza'], a2: ['burger'], b1: ['pizza'], b2: ['sushi'] }),
            'But Different',
            [],
            teams
        );
        // a1: pizza unique within team A → scores
        // b1: pizza unique within team B → scores
        expect(scoreUpdates.a1).toBe(3);
        expect(scoreUpdates.b1).toBe(3);
        expect(scoreUpdates.a2).toBe(3);
        expect(scoreUpdates.b2).toBe(3);
    });

    test('intra-team duplicate blocks score even if unique across all players', () => {
        // Only 2 players total, same team — both say same word
        const { scoreUpdates } = calculateScores(
            words({ a1: ['pizza'], a2: ['pizza'] }),
            'But Different',
            [],
            { a1: 'A', a2: 'A' }
        );
        expect(scoreUpdates).toEqual({});
    });
});

// ---------------------------------------------------------------------------
// Team mode — Rush (same as team Same Same)
// ---------------------------------------------------------------------------

describe('Team mode · Rush', () => {
    test('behaves like team Same Same but with speed bonus', () => {
        const teams = { a1: 'A', a2: 'A', b1: 'B', b2: 'B' };
        const { scoreUpdates } = calculateScores(
            words({ a1: ['cat'], a2: ['cat'], b1: ['dog'], b2: ['fish'] }),
            'Same Same',
            ['Rush'],
            teams
        );
        // a1 gets speed bonus (+2) because its time (0) ties with a2, and a1 was processed first.
        expect(scoreUpdates.a1).toBe(4);
        expect(scoreUpdates.a2).toBe(2);
        expect(scoreUpdates.b1).toBeUndefined();
        expect(scoreUpdates.b2).toBeUndefined();
    });
});
