const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 1. Soporte para archivos Wasm (requerido por expo-sqlite)
config.resolver.assetExts.push('wasm');

// 2. Optimizaciones de resolución y tree-shaking para Expo Router
config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,
};

config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: true,
};

// 3. Cabeceras COEP y COOP para soporte de SharedArrayBuffer en expo-sqlite Web
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
