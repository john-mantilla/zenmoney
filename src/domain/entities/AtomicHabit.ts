/**
 * ZenMoney — Entidad AtomicHabit y Estructuras de Hábitos Atómicos
 *
 * Convierte un presupuesto (meta mensual abstracta) en micro-comportamientos,
 * reglas accionables de bajo esfuerzo y disponible diario dinámico (Daily Safe-to-Spend).
 */

export type AtomicHabitType =
  | 'cap_per_occasion'        // Tope máximo por salida o consumo
  | 'no_spend_day'            // Día sin gasto discrecional programado
  | 'max_frequency_weekly'    // Límite de frecuencia semanal (ej. máximo 2 veces por semana)
  | 'daily_allowance';        // Límite estricto de gasto diario en la categoría

export type PacingStatus = 'ahead' | 'on_track' | 'accelerated' | 'exhausted';

export type CueTime = 'morning' | 'afternoon' | 'evening';

export interface AtomicHabitRuleConfig {
  maxCapPerOccasion?: number;
  noSpendDayOfWeek?: number; // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  maxTimesPerWeek?: number;
  dailyAllowance?: number;
}

export interface AtomicHabit {
  id: string;
  budgetId: string;
  categoryId: string;
  title: string;
  type: AtomicHabitType;
  ruleConfig: AtomicHabitRuleConfig;
  suggestedActionAmount?: number;
  defaultAccountId?: string;
  merchantName?: string | null;
  timeOfDayCue?: CueTime;
  cueHour?: number; // 8 para 08:00 AM, 21 para 21:00 PM
  isEnabled: boolean; // Toggle granular por hábito
  createdAt: string;
}

export interface CreateAtomicHabitInput {
  id?: string;
  budgetId: string;
  categoryId: string;
  title: string;
  type: AtomicHabitType;
  ruleConfig: AtomicHabitRuleConfig;
  suggestedActionAmount?: number;
  defaultAccountId?: string;
  merchantName?: string | null;
  timeOfDayCue?: CueTime;
  cueHour?: number;
  isEnabled?: boolean;
}

export interface DailyPacing {
  budgetId: string;
  categoryId: string;
  date: string; // YYYY-MM-DD
  monthlyLimit: number;
  spentThisMonth: number;
  remainingBudget: number;
  daysRemainingInMonth: number;
  dailySafeToSpend: number;
  spentToday: number;
  remainingToday: number;
  isWeekend: boolean;
  pacingStatus: PacingStatus;
  isGreenDay: boolean; // true si spentToday <= dailySafeToSpend
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  status: 'completed' | 'skipped' | 'overspent';
  amountSpent?: number;
  transactionId?: string;
  createdAt: string;
}

export interface HabitStreak {
  habitId: string;
  currentStreakDays: number;
  bestStreakDays: number;
  lastActiveDate?: string | null;
  greenDaysCount: number;
}

export interface HabitSettings {
  isGloballyEnabled: boolean; // Master Toggle ON/OFF
  notificationsEnabled: boolean;
  weekendWeightEnabled: boolean;
  weekendWeightRatio: number; // Por defecto 1.5
  microSweepEnabled: boolean;
  targetSavingsGoalId?: string | null;
  categoryOverrides: Record<string, boolean>; // categoryId -> activado/desactivado
}
