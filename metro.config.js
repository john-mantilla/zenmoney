const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add 'wasm' to the asset extensions
config.resolver.assetExts.push('wasm');

// Add COEP and COOP headers to support SharedArrayBuffer in expo-sqlite web
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
