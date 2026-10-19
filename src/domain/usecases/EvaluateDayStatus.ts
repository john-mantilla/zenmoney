/**
 * ZenMoney — EvaluateDayStatus UseCase
 *
 * Evalúa el balance consolidado del día a las 23:59:59 o al cierre de jornada,
 * determinando si se alcanzó la distinción de "Día en Verde" y calculando el excedente
 * diario (Daily Surplus) para micro-ahorro, sin mensajes punitivos ante desvíos.
 */
import { DailyPacing, HabitSettings } from '../entities/AtomicHabit';

export interface DayStatusEvaluation {
  date: string;
  isGreenDay: boolean;
  totalDailySafe: number;
  totalSpentToday: number;
  dailySurplus: number;
  overspentAmount: number;
  encouragementMessage: string;
}

export class EvaluateDayStatus {
  static execute(
    date: string,
    pacings: DailyPacing[],
    settings: HabitSettings
  ): DayStatusEvaluation {
    if (!settings.isGloballyEnabled || pacings.length === 0) {
      return {
        date,
        isGreenDay: false,
        totalDailySafe: 0,
        totalSpentToday: 0,
        dailySurplus: 0,
        overspentAmount: 0,
        encouragementMessage: 'Funcionalidad de hábitos diarios desactivada.',
      };
    }

    // Filtrar solo categorías que no estén desactivadas en settings
    const activePacings = pacings.filter((p) => {
      if (p.categoryId in settings.categoryOverrides) {
        return settings.categoryOverrides[p.categoryId];
      }
      return true;
    });

    const totalDailySafe = activePacings.reduce((sum, p) => sum + p.dailySafeToSpend, 0);
    const totalSpentToday = activePacings.reduce((sum, p) => sum + p.spentToday, 0);

    const isGreenDay = totalDailySafe > 0 && totalSpentToday <= totalDailySafe;
    const dailySurplus = isGreenDay ? Math.max(0, totalDailySafe - totalSpentToday) : 0;
    const overspentAmount = isGreenDay ? 0 : Math.max(0, totalSpentToday - totalDailySafe);

    let encouragementMessage: string;

    if (isGreenDay) {
      if (totalSpentToday === 0) {
        encouragementMessage = '🌿 ¡Día impecable! Cero gasto discrecional hoy. Una victoria total para tus metas.';
      } else {
        encouragementMessage = `✨ ¡Día en Verde! Te mantuviste dentro de tu cuota diaria con un excedente de $${dailySurplus.toLocaleString('es-CO')}.`;
      }
    } else {
      encouragementMessage = '🌱 Un día con más movimiento de lo previsto es normal. Mañana tu disponible se recalculará automáticamente para mantener el rumbo.';
    }

    return {
      date,
      isGreenDay,
      totalDailySafe,
      totalSpentToday,
      dailySurplus,
      overspentAmount,
      encouragementMessage,
    };
  }
}
