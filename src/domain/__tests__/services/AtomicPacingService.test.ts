import { describe, it, expect } from 'vitest';
import { AtomicPacingService } from '../../services/AtomicPacingService';

describe('AtomicPacingService', () => {
  it('desglosa correctamente los días restantes en un mes de 31 días (ej. 15 de Octubre)', () => {
    // 15 de octubre de 2026 (Jueves)
    const testDate = new Date(2026, 9, 15);
    const breakdown = AtomicPacingService.getDaysBreakdown(testDate);

    expect(breakdown.totalDaysInMonth).toBe(31);
    expect(breakdown.currentDay).toBe(15);
    expect(breakdown.daysRemainingIncludingToday).toBe(17); // 31 - 15 + 1
    expect(breakdown.remainingWeekdays + breakdown.remainingWeekendDays).toBe(17);
    expect(breakdown.isTodayWeekend).toBe(false); // Jueves = weekday
  });

  it('identifica correctamente viernes, sábado y domingo como fin de semana de gasto', () => {
    const friday = new Date(2026, 9, 16); // Viernes
    const saturday = new Date(2026, 9, 17); // Sábado
    const sunday = new Date(2026, 9, 18); // Domingo
    const monday = new Date(2026, 9, 19); // Lunes

    expect(AtomicPacingService.isWeekendDay(friday.getDay())).toBe(true);
    expect(AtomicPacingService.isWeekendDay(saturday.getDay())).toBe(true);
    expect(AtomicPacingService.isWeekendDay(sunday.getDay())).toBe(true);
    expect(AtomicPacingService.isWeekendDay(monday.getDay())).toBe(false);
  });

  it('calcula Safe-to-Spend lineal dividiendo remanente entre días restantes', () => {
    // 15 de octubre: restan 17 días
    const testDate = new Date(2026, 9, 15);
    const monthlyLimit = 510000;
    const spentThisMonth = 0;

    const result = AtomicPacingService.calculateSafeToSpend(
      monthlyLimit,
      spentThisMonth,
      testDate,
      { enableWeekendWeight: false }
    );

    // 510.000 / 17 días = 30.000
    expect(result.dailySafeToSpend).toBe(30000);
    expect(result.daysRemaining).toBe(17);
    expect(result.remainingBudget).toBe(510000);
  });

  it('aplica ponderación de fin de semana asignando mayor disponible viernes a domingo', () => {
    // Viernes 16 de Octubre
    const friday = new Date(2026, 9, 16);
    const monday = new Date(2026, 9, 19);

    const monthlyLimit = 400000;
    const spent = 0;

    const fridayResult = AtomicPacingService.calculateSafeToSpend(
      monthlyLimit,
      spent,
      friday,
      { enableWeekendWeight: true, weekendWeightRatio: 1.5 }
    );

    const mondayResult = AtomicPacingService.calculateSafeToSpend(
      monthlyLimit,
      spent,
      monday,
      { enableWeekendWeight: true, weekendWeightRatio: 1.5 }
    );

    expect(fridayResult.isWeekend).toBe(true);
    expect(mondayResult.isWeekend).toBe(false);
    expect(fridayResult.dailySafeToSpend).toBeGreaterThan(mondayResult.dailySafeToSpend);
  });

  it('respeta el feature toggle retornando 0 cuando la funcionalidad está deshabilitada globalmente', () => {
    const testDate = new Date(2026, 9, 15);
    const result = AtomicPacingService.calculateSafeToSpend(
      500000,
      100000,
      testDate,
      { isGloballyEnabled: false }
    );

    expect(result.dailySafeToSpend).toBe(0);
    expect(result.remainingBudget).toBe(400000);
  });

  it('respeta el feature toggle granular por categoría retornando 0 si esa categoría está deshabilitada', () => {
    const testDate = new Date(2026, 9, 15);
    const result = AtomicPacingService.calculateSafeToSpend(
      500000,
      100000,
      testDate,
      { isGloballyEnabled: true, isCategoryEnabled: false }
    );

    expect(result.dailySafeToSpend).toBe(0);
  });

  it('evalúa correctamente los estados de ritmo de consumo (pacing status)', () => {
    // Día 15 de 30 (50% del mes)
    // Caso 1: Gastó 80% (acelerado)
    const accelerated = AtomicPacingService.evaluatePacingStatus(80000, 100000, 15, 30);
    expect(accelerated.pacingStatus).toBe('accelerated');

    // Caso 2: Gastó 30% (ahead / conservador)
    const ahead = AtomicPacingService.evaluatePacingStatus(30000, 100000, 15, 30);
    expect(ahead.pacingStatus).toBe('ahead');

    // Caso 3: Gastó 50% (on_track)
    const onTrack = AtomicPacingService.evaluatePacingStatus(50000, 100000, 15, 30);
    expect(onTrack.pacingStatus).toBe('on_track');

    // Caso 4: Gastó 100% o más (exhausted)
    const exhausted = AtomicPacingService.evaluatePacingStatus(100000, 100000, 15, 30);
    expect(exhausted.pacingStatus).toBe('exhausted');
  });

  it('maneja casos borde: último día del mes y presupuesto en cero', () => {
    // 31 de Octubre (último día)
    const lastDay = new Date(2026, 9, 31);
    const resultLastDay = AtomicPacingService.calculateSafeToSpend(
      100000,
      70000,
      lastDay
    );

    expect(resultLastDay.daysRemaining).toBe(1);
    expect(resultLastDay.dailySafeToSpend).toBe(30000);

    // Presupuesto completamente consumido
    const resultExhausted = AtomicPacingService.calculateSafeToSpend(
      100000,
      110000,
      lastDay
    );

    expect(resultExhausted.dailySafeToSpend).toBe(0);
    expect(resultExhausted.remainingBudget).toBe(0);
    expect(resultExhausted.pacingStatus).toBe('exhausted');
  });
});
