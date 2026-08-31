/**
 * ZenMoney — Network Utilities
 *
 * Provee funciones para verificación rápida de conectividad y límites
 * de tiempo (timeouts) en peticiones de red para evitar bloqueos en modo offline.
 */

import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

const DEFAULT_TIMEOUT_MS = 2500;

/**
 * Determina si el dispositivo tiene acceso real a internet.
 * A diferencia de verificar solo `isConnected`, también valida `isInternetReachable`.
 */
export async function isOnlineFast(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return typeof navigator !== 'undefined' && navigator.onLine !== false;
  }

  try {
    const state = await NetInfo.fetch();
    return !!state.isConnected && state.isInternetReachable !== false;
  } catch {
    return false;
  }
}

/**
 * Ejecuta una promesa con un tiempo límite estricto.
 * Si la promesa tarda más de `timeoutMs`, se rechaza con un error de timeout
 * o devuelve el valor `fallbackValue` provisto.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  fallbackValue?: T
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      if (fallbackValue !== undefined) {
        resolve(fallbackValue);
      } else {
        reject(new Error(`[NetworkTimeout] Petición cancelada tras ${timeoutMs}ms sin respuesta.`));
      }
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    if (fallbackValue !== undefined) {
      return fallbackValue;
    }
    throw err;
  }
}
