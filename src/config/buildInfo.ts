/**
 * Configuración de las versiones y enlaces de descarga de la aplicación móvil.
 * Permite mantener un enlace canónico visible en la versión web para instalar el APK.
 */

export const BUILD_CONFIG = {
  version: '1.6.0',
  android: {
    // Enlace a la compilación más reciente en Expo EAS
    latestBuildUrl: 'https://expo.dev/accounts/jmantilla.zen/projects/zenmoney/builds/44cc2583-cf76-4649-8852-d58c978c8dbc',
    // Enlace al historial completo de versiones públicas en EAS
    allBuildsUrl: 'https://expo.dev/accounts/jmantilla.zen/projects/zenmoney/builds',
    // Generador de QR dinámico a partir de la URL del build actual
    getQrCodeUrl: (url: string = 'https://expo.dev/accounts/jmantilla.zen/projects/zenmoney/builds/44cc2583-cf76-4649-8852-d58c978c8dbc') =>
      `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`,
  },
};
