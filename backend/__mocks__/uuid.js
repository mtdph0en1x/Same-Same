// CJS stub for uuid — only v4 is used by matchmaker.js.
// The real package ships ESM in dist-node which Jest can't load in CJS mode.
const { randomBytes } = require('crypto');

function v4() {
    const b = randomBytes(16);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    return [
        b.slice(0, 4).toString('hex'),
        b.slice(4, 6).toString('hex'),
        b.slice(6, 8).toString('hex'),
        b.slice(8, 10).toString('hex'),
        b.slice(10, 16).toString('hex'),
    ].join('-');
}

module.exports = { v4 };
