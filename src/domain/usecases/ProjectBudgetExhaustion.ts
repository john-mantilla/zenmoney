/**
 * ZenMoney — Caso de Uso: ProjectBudgetExhaustion
 *
 * Proyecta si, al ritmo de gasto actual, un presupuesto específico se agotará
 * antes de que termine el mes — ej. "vas a superar el presupuesto de
 * restaurantes en 4 días".
 */

import { BudgetProgress } from '../entities/Budget';

export interface BudgetExhaustionProjection {
  willExceedBeforeMonthEnd: boolean;
  /** Días estimados hasta agotar el presupuesto, o null si no aplica. */
  daysUntilExceeded: number | null;
}

export class ProjectBudgetExhaustion {
  /**
   * @param progress - Progreso actual del presupuesto (CalculateBudgetProgress)
   * @param daysElapsedInMonth - Días transcurridos del mes (incluye hoy)
   * @param daysRemainingInMonth - Días que faltan para terminar el mes
   */
  execute(
    progress: BudgetProgress,
    daysElapsedInMonth: number,
    daysRemainingInMonth: number
  ): BudgetExhaustionProjection {
    // Ya excedido (lo cubre la alerta de 100%) o sin datos suficientes para proyectar
    if (progress.status === 'exceeded' || daysElapsedInMonth <= 0) {
      return { willExceedBeforeMonthEnd: false, daysUntilExceeded: null };
    }

    const dailyVelocity = progress.spent / daysElapsedInMonth;
    if (dailyVelocity <= 0) {
      return { willExceedBeforeMonthEnd: false, daysUntilExceeded: null };
    }

    const daysUntilExceeded = progress.remaining / dailyVelocity;
    const willExceedBeforeMonthEnd = daysUntilExceeded <= daysRemainingInMonth;

    return {
      willExceedBeforeMonthEnd,
      daysUntilExceeded: willExceedBeforeMonthEnd ? Math.max(1, Math.ceil(daysUntilExceeded)) : null,
    };
  }
}
