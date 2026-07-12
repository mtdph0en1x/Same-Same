// Minimal CJS stub for afinn-165 (ESM-only package).
// Jest can't load the real one in CJS mode; natural's SentimentAnalyzer
// is the only consumer, and we don't use it in our code.
module.exports = { afinn165: {} };
