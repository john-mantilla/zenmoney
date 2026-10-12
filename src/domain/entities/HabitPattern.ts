/**
 * ZenMoney — Entidad HabitPattern (ZenHabits)
 *
 * Representa un hábito o rutina de consumo recurrente (por día de la semana o contexto),
 * estrictamente diferenciado de una factura contractual o suscripción formal.
 */

export interface HabitPattern {
  id: string;
  title: string;
  dayOfWeek: number; // 0 = Domingo, 1 = Lunes, 2 = Martes, 3 = Miércoles, 4 = Jueves, 5 = Viernes, 6 = Sábado
  timePrompt: string; // '21:00' (en la noche al terminar el plan)
  defaultAccountId?: string;
  defaultCategoryId?: string;
  merchantName?: string | null;
  estimatedAmount: number;
  confidenceScore: number; // 0 a 1
  isActive: boolean;
  lastConfirmedDate?: string | null; // 'YYYY-MM-DD'
  consecutiveSkips: number;
  icon?: string;
  createdAt: string;
}

export interface CreateHabitPatternInput {
  id?: string;
  title: string;
  dayOfWeek: number;
  timePrompt?: string;
  defaultAccountId?: string;
  defaultCategoryId?: string;
  merchantName?: string | null;
  estimatedAmount: number;
  icon?: string;
  confidenceScore?: number;
}
