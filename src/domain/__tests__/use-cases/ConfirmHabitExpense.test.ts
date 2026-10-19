import { describe, it, expect } from 'vitest';
import { ConfirmHabitExpense } from '../../usecases/ConfirmHabitExpense';
import { AtomicHabit } from '../../entities/AtomicHabit';

describe('ConfirmHabitExpense UseCase', () => {
  const mockHabit: AtomicHabit = {
    id: 'habit-coffee-1',
    budgetId: 'budget-cafes',
    categoryId: 'cat-cafes',
    title: 'Café de especialidad',
    type: 'cap_per_occasion',
    ruleConfig: {
      maxCapPerOccasion: 12000,
    },
    suggestedActionAmount: 10000,
    defaultAccountId: 'acc-bancolombia',
    merchantName: 'Café Juan Valdez',
    isEnabled: true,
    createdAt: '2026-10-01T00:00:00Z',
  };

  it('registra en 1 toque usando el monto sugerido y la cuenta predeterminada', () => {
    const result = ConfirmHabitExpense.execute({
      habit: mockHabit,
      familyGroupId: 'family-1',
      userId: 'user-1',
      date: '2026-10-18',
    });

    expect(result.transaction.amount).toBe(10000);
    expect(result.transaction.accountId).toBe('acc-bancolombia');
    expect(result.transaction.categoryId).toBe('cat-cafes');
    expect(result.transaction.type).toBe('expense');
    expect(result.transaction.merchantName).toBe('Café Juan Valdez');
    expect(result.habitLog.status).toBe('completed');
    expect(result.habitLog.amountSpent).toBe(10000);
  });

  it('permite sobrescribir el monto y detecta sobregiro respecto al tope si aplica', () => {
    // Gastó 15.000 cuando el tope era 12.000
    const result = ConfirmHabitExpense.execute({
      habit: mockHabit,
      amount: 15000,
      familyGroupId: 'family-1',
      userId: 'user-1',
      date: '2026-10-18',
    });

    expect(result.transaction.amount).toBe(15000);
    expect(result.habitLog.status).toBe('overspent');
  });

  it('falla si no hay cuenta especificada ni por defecto', () => {
    const habitWithoutAccount: AtomicHabit = {
      ...mockHabit,
      defaultAccountId: undefined,
    };

    expect(() =>
      ConfirmHabitExpense.execute({
        habit: habitWithoutAccount,
        familyGroupId: 'family-1',
        userId: 'user-1',
      })
    ).toThrow('Se requiere una cuenta válida para registrar el gasto del hábito');
  });
});
