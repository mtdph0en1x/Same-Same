const fs = require('fs');

const path = 'd:/gamedev/same-same/frontend/src/screens/HomeScreen.js';
let code = fs.readFileSync(path, 'utf8');

// Replace StyleSheet.create
code = code.replace(/const s = StyleSheet\.create\(\{/g, 'const useStyles = (theme) => StyleSheet.create({');

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
console.log('HomeScreen.js refactored');
