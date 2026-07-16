const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add 'wasm' to the asset extensions
config.resolver.assetExts.push('wasm');

module.exports = config;
