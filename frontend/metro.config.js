const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add 'mjs' to the list of source extensions
config.resolver.sourceExts.push('mjs');

// Add 'flac' to the list of asset extensions so Metro can bundle it
config.resolver.assetExts.push('flac');

module.exports = config;
