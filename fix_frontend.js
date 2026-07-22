const fs = require('fs');

// 1. Update GameScreen
const gamePath = 'frontend/src/screens/GameScreen.js';
let game = fs.readFileSync(gamePath, 'utf8');

game = game.replace(/setTimeLeft\(gameData\.timeLimit \|\| 60\);/g, "setTimeLeft(gameData.timeLimit !== undefined ? gameData.timeLimit : 60);");

game = game.replace(/const interval = setInterval\(\(\) => \{\n\s*setTimeLeft\(t => \(t > 0 \? t - 1 : 0\)\);\n\s*\}, 1000\);/g, 
`let interval;
    if (gameData.timeLimit > 0) {
      interval = setInterval(() => {
        setTimeLeft(t => (t > 0 ? t - 1 : 0));
      }, 1000);
    }`);

game = game.replace(/return \(\) => \{\n\s*clearInterval\(interval\);/g, "return () => {\n      if (interval) clearInterval(interval);");

game = game.replace(/<AppText style=\{styles\.timerText\}>\{timeLeft\}<\/AppText>/g, "<AppText style={styles.timerText}>{gameData.timeLimit === 0 ? '∞' : timeLeft}</AppText>");

fs.writeFileSync(gamePath, game);

// 2. Update ResultsScreen
const resultsPath = 'frontend/src/screens/ResultsScreen.js';
let results = fs.readFileSync(resultsPath, 'utf8');

// Calculate rush winner
results = results.replace(/const maxSteps = Math\.max\(1, timeline\.length\);/g, 
`const maxSteps = Math.max(1, timeline.length);
  const rushWinnerEvent = timeline.find(ev => ev.type === 'rush_bonus');
  const rushWinnerId = rushWinnerEvent ? rushWinnerEvent.playerId : null;`);

// Timeline rush banner
results = results.replace(/\{currentTimelineEvent\?\.type === 'topic' && \(/g, 
`{currentTimelineEvent?.type === 'rush_bonus' && (
              <View style={[styles.topicBadge, { backgroundColor: '#FCD34D' }]}>
                  <AppText style={styles.topicBadgeText}>⚡ {playerNames[currentTimelineEvent.playerId]} +2 {t('lobby.rush', 'Rush')} Bonus!</AppText>
              </View>
          )}
          {currentTimelineEvent?.type === 'topic' && (`);

// Scoreboard rush bolt
results = results.replace(/<AppText style=\{styles\.playerLabelName\}>\{playerNames\[pid\]\}<\/AppText>/g, 
`<AppText style={styles.playerLabelName}>{playerNames[pid]}</AppText>
                                    {rushWinnerId === pid && step >= maxSteps && (
                                        <Text style={{ fontSize: 20, marginLeft: 5 }}>⚡</Text>
                                    )}`);

fs.writeFileSync(resultsPath, results);

console.log("Updated GameScreen and ResultsScreen");
