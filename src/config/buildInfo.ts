/**
 * Configuración de las versiones y enlaces de descarga de la aplicación móvil.
 * Permite mantener un enlace canónico visible en la versión web para instalar el APK.
 */

export const BUILD_CONFIG = {
  version: '1.4.2',
  android: {
    // Enlace a la compilación más reciente en Expo EAS
    latestBuildUrl: 'https://expo.dev/accounts/johnmantilla/projects/zenmoney/builds/fa382dd3-c645-4662-85ab-8235634d0af2',
    // Enlace al historial completo de versiones públicas en EAS
    allBuildsUrl: 'https://expo.dev/accounts/johnmantilla/projects/zenmoney/builds',
    // Generador de QR dinámico a partir de la URL del build actual
    getQrCodeUrl: (url: string = 'https://expo.dev/accounts/johnmantilla/projects/zenmoney/builds/fa382dd3-c645-4662-85ab-8235634d0af2') =>
      `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`,
  },
};
