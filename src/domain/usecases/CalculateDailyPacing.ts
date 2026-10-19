/**
 * ZenMoney — CalculateDailyPacing UseCase
 *
 * Calcula el disponible diario dinámico (Daily Safe-to-Spend) y el ritmo de consumo
 * para una categoría de presupuesto en la fecha actual, considerando la configuración
 * de preferencias y feature toggles del usuario.
 */
import { Budget } from '../entities/Budget';
import { DailyPacing, HabitSettings } from '../entities/AtomicHabit';
import { AtomicPacingService } from '../services/AtomicPacingService';

export interface CalculateDailyPacingInput {
  budget: Budget;
  monthlySpent: number;
  spentToday: number;
  currentDate?: Date;
  settings?: Partial<HabitSettings>;
}

export class CalculateDailyPacing {
  static execute(input: CalculateDailyPacingInput): DailyPacing {
    const {
      budget,
      monthlySpent,
      spentToday,
      currentDate = new Date(),
      settings = {},
    } = input;

    const dateStr = currentDate.toISOString().split('T')[0];

    const isGloballyEnabled = settings.isGloballyEnabled ?? true;
    const isCategoryEnabled =
      settings.categoryOverrides && budget.categoryId in settings.categoryOverrides
        ? settings.categoryOverrides[budget.categoryId]
        : true;

    const safeToSpendResult = AtomicPacingService.calculateSafeToSpend(
      budget.amountLimit,
      monthlySpent,
      currentDate,
      {
        enableWeekendWeight: settings.weekendWeightEnabled ?? false,
        weekendWeightRatio: settings.weekendWeightRatio ?? 1.5,
        isGloballyEnabled,
        isCategoryEnabled,
      }
    );

    const dailySafeToSpend = safeToSpendResult.dailySafeToSpend;
    const remainingToday = Math.max(0, dailySafeToSpend - Math.max(0, spentToday));
    const isGreenDay = isGloballyEnabled && isCategoryEnabled && spentToday <= dailySafeToSpend;

    return {
      budgetId: budget.id,
      categoryId: budget.categoryId,
      date: dateStr,
      monthlyLimit: budget.amountLimit,
      spentThisMonth: monthlySpent,
      remainingBudget: safeToSpendResult.remainingBudget,
      daysRemainingInMonth: safeToSpendResult.daysRemaining,
      dailySafeToSpend,
      spentToday,
      remainingToday,
      isWeekend: safeToSpendResult.isWeekend,
      pacingStatus: safeToSpendResult.pacingStatus,
      isGreenDay,
    };
  }
}
