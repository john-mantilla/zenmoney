/**
 * ZenMoney — Habit Store (Zustand + AsyncStorage)
 *
 * Administra el ciclo de vida de los hábitos financieros activos (ZenHabits),
 * el registro en 1 toque y la adaptación continua de montos promedio.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HabitPattern, CreateHabitPatternInput } from '@/src/domain/entities/HabitPattern';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { useAccountPreferenceStore } from './accountPreferenceStore';

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

interface HabitState {
  habits: HabitPattern[];
  dismissedDates: Record<string, string>; // habitId -> 'YYYY-MM-DD'
  addHabit: (input: CreateHabitPatternInput) => HabitPattern;
  updateHabit: (id: string, updates: Partial<HabitPattern>) => void;
  removeHabit: (id: string) => void;
  toggleHabit: (id: string) => void;
  confirmHabit: (
    habitId: string,
    customAmount?: number,
    customAccountId?: string
  ) => Promise<{ success: boolean; transactionId?: string }>;
  skipHabit: (habitId: string) => void;
  isDismissedToday: (habitId: string) => boolean;
}

export const useHabitStore = create<HabitState>()(
  persist(
    (set, get) => ({
      habits: [],
      dismissedDates: {},

      addHabit: (input) => {
        const id =
          input.id ||
          `habit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newHabit: HabitPattern = {
          id,
          title: input.title,
          dayOfWeek: input.dayOfWeek,
          timePrompt: input.timePrompt || '21:00',
          defaultAccountId: input.defaultAccountId,
          defaultCategoryId: input.defaultCategoryId,
          merchantName: input.merchantName || null,
          estimatedAmount: Math.round(input.estimatedAmount),
          confidenceScore: input.confidenceScore ?? 0.8,
          isActive: true,
          consecutiveSkips: 0,
          icon: input.icon || 'repeat',
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          habits: [...state.habits.filter((h) => h.id !== id), newHabit],
        }));

        return newHabit;
      },

      updateHabit: (id, updates) => {
        set((state) => ({
          habits: state.habits.map((h) =>
            h.id === id ? { ...h, ...updates } : h
          ),
        }));
      },

      removeHabit: (id) => {
        set((state) => ({
          habits: state.habits.filter((h) => h.id !== id),
        }));
      },

      toggleHabit: (id) => {
        set((state) => ({
          habits: state.habits.map((h) =>
            h.id === id ? { ...h, ...h.isActive, isActive: !h.isActive } : h
          ),
        }));
      },

      confirmHabit: async (habitId, customAmount, customAccountId) => {
        const habit = get().habits.find((h) => h.id === habitId);
        if (!habit) return { success: false };

        const todayStr = new Date().toISOString().split('T')[0];
        const finalAmount = customAmount !== undefined ? customAmount : habit.estimatedAmount;
        const targetAccountId =
          customAccountId ||
          habit.defaultAccountId ||
          useAccountPreferenceStore.getState().defaultAccountId ||
          useAccountPreferenceStore.getState().lastUsedAccountId ||
          '';

        try {
          const txRepo = new HybridTransactionRepository();
          const createdTx = await txRepo.create({
            type: 'expense',
            amount: finalAmount,
            accountId: targetAccountId,
            categoryId: habit.defaultCategoryId,
            merchantName: habit.merchantName || undefined,
            description: habit.title,
            transactionDate: todayStr,
            status: 'confirmed',
            inputMethod: 'manual',
          });

          // Actualizar última cuenta utilizada
          if (createdTx.accountId) {
            useAccountPreferenceStore.getState().setLastUsedAccountId(createdTx.accountId);
          }

          // Actualizar media móvil exponencial del hábito: EMA = 0.7*prev + 0.3*actual
          const updatedEstimatedAmount = Math.round(
            0.7 * habit.estimatedAmount + 0.3 * finalAmount
          );

          set((state) => ({
            habits: state.habits.map((h) =>
              h.id === habitId
                ? {
                    ...h,
                    estimatedAmount: updatedEstimatedAmount,
                    lastConfirmedDate: todayStr,
                    consecutiveSkips: 0,
                  }
                : h
            ),
          }));

          return { success: true, transactionId: createdTx.id };
        } catch (err) {
          console.error('[ZenHabits] Error confirming habit expense:', err);
          return { success: false };
        }
      },

      skipHabit: (habitId) => {
        const todayStr = new Date().toISOString().split('T')[0];
        set((state) => {
          const habit = state.habits.find((h) => h.id === habitId);
          const consecutiveSkips = (habit?.consecutiveSkips || 0) + 1;

          return {
            dismissedDates: {
              ...state.dismissedDates,
              [habitId]: todayStr,
            },
            habits: state.habits.map((h) =>
              h.id === habitId ? { ...h, consecutiveSkips } : h
            ),
          };
        });
      },

      isDismissedToday: (habitId) => {
        const todayStr = new Date().toISOString().split('T')[0];
        return get().dismissedDates[habitId] === todayStr;
      },
    }),
    {
      name: 'zenmoney_habits_store',
      storage: createJSONStorage(() => safeStorage),
    }
  )
);
