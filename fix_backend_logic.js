const fs = require('fs');

// 1. Update GameSession
const sessionPath = 'backend/gameSession.js';
let sess = fs.readFileSync(sessionPath, 'utf8');

// Zen timer logic in GameSession start
sess = sess.replace(/timeLimit:     \[30, 60, 90\]\.includes\(config\.timeLimit\)     \? config\.timeLimit     : 60,/g,
"timeLimit:     config.modifiers?.includes('Zen') ? 0 : ([30, 60, 90].includes(config.timeLimit) ? config.timeLimit : 60),");

// Track doneTime in submitWord
sess = sess.replace(/pw\.done = true;/g, "pw.done = true;\n            pw.doneTime = Date.now();");

// Add Rush Bonus event to timeline
// We need to inject the logic into endRound before timeline is dispatched.
const rushBonusLogic = `
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
        
        this.timeline = timeline;`;

sess = sess.replace(/this\.timeline = timeline;/g, rushBonusLogic);

// Prevent Zen timeout
sess = sess.replace(/this\.timer = setTimeout\(\(\) => \{/g,
`if (this.config.timeLimit > 0) {
            this.timer = setTimeout(() => {`);
sess = sess.replace(/\}, this\.config\.timeLimit \* 1000\);/g,
`}, this.config.timeLimit * 1000);
        }`);


fs.writeFileSync(sessionPath, sess);

// 2. Update GameLogic
const logicPath = 'backend/gameLogic.js';
let logic = fs.readFileSync(logicPath, 'utf8');

// Implement Hardcore fuzzy matching bypass
logic = logic.replace(/if \(g\.stem === stem \|\| JaroWinklerDistance\(g\.canonical, w\) > 0\.85\) \{/g,
`const isMatch = modifiers.includes('Hardcore') ? (g.canonical.toLowerCase() === w.toLowerCase()) : (g.stem === stem || JaroWinklerDistance(g.canonical, w) > 0.85);
                if (isMatch) {`);

// Remove old Rush mode per-word speed bonuses
logic = logic.replace(/let fastestPlayer = null;/g, "");
logic = logic.replace(/let minTime = Infinity;/g, "");
logic = logic.replace(/if \(modifiers\.includes\('Rush'\) && p\.time < minTime\) \{\s*minTime = p\.time;\s*fastestPlayer = p\.id;\s*\}/g, "");
logic = logic.replace(/\/\/ Award speed bonus in Rush mode\s*if \(modifiers\.includes\('Rush'\) && fastestPlayer\) \{\s*scoreUpdates\[fastestPlayer\] \+= 2;\s*\}/g, "");


fs.writeFileSync(logicPath, logic);

console.log("Fixed backend game logic");
