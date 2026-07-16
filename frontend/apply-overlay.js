const fs = require('fs');
let code = fs.readFileSync('d:/gamedev/same-same/frontend/App.js', 'utf8');

// 1. Add isNightMode state
code = code.replace(
  "const [currentScreen, setCurrentScreen] = useState('Landing');",
  "const [currentScreen, setCurrentScreen] = useState('Landing');\n  const [isNightMode, setIsNightMode] = useState(false);"
);

// 2. Add toggle button
code = code.replace(
  "<Text style={chrome.phVersion}>v0.9 β</Text>",
  `<View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <TouchableOpacity onPress={() => setIsNightMode(!isNightMode)} style={chrome.themeToggle}>
          <Text style={{ fontSize: 20 }}>{isNightMode ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
        <Text style={chrome.phVersion}>v0.9 β</Text>
      </View>`
);

// 3. Add chrome.themeToggle style
code = code.replace(
  "// News Bar",
  `themeToggle: {
    padding: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  // News Bar`
);

// 4. Add Overlay
const overlayCode = `
        {/* ── Night Mode Overlay ── */}
        {isNightMode && (
          <View 
            pointerEvents="none" 
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: 'rgba(0,0,0,0.6)',
              zIndex: 9999
            }} 
          />
        )}
`;
code = code.replace(
  "{PageFooter}\n      </View>\n  );\n}",
  `{PageFooter}\n${overlayCode}      </View>\n  );\n}`
);

fs.writeFileSync('d:/gamedev/same-same/frontend/App.js', code);
console.log('App.js modified safely');
