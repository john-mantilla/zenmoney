/**
 * ZenMoney — AtomicPacingService
 *
 * Motor matemático determinista para calcular el disponible diario seguro (Safe-to-Spend)
 * y el ritmo de consumo (pacing) a partir del presupuesto mensual remanente.
 */
import { PacingStatus } from '../entities/AtomicHabit';

export interface DaysRemainingBreakdown {
  totalDaysInMonth: number;
  currentDay: number;
  daysRemainingIncludingToday: number;
  remainingWeekdays: number;      // Lunes a Jueves
  remainingWeekendDays: number;   // Viernes a Domingo
  isTodayWeekend: boolean;
}

export interface CalculateSafeToSpendOptions {
  enableWeekendWeight?: boolean;
  weekendWeightRatio?: number;    // Por defecto 1.5
  isGloballyEnabled?: boolean;
  isCategoryEnabled?: boolean;
}

export interface SafeToSpendResult {
  dailySafeToSpend: number;
  isWeekend: boolean;
  daysRemaining: number;
  remainingBudget: number;
  pacingStatus: PacingStatus;
  burnRateRatio: number; // Porcentaje gastado vs Porcentaje de mes transcurrido
}

export class AtomicPacingService {
  /**
   * Determina si un día de la semana (0=Domingo a 6=Sábado) cuenta como fin de semana en gasto de ocio.
   * Viernes (5), Sábado (6) y Domingo (0) concentran el gasto recreativo familiar.
   */
  static isWeekendDay(dayOfWeek: number): boolean {
    return dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
  }

  /**
   * Desglosa los días restantes del mes a partir de una fecha dada.
   */
  static getDaysBreakdown(date: Date = new Date()): DaysRemainingBreakdown {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0 a 11
    const currentDay = date.getDate();

    // Último día del mes (día 0 del mes siguiente)
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const daysRemainingIncludingToday = Math.max(1, totalDaysInMonth - currentDay + 1);

    let remainingWeekdays = 0;
    let remainingWeekendDays = 0;

    for (let day = currentDay; day <= totalDaysInMonth; day++) {
      const checkDate = new Date(year, month, day);
      if (this.isWeekendDay(checkDate.getDay())) {
        remainingWeekendDays++;
      } else {
        remainingWeekdays++;
      }
    }

    const isTodayWeekend = this.isWeekendDay(date.getDay());

    return {
      totalDaysInMonth,
      currentDay,
      daysRemainingIncludingToday,
      remainingWeekdays,
      remainingWeekendDays,
      isTodayWeekend,
    };
  }

  /**
   * Calcula el estado de ritmo de gasto (PacingStatus).
   */
  static evaluatePacingStatus(
    spentThisMonth: number,
    monthlyLimit: number,
    currentDay: number,
    totalDaysInMonth: number
  ): { pacingStatus: PacingStatus; burnRateRatio: number } {
    if (monthlyLimit <= 0) {
      return { pacingStatus: 'exhausted', burnRateRatio: 0 };
    }

    const spentRatio = Math.max(0, spentThisMonth) / monthlyLimit;
    const timeRatio = Math.min(1, Math.max(0.01, currentDay / totalDaysInMonth));
    const burnRateRatio = Number((spentRatio / timeRatio).toFixed(2));

    if (spentThisMonth >= monthlyLimit) {
      return { pacingStatus: 'exhausted', burnRateRatio };
    }

    // Si ha consumido 15% más de lo que corresponde al tiempo transcurrido
    if (spentRatio > timeRatio + 0.15) {
      return { pacingStatus: 'accelerated', burnRateRatio };
    }

    // Si ha consumido 10% menos de lo proporcional
    if (spentRatio < timeRatio - 0.10) {
      return { pacingStatus: 'ahead', burnRateRatio };
    }

    return { pacingStatus: 'on_track', burnRateRatio };
  }

  /**
   * Calcula el monto diario recomendado (Safe-to-Spend) para hoy.
   */
  static calculateSafeToSpend(
    monthlyLimit: number,
    spentThisMonth: number,
    date: Date = new Date(),
    options: CalculateSafeToSpendOptions = {}
  ): SafeToSpendResult {
    const {
      enableWeekendWeight = false,
      weekendWeightRatio = 1.5,
      isGloballyEnabled = true,
      isCategoryEnabled = true,
    } = options;

    const breakdown = this.getDaysBreakdown(date);
    const remainingBudget = Math.max(0, monthlyLimit - spentThisMonth);

    const { pacingStatus, burnRateRatio } = this.evaluatePacingStatus(
      spentThisMonth,
      monthlyLimit,
      breakdown.currentDay,
      breakdown.totalDaysInMonth
    );

    // Si la funcionalidad está desactivada por el usuario (global o por categoría) o no hay presupuesto
    if (!isGloballyEnabled || !isCategoryEnabled || remainingBudget <= 0) {
      return {
        dailySafeToSpend: 0,
        isWeekend: breakdown.isTodayWeekend,
        daysRemaining: breakdown.daysRemainingIncludingToday,
        remainingBudget,
        pacingStatus,
        burnRateRatio,
      };
    }

    // Modo 1: Distribución lineal simple
    if (!enableWeekendWeight || weekendWeightRatio <= 1.0) {
      const dailySafe = Math.round(remainingBudget / breakdown.daysRemainingIncludingToday);
      return {
        dailySafeToSpend: dailySafe,
        isWeekend: breakdown.isTodayWeekend,
        daysRemaining: breakdown.daysRemainingIncludingToday,
        remainingBudget,
        pacingStatus,
        burnRateRatio,
      };
    }

    // Modo 2: Distribución ponderada (fin de semana con peso w)
    const w = Math.max(1.0, weekendWeightRatio);
    const weightedUnits = breakdown.remainingWeekdays + (w * breakdown.remainingWeekendDays);

    if (weightedUnits <= 0) {
      return {
        dailySafeToSpend: remainingBudget,
        isWeekend: breakdown.isTodayWeekend,
        daysRemaining: breakdown.daysRemainingIncludingToday,
        remainingBudget,
        pacingStatus,
        burnRateRatio,
      };
    }

    const baseDailyRate = remainingBudget / weightedUnits;
    const rawTodaySafe = breakdown.isTodayWeekend ? baseDailyRate * w : baseDailyRate;

    return {
      dailySafeToSpend: Math.round(rawTodaySafe),
      isWeekend: breakdown.isTodayWeekend,
      daysRemaining: breakdown.daysRemainingIncludingToday,
      remainingBudget,
      pacingStatus,
      burnRateRatio,
    };
  }
}
