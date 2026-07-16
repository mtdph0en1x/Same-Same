const fs = require('fs');

const files = [
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

  // Replace import
  code = code.replace(/import\s*\{\s*theme\s*\}\s*from\s*['"]\.\.\/styles\/theme['"];/g, "import { useTheme } from '../context/ThemeContext';");
  code = code.replace(/import\s*\{\s*theme\s*\}\s*from\s*['"]\.\.\/\.\.\/styles\/theme['"];/g, "import { useTheme } from '../../context/ThemeContext';");

  // Change StyleSheet.create
  code = code.replace(/const styles = StyleSheet\.create\(\{/g, 'const useStyles = (theme) => StyleSheet.create({');
  code = code.replace(/const s = StyleSheet\.create\(\{/g, 'const useStyles = (theme) => StyleSheet.create({');

  // Inject useTheme hook into all function components
  const functionRegex = /(?:export\s+(?:default\s+)?)?function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*\{/g;
  code = code.replace(functionRegex, (match, name, params) => {
      const isS = code.includes('s = StyleSheet.create') || code.includes('s.');
      const varName = isS ? 's' : 'styles';
      return `${match}\n  const { theme } = useTheme();\n  const ${varName} = useStyles(theme);`;
  });

  // Replace hardcoded #000 borders
  code = code.replace(/borderColor:\s*['"]#000000['"]/g, 'borderColor: theme.colors.border');
  code = code.replace(/borderColor:\s*['"]#000['"]/g, 'borderColor: theme.colors.border');

  // Replace #fff/#FFF backgrounds with panelBg or cardBg
  code = code.replace(/backgroundColor:\s*['"]#fff['"]/g, 'backgroundColor: theme.colors.panelBg');
  code = code.replace(/backgroundColor:\s*['"]#FFFFFF['"]/gi, 'backgroundColor: theme.colors.panelBg');
  code = code.replace(/backgroundColor:\s*['"]#FFF['"]/g, 'backgroundColor: theme.colors.panelBg');

  // Replace Text colors
  code = code.replace(/color:\s*['"]#111['"]/g, 'color: theme.colors.text');
  code = code.replace(/color:\s*['"]#000['"]/g, 'color: theme.colors.text');
  code = code.replace(/color:\s*['"]#fff['"]/g, 'color: theme.colors.textInverse');
  code = code.replace(/color:\s*['"]#FFF['"]/g, 'color: theme.colors.textInverse');

  // Replace shadow colors
  code = code.replace(/shadowColor:\s*['"]#000['"]/g, 'shadowColor: theme.colors.border');

  fs.writeFileSync(path, code);
  console.log(`${path} refactored`);
}
