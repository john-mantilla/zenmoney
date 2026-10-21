/**
 * ZenMoney — Account Customization Store (Zustand + AsyncStorage)
 *
 * Almacena los colores e íconos personalizados elegidos por el usuario por id de cuenta,
 * permitiendo personalización 100% persistente en local (Móvil y Web) sin requerir
 * columnas adicionales en Supabase.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AccountCustomizationState {
  customColors: Record<string, string>;
  customIcons: Record<string, string>;
  setCustomColor: (accountId: string, color: string) => void;
  setCustomIcon: (accountId: string, icon: string) => void;
  resetCustomization: (accountId: string) => void;
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

export const useAccountCustomizationStore = create<AccountCustomizationState>()(
  persist(
    (set) => ({
      customColors: {},
      customIcons: {},
      setCustomColor: (accountId, color) =>
        set((state) => ({
          customColors: { ...state.customColors, [accountId]: color },
        })),
      setCustomIcon: (accountId, icon) =>
        set((state) => ({
          customIcons: { ...state.customIcons, [accountId]: icon },
        })),
      resetCustomization: (accountId) =>
        set((state) => {
          const newColors = { ...state.customColors };
          const newIcons = { ...state.customIcons };
          delete newColors[accountId];
          delete newIcons[accountId];
          return { customColors: newColors, customIcons: newIcons };
        }),
    }),
    {
      name: 'zenmoney_account_customizations',
      storage: createJSONStorage(() => safeStorage),
    }
  )
);
