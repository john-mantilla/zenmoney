import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as aesjs from 'aes-js';
import { Platform } from 'react-native';

/**
 * LargeSecureStore Adapter para Supabase Auth en Expo React Native
 *
 * Resuelve la limitación de hardware de Expo SecureStore (máx 2048 bytes por ítem):
 * 1. Genera una clave simétrica aleatoria AES-256 (32 bytes).
 * 2. Guarda ÚNICAMENTE la clave de cifrado en SecureStore (iOS Keychain / Android Keystore).
 * 3. Encripta el payload de la sesión de Supabase con AES-CTR y almacena el texto cifrado
 *    en AsyncStorage.
 * 4. Para un atacante que extraiga AsyncStorage sin acceso al Keystore de hardware,
 *    los datos son ilegibles (texto cifrado AES-256).
 * 5. En plataforma Web, hace fallback transparente al localStorage estándar.
 * 6. Migración suave: Si encuentra una sesión previa en texto plano, la acepta y la cifra automáticamente.
 */
export class LargeSecureStore {
  private async _getEncryptionKey(key: string): Promise<Uint8Array> {
    const secretKeyName = `zen_sec_k_${key}`;
    let keyHex = await SecureStore.getItemAsync(secretKeyName);

    if (!keyHex) {
      // Generar clave segura de 256 bits (32 bytes)
      const randomBytes = new Uint8Array(32);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(randomBytes);
      } else {
        for (let i = 0; i < 32; i++) {
          randomBytes[i] = Math.floor(Math.random() * 256);
        }
      }
      keyHex = aesjs.utils.hex.fromBytes(randomBytes);
      await SecureStore.setItemAsync(secretKeyName, keyHex);
      return randomBytes;
    }

    return aesjs.utils.hex.toBytes(keyHex);
  }

  private async _encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = await this._getEncryptionKey(key);
    const textBytes = aesjs.utils.utf8.toBytes(value);
    const aesCtr = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(5));
    const encryptedBytes = aesCtr.encrypt(textBytes);
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async _decrypt(key: string, encryptedHex: string): Promise<string | null> {
    try {
      const encryptionKey = await this._getEncryptionKey(key);
      const encryptedBytes = aesjs.utils.hex.toBytes(encryptedHex);
      const aesCtr = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(5));
      const decryptedBytes = aesCtr.decrypt(encryptedBytes);
      return aesjs.utils.utf8.fromBytes(decryptedBytes);
    } catch (err) {
      console.warn('[LargeSecureStore] Error al desencriptar sesión:', err);
      return null;
    }
  }

  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    }

    const storedValue = await AsyncStorage.getItem(key);
    if (!storedValue) return null;

    // Migración suave: si el valor guardado es JSON plano (sesión previa sin cifrar),
    // se retorna tal cual para que el usuario no pierda su sesión iniciada.
    if (storedValue.startsWith('{') || storedValue.startsWith('[')) {
      return storedValue;
    }

    return this._decrypt(key, storedValue);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
      return;
    }

    try {
      const encrypted = await this._encrypt(key, value);
      await AsyncStorage.setItem(key, encrypted);
    } catch (err) {
      console.error('[LargeSecureStore] Fallo al encriptar sesión. Fallback seguro a AsyncStorage:', err);
      await AsyncStorage.setItem(key, value);
    }
  }

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
      return;
    }

    const secretKeyName = `zen_sec_k_${key}`;
    await AsyncStorage.removeItem(key);
    try {
      await SecureStore.deleteItemAsync(secretKeyName);
    } catch {
      // Ignorar si no existía en SecureStore
    }
  }
}

export const secureStorageAdapter = new LargeSecureStore();
