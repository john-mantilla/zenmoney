/**
 * ZenMoney — EvaluateHabitNudge UseCase (ZenHabits)
 *
 * Determina si debe dispararse un recordatorio proactivo para un hábito específico hoy,
 * implementando la Regla de Silencio Inteligente y el horario acordado ("al terminar el plan").
 */
import { HabitPattern } from '../entities/HabitPattern';
import { Transaction } from '../entities/Transaction';

export interface EvaluateHabitNudgeResult {
  shouldNudge: boolean;
  reason?: 'inactive' | 'wrong_day' | 'already_confirmed_today' | 'dismissed_today' | 'too_early' | 'silenced_by_existing_transaction' | 'ready';
}

export class EvaluateHabitNudge {
  /**
   * Evalúa si un hábito debe activar su recordatorio interactivo.
   *
   * @param habit Hábito activo configurado
   * @param todayExpenses Gastos ya registrados hoy en la aplicación
   * @param currentDate Fecha y hora actual (para testing o ejecución en tiempo real)
   * @param dismissedToday Si el usuario ya descartó este recordatorio en la fecha de hoy
   * @param ignoreTimeWindow Si se evalúa en UI sin esperar estrictamente las 21:00 (ej. pruebas o panel)
   */
  static execute(
    habit: HabitPattern,
    todayExpenses: Transaction[],
    currentDate: Date = new Date(),
    dismissedToday = false,
    ignoreTimeWindow = false
  ): EvaluateHabitNudgeResult {
    if (!habit.isActive) {
      return { shouldNudge: false, reason: 'inactive' };
    }

    const currentDayOfWeek = currentDate.getDay();
    if (currentDayOfWeek !== habit.dayOfWeek) {
      return { shouldNudge: false, reason: 'wrong_day' };
    }

    const todayStr = currentDate.toISOString().split('T')[0];
    if (habit.lastConfirmedDate === todayStr) {
      return { shouldNudge: false, reason: 'already_confirmed_today' };
    }

    if (dismissedToday) {
      return { shouldNudge: false, reason: 'dismissed_today' };
    }

    // Regla de Silencio Inteligente:
    // Si ya existe un gasto hoy en el mismo comercio o categoría asociada,
    // se asume que el usuario ya registró el plan y NO se envía alerta redundante.
    const merchantLower = (habit.merchantName || '').toLowerCase().trim();
    const hasMatchingExpenseToday = todayExpenses.some((tx) => {
      if (tx.type !== 'expense') return false;

      // Coincidencia por comercio
      if (merchantLower && tx.merchantName) {
        const txMerchant = tx.merchantName.toLowerCase().trim();
        if (txMerchant.includes(merchantLower) || merchantLower.includes(txMerchant)) {
          return true;
        }
      }

      // Coincidencia por descripción si contiene el nombre
      if (merchantLower && tx.description) {
        if (tx.description.toLowerCase().includes(merchantLower)) {
          return true;
        }
      }

      // Coincidencia por categoría + monto aproximado (± 35%)
      if (habit.defaultCategoryId && tx.categoryId === habit.defaultCategoryId) {
        const diff = Math.abs(tx.amount - habit.estimatedAmount);
        if (diff <= habit.estimatedAmount * 0.35) {
          return true;
        }
      }

      return false;
    });

    if (hasMatchingExpenseToday) {
      return { shouldNudge: false, reason: 'silenced_by_existing_transaction' };
    }

    // Regla de Horario ("Al terminar el plan" — 21:00 / 9:00 PM)
    if (!ignoreTimeWindow) {
      const [promptHour, promptMinute] = (habit.timePrompt || '21:00')
        .split(':')
        .map((num) => parseInt(num, 10));

      const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
      const targetMinutes = promptHour * 60 + (promptMinute || 0);

      // Si aún no son las 21:00 (o el horario del hábito), esperar a que termine el plan
      if (currentMinutes < targetMinutes) {
        return { shouldNudge: false, reason: 'too_early' };
      }
    }

    return { shouldNudge: true, reason: 'ready' };
  }

  execute(
    habit: HabitPattern,
    todayExpenses: Transaction[],
    currentDate: Date = new Date(),
    dismissedToday = false,
    ignoreTimeWindow = false
  ): EvaluateHabitNudgeResult {
    return EvaluateHabitNudge.execute(
      habit,
      todayExpenses,
      currentDate,
      dismissedToday,
      ignoreTimeWindow
    );
  }
}
