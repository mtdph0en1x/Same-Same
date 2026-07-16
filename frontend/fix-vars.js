const fs = require('fs');
const files = [
  'd:/gamedev/same-same/frontend/src/screens/HomeScreen.js',
  'd:/gamedev/same-same/frontend/src/screens/LobbyScreen.js',
  'd:/gamedev/same-same/frontend/src/screens/GameScreen.js',
  'd:/gamedev/same-same/frontend/src/screens/ResultsScreen.js',
  'd:/gamedev/same-same/frontend/src/screens/LandingScreen.js',
  'd:/gamedev/same-same/frontend/src/components/BackgroundPattern.js',
  'd:/gamedev/same-same/frontend/src/components/Button.js',
  'd:/gamedev/same-same/frontend/src/components/ChatSidebar.js',
  'd:/gamedev/same-same/frontend/src/components/LeaderboardSidebar.js',
];

for (const path of files) {
  let code = fs.readFileSync(path, 'utf8');
  
  // Replace `const s = useStyles(theme);` with `const styles = useStyles(theme); const s = styles;`
  code = code.replace(/const s = useStyles\(theme\);/g, 'const styles = useStyles(theme);\n  const s = styles;');
  // Also fix if it was `const styles = useStyles(theme);` already, just in case
  // Wait, if it was `const styles = useStyles(theme);`, it doesn't need fixing.
  
  fs.writeFileSync(path, code);
}
console.log('Fixed variable names');
