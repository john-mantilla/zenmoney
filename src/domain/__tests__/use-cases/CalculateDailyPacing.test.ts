import { describe, it, expect } from 'vitest';
import { CalculateDailyPacing } from '../../usecases/CalculateDailyPacing';
import { Budget } from '../../entities/Budget';

describe('CalculateDailyPacing UseCase', () => {
  const mockBudget: Budget = {
    id: 'budget-restaurants-123',
    familyGroupId: 'family-1',
    categoryId: 'cat-restaurants',
    amountLimit: 600000,
    year: 2026,
    month: 10,
    scope: 'individual',
    ownerUserId: 'user-john',
    createdAt: '2026-10-01T00:00:00Z',
  };

  it('calcula DailyPacing correctamente a mitad de mes sin gasto previo en el día', () => {
    // 15 de Octubre: restan 17 días
    const date = new Date(2026, 9, 15);
    const result = CalculateDailyPacing.execute({
      budget: mockBudget,
      monthlySpent: 260000, // remanente: 340.000
      spentToday: 0,
      currentDate: date,
    });

    // 340.000 / 17 = 20.000
    expect(result.budgetId).toBe('budget-restaurants-123');
    expect(result.remainingBudget).toBe(340000);
    expect(result.daysRemainingInMonth).toBe(17);
    expect(result.dailySafeToSpend).toBe(20000);
    expect(result.spentToday).toBe(0);
    expect(result.remainingToday).toBe(20000);
    expect(result.isGreenDay).toBe(true);
  });

  it('actualiza el remainingToday al registrar un gasto en la jornada manteniendo isGreenDay si no sobrepasa', () => {
    const date = new Date(2026, 9, 15);
    const result = CalculateDailyPacing.execute({
      budget: mockBudget,
      monthlySpent: 275000,
      spentToday: 15000, // Safe to spend es 20.000 aprox (325.000 / 17 = 19.118)
      currentDate: date,
    });

    expect(result.spentToday).toBe(15000);
    expect(result.remainingToday).toBeGreaterThan(0);
    expect(result.isGreenDay).toBe(true);
  });

  it('marca isGreenDay como false si el gasto de hoy supera el Safe-to-Spend', () => {
    const date = new Date(2026, 9, 15);
    const result = CalculateDailyPacing.execute({
      budget: mockBudget,
      monthlySpent: 300000,
      spentToday: 45000, // Gasto de 45.000 cuando el safe to spend diario era ~17.647
      currentDate: date,
    });

    expect(result.remainingToday).toBe(0);
    expect(result.isGreenDay).toBe(false);
  });

  it('deshabilita el cálculo diario y fija Safe-to-Spend en 0 si el feature toggle global está apagado', () => {
    const date = new Date(2026, 9, 15);
    const result = CalculateDailyPacing.execute({
      budget: mockBudget,
      monthlySpent: 100000,
      spentToday: 0,
      currentDate: date,
      settings: {
        isGloballyEnabled: false,
      },
    });

    expect(result.dailySafeToSpend).toBe(0);
    expect(result.isGreenDay).toBe(false);
  });

  it('deshabilita el cálculo si la categoría específica está excluida en categoryOverrides', () => {
    const date = new Date(2026, 9, 15);
    const result = CalculateDailyPacing.execute({
      budget: mockBudget,
      monthlySpent: 100000,
      spentToday: 0,
      currentDate: date,
      settings: {
        isGloballyEnabled: true,
        categoryOverrides: {
          'cat-restaurants': false, // deshabilitada para esta categoría
        },
      },
    });

    expect(result.dailySafeToSpend).toBe(0);
    expect(result.isGreenDay).toBe(false);
  });
});
