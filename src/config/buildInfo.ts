/**
 * Configuración de las versiones y enlaces de descarga de la aplicación móvil.
 * Permite mantener un enlace canónico visible en la versión web para instalar el APK.
 */

export const BUILD_CONFIG = {
  version: '1.6.1',
  android: {
    // Enlace a la compilación más reciente en Expo EAS
    latestBuildUrl: 'https://expo.dev/accounts/jmantilla.zen/projects/zenmoney/builds/500a3df3-7a35-479b-a098-edf285f76922',
    // Enlace al historial completo de versiones públicas en EAS
    allBuildsUrl: 'https://expo.dev/accounts/jmantilla.zen/projects/zenmoney/builds',
    // Generador de QR dinámico a partir de la URL del build actual
    getQrCodeUrl: (url: string = 'https://expo.dev/accounts/jmantilla.zen/projects/zenmoney/builds/500a3df3-7a35-479b-a098-edf285f76922') =>
      `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`,
  },
};
