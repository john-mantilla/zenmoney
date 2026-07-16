# Guía: Generar Nueva Versión de Android

## 📋 Resumen Ejecutivo

Última compilación exitosa:
- **Build ID:** `81a6c776-c977-49b1-bed4-c34dca9c4201`
- **Profile:** preview (APK, distribución interna)
- **Plataforma:** Android
- **SDK:** 57.0.0
- **Versión App:** 1.0.0
- **Version Code:** Auto-incrementado por EAS (appVersionSource: "remote")

---

## 🔧 Problema Inicial

El primer intento de build falló con:
```
Gradle build failed with unknown error
```

**Causa raíz:** Una carpeta `android/` generada localmente (por `expo run:android`) fue detectada por EAS, haciendo que:
- EAS asumiera que el proyecto era **bare workflow** (nativo gestionado manualmente)
- Ignorara la configuración en `app.json`
- Usara la config nativa desactualizada y stale de la carpeta local
- Gradle fallara por inconsistencias en la configuración

---

## ✅ Solución Aplicada

### Paso 1: Actualizar `.easignore`

Agregué las carpetas nativas generadas localmente a la lista de exclusión para que EAS siempre regenere el proyecto desde cero usando `app.json`:

```bash
# Archivo: .easignore
# Agregué al final:

# Locally generated native projects (from `expo run:android` / `expo run:ios`).
# Without this, EAS detects the folder and treats the project as bare workflow,
# skipping `expo prebuild` and using the stale local native config instead of app.json.
/android
/ios
```

**Por qué funciona:**
- EAS ejecuta `expo prebuild` automáticamente antes de compilar
- `prebuild` regenera las carpetas nativas desde `app.json`
- Al excluir las carpetas locales, evitamos que EAS detecte "bare workflow"
- El build usa siempre la configuración actualizada de `app.json`

---

## 🚀 Pasos para Generar Nueva Versión

### Prerequisitos

```bash
# Asegurate que tengas EAS CLI instalada y estés autenticado
npx eas --version
npx eas whoami
```

### Generar el Build

```bash
cd "D:/Documentos/Iniciativas/FinanzasPersonales/zenmoney"

# Lanzar build para Android con perfil preview
npx eas build --platform android --profile preview --non-interactive
```

**Banderas:**
- `--platform android`: Compilar solo para Android
- `--profile preview`: Usar el perfil "preview" (APK, internal distribution)
- `--non-interactive`: No esperar confirmaciones interactivas (requiere credentials ya configuradas)

**Esperar a que termine:** El build típicamente tarda 10-20 minutos

### Resultado

Al completarse, EAS retorna:
- **Build ID** único
- **QR code** para instalar en dispositivos Android
- **Link directo** a https://expo.dev/accounts/johnmantilla/projects/zenmoney/builds/{BUILD_ID}

---

## 📊 Configuración del Proyecto

### `app.json` - Configuración Master

```json
{
  "expo": {
    "name": "ZenMoney",
    "version": "1.0.0",  // ← Versión legible (no cambia con cada build)
    "android": {
      "package": "com.zenmoney.app",
      "adaptiveIcon": { ... },
      "permissions": ["android.permission.RECORD_AUDIO"]
    }
  }
}
```

### `eas.json` - Perfiles de Build

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"  // ← Genera APK (no bundle)
      }
    },
    "production": { }
  }
}
```

**Nota:** `appVersionSource: "remote"` en `eas.json` hace que el **version code** se incremente automáticamente en cada build.

### `.easignore` - Exclusiones para EAS

```
package-lock.json
/android
/ios
```

**Por qué excluir `android/` e `ios/`:**
- Son generados localmente por `expo run:android` y `expo run:ios`
- EAS debe generar una versión limpia desde `app.json` con `expo prebuild`
- Si los detecta, EAS asume que es bare workflow y no regenera

---

## 🔍 Verificar Build

Para ver detalles de un build existente:

```bash
# Ver resumen
npx eas build:view {BUILD_ID}

# Ver en formato JSON (más detalles)
npx eas build:view {BUILD_ID} --json

# Ejemplo:
npx eas build:view 81a6c776-c977-49b1-bed4-c34dca9c4201
```

---

## 📱 Instalar el APK

1. **Opción A - QR Code**
   - Escanear el QR del output de EAS con un dispositivo Android
   - Expo abre la página de descarga automáticamente

2. **Opción B - Link Directo**
   - Abrir en el dispositivo: `https://expo.dev/accounts/johnmantilla/projects/zenmoney/builds/{BUILD_ID}`
   - Descargar y instalar el APK

3. **Opción C - Descarga Local**
   ```bash
   # Ver el URL del APK
   npx eas build:view {BUILD_ID} --json | grep -i "Application Archive URL"
   
   # Descargar
   curl -o app.apk "https://expo.dev/artifacts/eas/{HASH}.apk"
   
   # Enviar al dispositivo
   adb install app.apk
   ```

---

## 🐛 Troubleshooting

### "Build failed - unknown Gradle error"
**Solución:** Asegúrate que `.easignore` excluye `/android` e `/ios`

### "Specified value for 'android.package' in app.json is ignored..."
**Significado:** EAS detectó una carpeta `android/` local. Es una advertencia, pero confirma que ignorará `app.json`.
**Solución:** Agregar a `.easignore` si no está.

### "Computing project fingerprint is taking longer..."
**Significado:** EAS está validando dependencias y prebuild. Normal.
**Solución:** Esperar pacientemente (hasta 5 minutos es normal).

### Build desaparece del dashboard
**Significado:** Los builds internos expiran después de 14 días.
**Solución:** Guardar el ID o usar `--non-interactive` y capturar el output.

---

## 📝 Cambios en Esta Iteración

✅ **Archivos modificados:**
- `.easignore` - Agregadas exclusiones `/android` e `/ios`

✅ **Configuración sin cambios:**
- `app.json` - v1.0.0 (mismo)
- `eas.json` - perfil preview sin cambios
- Dependencias - mismo package-lock.json

✅ **Build resultados:**
- Version Code: Auto-incrementado de 1 a 1 (mismo en la misma sesión)
- SDK: 57.0.0 (mismo)
- Distribution: internal (mismo)

---

## 🔄 Próximas Versiones

Para generar la **próxima versión:**

```bash
# Simplemente ejecutar
npx eas build --platform android --profile preview --non-interactive
```

EAS automáticamente:
1. Regenerará la carpeta `android/` desde `app.json` (porque `/android` está en `.easignore`)
2. Incrementará el version code
3. Compilará con Gradle
4. Generará el APK

---

## 📚 Referencias

- [Expo EAS Build Docs](https://docs.expo.dev/versions/v57.0.0/eas/builds/)
- [EAS Build Profiles](https://docs.expo.dev/eas/build-configuration/)
- [app.json Reference](https://docs.expo.dev/versions/v57.0.0/config/app/)
- [Development vs Production Builds](https://docs.expo.dev/develop/development-builds/introduction/)

---

**Última actualización:** 2026-07-15  
**Estado:** ✅ Build exitoso
