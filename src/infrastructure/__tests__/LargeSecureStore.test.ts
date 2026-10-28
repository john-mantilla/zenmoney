import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LargeSecureStore } from '../auth/LargeSecureStore';

// In-memory mocks for SecureStore and AsyncStorage
const mockSecureStorage: Record<string, string> = {};
const mockAsyncStorage: Record<string, string> = {};

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => mockSecureStorage[key] ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    mockSecureStorage[key] = value;
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    delete mockSecureStorage[key];
  }),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => mockAsyncStorage[key] ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      mockAsyncStorage[key] = value;
    }),
    removeItem: vi.fn(async (key: string) => {
      delete mockAsyncStorage[key];
    }),
  },
}));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));

describe('LargeSecureStore — Almacenamiento Cifrado de Sesiones Supabase', () => {
  let store: LargeSecureStore;

  beforeEach(() => {
    for (const key of Object.keys(mockSecureStorage)) delete mockSecureStorage[key];
    for (const key of Object.keys(mockAsyncStorage)) delete mockAsyncStorage[key];
    store = new LargeSecureStore();
  });

  it('guarda la sesión encriptada en AsyncStorage y la clave simétrica en SecureStore', async () => {
    const sessionPayload = JSON.stringify({
      access_token: 'secret-jwt-token-12345',
      refresh_token: 'secret-refresh-token-67890',
      user: { id: 'usr-99', email: 'user@zenmoney.app' },
    });

    await store.setItem('sb-session', sessionPayload);

    // AsyncStorage NO debe contener el texto plano de los tokens
    expect(mockAsyncStorage['sb-session']).toBeDefined();
    expect(mockAsyncStorage['sb-session']).not.toContain('secret-jwt-token-12345');
    expect(mockAsyncStorage['sb-session']).not.toContain('user@zenmoney.app');

    // SecureStore debe contener únicamente la clave de 32 bytes en formato hex (64 chars)
    expect(mockSecureStorage['zen_sec_k_sb-session']).toBeDefined();
    expect(mockSecureStorage['zen_sec_k_sb-session']).toHaveLength(64);

    // Al leer, debe desencriptar con éxito recuperando el payload original exacto
    const retrieved = await store.getItem('sb-session');
    expect(retrieved).toBe(sessionPayload);
    const parsed = JSON.parse(retrieved!);
    expect(parsed.access_token).toBe('secret-jwt-token-12345');
  });

  it('permite una migración suave si encuentra una sesión previa sin cifrar en AsyncStorage', async () => {
    const legacySession = JSON.stringify({
      access_token: 'legacy-unencrypted-token',
    });

    // Simulamos sesión previa en texto plano
    mockAsyncStorage['sb-session'] = legacySession;

    const retrieved = await store.getItem('sb-session');
    expect(retrieved).toBe(legacySession);
  });

  it('elimina la sesión y la clave de cifrado al hacer removeItem (logout)', async () => {
    await store.setItem('sb-session', 'test-data');
    expect(mockAsyncStorage['sb-session']).toBeDefined();
    expect(mockSecureStorage['zen_sec_k_sb-session']).toBeDefined();

    await store.removeItem('sb-session');

    expect(mockAsyncStorage['sb-session']).toBeUndefined();
    expect(mockSecureStorage['zen_sec_k_sb-session']).toBeUndefined();
  });
});
