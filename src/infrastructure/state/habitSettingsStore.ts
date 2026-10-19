/**
 * ZenMoney — HabitSettingsStore (Zustand + AsyncStorage)
 *
 * Administra el estado de configuración y preferencias del usuario para la funcionalidad
 * de Hábitos Atómicos, Safe-to-Spend y gamificación.
 * Permite activar o desactivar la funcionalidad tanto de manera global como por categoría.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HabitSettings } from '../../domain/entities/AtomicHabit';

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

export const defaultHabitSettings: HabitSettings = {
  isGloballyEnabled: true,
  notificationsEnabled: true,
  weekendWeightEnabled: true,
  weekendWeightRatio: 1.5,
  microSweepEnabled: false,
  targetSavingsGoalId: null,
  categoryOverrides: {},
};

export interface HabitSettingsState {
  settings: HabitSettings;
  setGloballyEnabled: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setWeekendWeightEnabled: (enabled: boolean) => void;
  setWeekendWeightRatio: (ratio: number) => void;
  setMicroSweepEnabled: (enabled: boolean) => void;
  setTargetSavingsGoalId: (goalId: string | null) => void;
  setCategoryEnabled: (categoryId: string, enabled: boolean) => void;
  setAllCategories: (enabled: boolean, categoryIds: string[]) => void;
  isCategoryActive: (categoryId: string) => boolean;
  resetDefaults: () => void;
}

export const useHabitSettingsStore = create<HabitSettingsState>()(
  persist(
    (set, get) => ({
      settings: { ...defaultHabitSettings },

      setGloballyEnabled: (enabled: boolean) => {
        set((state) => ({
          settings: {
            ...state.settings,
            isGloballyEnabled: enabled,
          },
        }));
      },

      setNotificationsEnabled: (enabled: boolean) => {
        set((state) => ({
          settings: {
            ...state.settings,
            notificationsEnabled: enabled,
          },
        }));
      },

      setWeekendWeightEnabled: (enabled: boolean) => {
        set((state) => ({
          settings: {
            ...state.settings,
            weekendWeightEnabled: enabled,
          },
        }));
      },

      setWeekendWeightRatio: (ratio: number) => {
        set((state) => ({
          settings: {
            ...state.settings,
            weekendWeightRatio: Math.max(1.0, ratio),
          },
        }));
      },

      setMicroSweepEnabled: (enabled: boolean) => {
        set((state) => ({
          settings: {
            ...state.settings,
            microSweepEnabled: enabled,
          },
        }));
      },

      setTargetSavingsGoalId: (goalId: string | null) => {
        set((state) => ({
          settings: {
            ...state.settings,
            targetSavingsGoalId: goalId,
          },
        }));
      },

      setCategoryEnabled: (categoryId: string, enabled: boolean) => {
        set((state) => ({
          settings: {
            ...state.settings,
            categoryOverrides: {
              ...state.settings.categoryOverrides,
              [categoryId]: enabled,
            },
          },
        }));
      },

      setAllCategories: (enabled: boolean, categoryIds: string[]) => {
        const overrides: Record<string, boolean> = {};
        for (const id of categoryIds) {
          overrides[id] = enabled;
        }
        set((state) => ({
          settings: {
            ...state.settings,
            categoryOverrides: {
              ...state.settings.categoryOverrides,
              ...overrides,
            },
          },
        }));
      },

      isCategoryActive: (categoryId: string) => {
        const { settings } = get();
        if (!settings.isGloballyEnabled) return false;
        if (categoryId in settings.categoryOverrides) {
          return settings.categoryOverrides[categoryId];
        }
        return true;
      },

      resetDefaults: () => {
        set({ settings: { ...defaultHabitSettings } });
      },
    }),
    {
      name: 'zenmoney:habit_settings_storage',
      storage: createJSONStorage(() => safeStorage),
    }
  )
);
