import { describe, it, expect } from 'vitest';
import { EvaluateDayStatus } from '../../usecases/EvaluateDayStatus';
import { StreakTrackerService } from '../../services/StreakTrackerService';
import { ExecuteMicroSweep } from '../../usecases/ExecuteMicroSweep';
import { DailyPacing, HabitStreak, HabitSettings } from '../../entities/AtomicHabit';

describe('Gamification Engine (Green Days, Streaks & Micro-Sweeps)', () => {
  const defaultSettings: HabitSettings = {
    isGloballyEnabled: true,
    notificationsEnabled: true,
    weekendWeightEnabled: false,
    weekendWeightRatio: 1.5,
    microSweepEnabled: true,
    targetSavingsGoalId: 'goal-vacations',
    categoryOverrides: {},
  };

  describe('EvaluateDayStatus', () => {
    it('otorga Día en Verde y calcula el excedente diario cuando el gasto no supera el Safe-to-Spend', () => {
      const mockPacings: DailyPacing[] = [
        {
          budgetId: 'b-1',
          categoryId: 'cat-food',
          date: '2026-10-18',
          monthlyLimit: 600000,
          spentThisMonth: 100000,
          remainingBudget: 500000,
          daysRemainingInMonth: 14,
          dailySafeToSpend: 35000,
          spentToday: 20000, // Menor al safe to spend
          remainingToday: 15000,
          isWeekend: true,
          pacingStatus: 'on_track',
          isGreenDay: true,
        },
      ];

      const evaluation = EvaluateDayStatus.execute('2026-10-18', mockPacings, defaultSettings);

      expect(evaluation.isGreenDay).toBe(true);
      expect(evaluation.totalDailySafe).toBe(35000);
      expect(evaluation.totalSpentToday).toBe(20000);
      expect(evaluation.dailySurplus).toBe(15000);
      expect(evaluation.overspentAmount).toBe(0);
      expect(evaluation.encouragementMessage).toContain('Día en Verde');
    });

    it('emite mensaje de aliento constructivo sin culpa en caso de sobregiro diario', () => {
      const mockPacings: DailyPacing[] = [
        {
          budgetId: 'b-1',
          categoryId: 'cat-food',
          date: '2026-10-18',
          monthlyLimit: 600000,
          spentThisMonth: 100000,
          remainingBudget: 500000,
          daysRemainingInMonth: 14,
          dailySafeToSpend: 35000,
          spentToday: 50000, // Superó la cuota
          remainingToday: 0,
          isWeekend: true,
          pacingStatus: 'on_track',
          isGreenDay: false,
        },
      ];

      const evaluation = EvaluateDayStatus.execute('2026-10-18', mockPacings, defaultSettings);

      expect(evaluation.isGreenDay).toBe(false);
      expect(evaluation.dailySurplus).toBe(0);
      expect(evaluation.overspentAmount).toBe(15000);
      expect(evaluation.encouragementMessage).toContain('Un día con más movimiento de lo previsto es normal');
    });
  });

  describe('StreakTrackerService', () => {
    it('incrementa la racha ante días consecutivos y actualiza el récord personal', () => {
      const initialStreak: HabitStreak = {
        habitId: 'habit-1',
        currentStreakDays: 2,
        bestStreakDays: 2,
        lastActiveDate: '2026-10-17',
        greenDaysCount: 5,
      };

      const updated = StreakTrackerService.recordSuccessDay(initialStreak, '2026-10-18');

      expect(updated.currentStreakDays).toBe(3);
      expect(updated.bestStreakDays).toBe(3);
      expect(updated.greenDaysCount).toBe(6);
      expect(updated.lastActiveDate).toBe('2026-10-18');
    });

    it('reinicia a 1 la racha si hubo una interrupción de más de un día sin castigar el récord histórico', () => {
      const initialStreak: HabitStreak = {
        habitId: 'habit-1',
        currentStreakDays: 5,
        bestStreakDays: 10,
        lastActiveDate: '2026-10-10', // 8 días atrás
        greenDaysCount: 15,
      };

      const updated = StreakTrackerService.recordSuccessDay(initialStreak, '2026-10-18');

      expect(updated.currentStreakDays).toBe(1);
      expect(updated.bestStreakDays).toBe(10); // Récord intacto
      expect(updated.greenDaysCount).toBe(16);
    });
  });

  describe('ExecuteMicroSweep', () => {
    it('ejecuta con éxito el barrido de excedente diario hacia una meta de ahorro', () => {
      const result = ExecuteMicroSweep.execute({
        dailySurplus: 15000,
        targetSavingsGoalId: 'goal-vacations',
        savingsGoalTitle: 'Fondo de Vacaciones',
        date: '2026-10-18',
      });

      expect(result.sweptAmount).toBe(15000);
      expect(result.targetSavingsGoalId).toBe('goal-vacations');
      expect(result.celebrationMessage).toContain('15.000');
      expect(result.celebrationMessage).toContain('Fondo de Vacaciones');
    });

    it('falla si el excedente es cero o negativo', () => {
      expect(() =>
        ExecuteMicroSweep.execute({
          dailySurplus: 0,
          targetSavingsGoalId: 'goal-1',
          savingsGoalTitle: 'Ahorro',
        })
      ).toThrow('No hay excedente diario disponible para realizar el barrido de ahorro');
    });
  });
});
