import { describe, it, expect } from 'vitest';
import { CreateAtomicHabit } from '../../usecases/CreateAtomicHabit';

describe('CreateAtomicHabit UseCase', () => {
  it('crea exitosamente un hábito de tope por ocasión', () => {
    const habit = CreateAtomicHabit.execute({
      budgetId: 'budget-1',
      categoryId: 'cat-restaurants',
      title: 'Almuerzos de oficina',
      type: 'cap_per_occasion',
      ruleConfig: {
        maxCapPerOccasion: 25000,
      },
      timeOfDayCue: 'afternoon',
      cueHour: 13,
    });

    expect(habit.title).toBe('Almuerzos de oficina');
    expect(habit.type).toBe('cap_per_occasion');
    expect(habit.ruleConfig.maxCapPerOccasion).toBe(25000);
    expect(habit.suggestedActionAmount).toBe(25000);
    expect(habit.cueHour).toBe(13);
    expect(habit.isEnabled).toBe(true);
  });

  it('crea exitosamente un hábito de día sin gasto', () => {
    const habit = CreateAtomicHabit.execute({
      budgetId: 'budget-2',
      categoryId: 'cat-leisure',
      title: 'Martes de Cero Gasto',
      type: 'no_spend_day',
      ruleConfig: {
        noSpendDayOfWeek: 2, // Martes
      },
      timeOfDayCue: 'morning',
    });

    expect(habit.type).toBe('no_spend_day');
    expect(habit.ruleConfig.noSpendDayOfWeek).toBe(2);
    expect(habit.cueHour).toBe(8); // Por defecto 8 AM para mañana
  });

  it('rechaza títulos vacíos o sin presupuesto', () => {
    expect(() =>
      CreateAtomicHabit.execute({
        budgetId: 'budget-1',
        categoryId: 'cat-1',
        title: '   ',
        type: 'cap_per_occasion',
        ruleConfig: { maxCapPerOccasion: 10000 },
      })
    ).toThrow('El título del hábito atómico no puede estar vacío');

    expect(() =>
      CreateAtomicHabit.execute({
        budgetId: '',
        categoryId: 'cat-1',
        title: 'Válido',
        type: 'cap_per_occasion',
        ruleConfig: { maxCapPerOccasion: 10000 },
      })
    ).toThrow('El hábito atómico debe estar vinculado a un presupuesto y una categoría válida');
  });

  it('valida reglas inconsistentes según el tipo de hábito', () => {
    // Tope por ocasión <= 0
    expect(() =>
      CreateAtomicHabit.execute({
        budgetId: 'budget-1',
        categoryId: 'cat-1',
        title: 'Tope inválido',
        type: 'cap_per_occasion',
        ruleConfig: { maxCapPerOccasion: 0 },
      })
    ).toThrow('El tope por ocasión debe ser un monto mayor a cero');

    // Día sin gasto fuera de 0-6
    expect(() =>
      CreateAtomicHabit.execute({
        budgetId: 'budget-1',
        categoryId: 'cat-1',
        title: 'Día inválido',
        type: 'no_spend_day',
        ruleConfig: { noSpendDayOfWeek: 7 },
      })
    ).toThrow('El día sin gasto debe ser un día válido de la semana (0 a 6)');
  });
});
