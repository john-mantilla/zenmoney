/**
 * ZenMoney — Account Preference Store (Zustand + AsyncStorage)
 *
 * Administra de forma unificada la cuenta principal (favorita) y la última
 * cuenta utilizada para transacciones, garantizando una selección predeterminada
 * coherente en todas las pantallas y flujos de la aplicación.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AccountPreferenceState {
  defaultAccountId: string | null;
  lastUsedAccountId: string | null;
  setDefaultAccountId: (id: string | null) => void;
  setLastUsedAccountId: (id: string) => void;
  getPreferredAccountId: (
    accounts: { id: string; isActive?: boolean; type?: string }[],
    explicitId?: string | null
  ) => string;
}

// Storage seguro para compatibilidad universal (Móvil, Web y Vitest/Node)
const memoryStorage = new Map<string, string>();
const safeStorage = {
  getItem: async (name: string) => {
    try {
      if (typeof window === 'undefined' && typeof process !== 'undefined') {
        return memoryStorage.get(name) ?? null;
      }
      return await AsyncStorage.getItem(name);
    } catch {
      return memoryStorage.get(name) ?? null;
    }
  },
  setItem: async (name: string, value: string) => {
    try {
      if (typeof window === 'undefined' && typeof process !== 'undefined') {
        memoryStorage.set(name, value);
        return;
      }
      await AsyncStorage.setItem(name, value);
    } catch {
      memoryStorage.set(name, value);
    }
  },
  removeItem: async (name: string) => {
    try {
      if (typeof window === 'undefined' && typeof process !== 'undefined') {
        memoryStorage.delete(name);
        return;
      }
      await AsyncStorage.removeItem(name);
    } catch {
      memoryStorage.delete(name);
    }
  },
};

export const useAccountPreferenceStore = create<AccountPreferenceState>()(
  persist(
    (set, get) => ({
      defaultAccountId: null,
      lastUsedAccountId: null,
      setDefaultAccountId: (id) => set({ defaultAccountId: id }),
      setLastUsedAccountId: (id) => set({ lastUsedAccountId: id }),
      getPreferredAccountId: (accounts, explicitId) => {
        if (!accounts || accounts.length === 0) return '';

        const active = accounts.filter((a) => a.isActive !== false);
        const pool = active.length > 0 ? active : accounts;

        // 1. Si se especificó explícitamente y existe en las cuentas activas
        if (explicitId && pool.some((a) => a.id === explicitId)) {
          return explicitId;
        }

        const state = get();

        // 2. Si el usuario marcó una cuenta principal (favorita)
        if (state.defaultAccountId && pool.some((a) => a.id === state.defaultAccountId)) {
          return state.defaultAccountId;
        }

        // 3. Si hay una última cuenta utilizada
        if (state.lastUsedAccountId && pool.some((a) => a.id === state.lastUsedAccountId)) {
          return state.lastUsedAccountId;
        }

        // 4. Fallback inteligente: preferir cuentas bancarias o de efectivo antes que crédito/préstamos
        const bankOrCash = pool.find((a) => a.type === 'bank' || a.type === 'cash');
        if (bankOrCash) {
          return bankOrCash.id;
        }

        // 5. Fallback final: primer elemento disponible
        return pool[0]?.id || '';
      },
    }),
    {
      name: 'zenmoney_account_preferences',
      storage: createJSONStorage(() => safeStorage),
    }
  )
);
