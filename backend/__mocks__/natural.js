// Jest mock for the `natural` NLP library.
// We only use JaroWinklerDistance and PorterStemmer.stem in gameLogic.js.
// This avoids loading natural's ESM-only sub-dependencies (afinn-165, uuid)
// which Jest can't handle in CJS mode without Babel.

const JaroWinklerDistance = (a, b) => {
    // Real Jaro-Winkler implementation (compact version)
    if (a === b) return 1;
    const la = a.length, lb = b.length;
    if (la === 0 || lb === 0) return 0;

    const matchDist = Math.max(Math.floor(Math.max(la, lb) / 2) - 1, 0);
    const aMatches  = new Array(la).fill(false);
    const bMatches  = new Array(lb).fill(false);

    let matches = 0, transpositions = 0;

    for (let i = 0; i < la; i++) {
        const start = Math.max(0, i - matchDist);
        const end   = Math.min(i + matchDist + 1, lb);
        for (let j = start; j < end; j++) {
            if (bMatches[j] || a[i] !== b[j]) continue;
            aMatches[i] = bMatches[j] = true;
            matches++;
            break;
        }
    }

    if (matches === 0) return 0;

    let k = 0;
    for (let i = 0; i < la; i++) {
        if (!aMatches[i]) continue;
        while (!bMatches[k]) k++;
        if (a[i] !== b[k]) transpositions++;
        k++;
    }

    const jaro = (matches / la + matches / lb + (matches - transpositions / 2) / matches) / 3;

    // Winkler prefix bonus (up to 4 chars)
    let prefix = 0;
    for (let i = 0; i < Math.min(4, Math.min(la, lb)); i++) {
        if (a[i] !== b[i]) break;
        prefix++;
    }
    return jaro + prefix * 0.1 * (1 - jaro);
};

// Minimal Porter stemmer — handles the common suffixes used in our tests.
// Derived from the public-domain Porter algorithm.
const stem = (word) => {
    let w = word.toLowerCase();

    // Step 1a
    if (w.endsWith('sses'))      w = w.slice(0, -2);
    else if (w.endsWith('ies')) w = w.slice(0, -2);
    else if (w.endsWith('ss'))  { /* keep */ }
    else if (w.endsWith('s'))   w = w.slice(0, -1);

    // Step 1b
    if (w.endsWith('eed')) {
        if (w.length > 4) w = w.slice(0, -1);
    } else if (w.endsWith('ing') && w.length > 5) {
        w = w.slice(0, -3);
        if (w.endsWith('at') || w.endsWith('bl') || w.endsWith('iz')) w += 'e';
        else if (/([^aeiou])\1$/.test(w) && !/[lsz]$/.test(w)) w = w.slice(0, -1);
    } else if (w.endsWith('ed') && w.length > 4) {
        w = w.slice(0, -2);
        if (w.endsWith('at') || w.endsWith('bl') || w.endsWith('iz')) w += 'e';
        else if (/([^aeiou])\1$/.test(w) && !/[lsz]$/.test(w)) w = w.slice(0, -1);
    }

    return w;
};

module.exports = {
    JaroWinklerDistance,
    PorterStemmer: { stem },
};
