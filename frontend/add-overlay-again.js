const fs = require('fs');
let code = fs.readFileSync('d:/gamedev/same-same/frontend/App.js', 'utf8');

const target = "{PageFooter}";
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

code = code.replace(target, target + overlayCode);

fs.writeFileSync('d:/gamedev/same-same/frontend/App.js', code);
console.log('Overlay actually added');
