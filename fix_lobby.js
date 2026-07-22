const fs = require('fs');

const lobbyPath = 'frontend/src/screens/LobbyScreen.js';
let lobby = fs.readFileSync(lobbyPath, 'utf8');

// Fix RoundTypeToggle to accept value prop
lobby = lobby.replace(/function RoundTypeToggle\(\{ type, active, onChange \}\) \{/g, "function RoundTypeToggle({ type, value, active, onChange }) {");
lobby = lobby.replace(/onPress=\{[\(][\)] => onChange\(type\)\}/g, "onPress={() => onChange(value || type)}");

// Fix RoundTypes map
lobby = lobby.replace(/\{?\['Same Same', 'But Different', 'Blitz'\]\.map\(type => \(\s*<RoundTypeToggle\s*key=\{type\}\s*type=\{t\(`lobby\.\$\{type\.replace/g, 
`{['Same Same', 'But Different', 'Blitz'].map(type => (
                  <RoundTypeToggle
                    key={type}
                    value={type}
                    type={t(\`lobby.\${type.replace`);

// Fix Modifiers map (and add Hardcore, Zen back)
lobby = lobby.replace(/\{?\['Rush'\]\.map\(mod => \(\s*<RoundTypeToggle\s*key=\{mod\}\s*type=\{t\(`lobby\.\$\{mod\.toLowerCase\(\)\}`, mod\)\}/g,
`{['Rush', 'Hardcore', 'Zen'].map(mod => (
                  <RoundTypeToggle
                    key={mod}
                    value={mod}
                    type={t(\`lobby.\${mod.toLowerCase()}\`, mod)}`);

fs.writeFileSync(lobbyPath, lobby);

console.log("Fixed LobbyScreen.js toggles");
