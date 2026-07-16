const fs = require('fs');
const glob = require('glob'); // Actually, I'll just hardcode the paths since there are only a few.

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
  
  if (code.includes('useTheme(') || code.includes('useTheme()')) {
    if (!code.includes('useTheme } from')) {
      // Find the last import statement
      const importMatches = [...code.matchAll(/^import.*?;/gm)];
      if (importMatches.length > 0) {
        const lastImport = importMatches[importMatches.length - 1];
        const lastImportEnd = lastImport.index + lastImport[0].length;
        
        let contextPath = '../context/ThemeContext';
        if (path.includes('components/')) contextPath = '../context/ThemeContext';
        if (path.includes('screens/')) contextPath = '../context/ThemeContext';
        
        code = code.slice(0, lastImportEnd) + `\nimport { useTheme } from '${contextPath}';` + code.slice(lastImportEnd);
        
        fs.writeFileSync(path, code);
        console.log('Fixed imports in', path);
      } else {
        // Just put it at the top
        code = `import { useTheme } from '../context/ThemeContext';\n` + code;
        fs.writeFileSync(path, code);
        console.log('Fixed imports in (top)', path);
      }
    }
  }
}
console.log('Done');
