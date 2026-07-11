const natural = require('natural');
const JaroWinklerDistance = natural.JaroWinklerDistance;
const PorterStemmer = natural.PorterStemmer;

const CATEGORIES = [
    "Fruits",
    "Things you find in a garage",
    "Colors",
    "Types of dogs",
    "Cities in Europe",
    "Something that is blue",
    "Pizza toppings",
    "Musical instruments"
];

function getRandomCategory() {
    return CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
}

function calculateScores(answers, roundType) {
    // answers is an array of objects: { playerId, answer, playerName }
    const groups = [];

    answers.forEach(p => {
        if (!p.answer || p.answer.trim() === '') return;
        
        let answerStr = p.answer.toLowerCase().trim();
        let stem = PorterStemmer.stem(answerStr);
        
        let foundGroup = false;
        for (let g of groups) {
            // Check if stem matches or fuzzy match is high (e.g. 0.85)
            if (g.stem === stem || JaroWinklerDistance(g.original, answerStr) > 0.85) {
                g.players.push({ id: p.playerId, name: p.playerName });
                foundGroup = true;
                break;
            }
        }
        
        if (!foundGroup) {
            groups.push({
                original: answerStr,
                stem: stem,
                players: [{ id: p.playerId, name: p.playerName }]
            });
        }
    });

    const scoreUpdates = {};
    
    // Same Same: most popular answer wins (1 point per matching person)
    // But Different: least popular answer wins (3 points for unique answer)
    // Rush: simple matching (1 point per matching person, speed could be a factor but keeping it simple)
    groups.forEach(g => {
        if (roundType === 'Same Same' || roundType === 'Rush') {
            if (g.players.length > 1) {
                g.players.forEach(p => {
                    scoreUpdates[p.id] = (scoreUpdates[p.id] || 0) + g.players.length;
                });
            }
        } else if (roundType === 'But Different') {
            if (g.players.length === 1) {
                scoreUpdates[g.players[0].id] = (scoreUpdates[g.players[0].id] || 0) + 3;
            }
        }
    });

    return { groups, scoreUpdates };
}

module.exports = {
    getRandomCategory,
    calculateScores
};
