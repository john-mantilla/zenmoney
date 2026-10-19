/**
 * ZenMoney — StreakTrackerService
 *
 * Calcula y mantiene las rachas de disciplina conductual (HabitStreaks).
 * Aplica el principio de James Clear: "Nunca falles dos veces seguidas".
 * Premia la consistencia y facilita reanudar la racha inmediatamente sin culpa.
 */
import { HabitStreak } from '../entities/AtomicHabit';

export class StreakTrackerService {
  /**
   * Calcula la diferencia en días naturales entre dos fechas en formato 'YYYY-MM-DD'.
   */
  static getDaysDifference(dateStr1: string, dateStr2: string): number {
    const d1 = new Date(dateStr1 + 'T00:00:00Z');
    const d2 = new Date(dateStr2 + 'T00:00:00Z');
    const diffMs = Math.abs(d2.getTime() - d1.getTime());
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Actualiza el estado de la racha ante un nuevo día con cumplimiento.
   */
  static recordSuccessDay(currentStreak: HabitStreak, eventDate: string): HabitStreak {
    const { currentStreakDays, bestStreakDays, lastActiveDate, greenDaysCount } = currentStreak;

    // Si ya se registró el éxito hoy, es idempotente
    if (lastActiveDate === eventDate) {
      return currentStreak;
    }

    let newCurrentStreak = 1;

    if (lastActiveDate) {
      const diff = this.getDaysDifference(lastActiveDate, eventDate);
      if (diff === 1) {
        // Día consecutivo exacto (ayer y hoy)
        newCurrentStreak = currentStreakDays + 1;
      } else if (diff === 0) {
        newCurrentStreak = currentStreakDays;
      } else {
        // Hubo una pausa en días anteriores: reanudación inmediata a 1
        newCurrentStreak = 1;
      }
    }

    const newBest = Math.max(bestStreakDays, newCurrentStreak);

    return {
      habitId: currentStreak.habitId,
      currentStreakDays: newCurrentStreak,
      bestStreakDays: newBest,
      lastActiveDate: eventDate,
      greenDaysCount: greenDaysCount + 1,
    };
  }

  /**
   * Maneja un día sin cumplimiento sin borrar el récord histórico.
   */
  static recordMissedDay(currentStreak: HabitStreak): HabitStreak {
    return {
      ...currentStreak,
      currentStreakDays: 0,
    };
  }
}
