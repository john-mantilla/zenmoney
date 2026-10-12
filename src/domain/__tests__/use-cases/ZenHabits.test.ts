import { describe, it, expect } from 'vitest';
import { DetectHabitPatterns } from '../../usecases/DetectHabitPatterns';
import { EvaluateHabitNudge } from '../../usecases/EvaluateHabitNudge';
import { Transaction } from '../../entities/Transaction';
import { HabitPattern } from '../../entities/HabitPattern';
import { Category } from '../../entities/Category';

describe('ZenHabits — DetectHabitPatterns', () => {
  const detector = new DetectHabitPatterns();

  const mockCategories: Category[] = [
    {
      id: 'cat_food',
      familyGroupId: 'fg1',
      name: 'Restaurantes y Comida',
      icon: 'silverware',
      color: '#FF5722',
      budgetRole: 'flexible',
      parentCategoryId: null,
      isSystem: false,
      isPrivate: false,
      createdAt: '2026-01-01',
    },
    {
      id: 'cat_rent',
      familyGroupId: 'fg1',
      name: 'Arriendo',
      icon: 'home',
      color: '#3F51B5',
      budgetRole: 'fixed',
      parentCategoryId: null,
      isSystem: false,
      isPrivate: false,
      createdAt: '2026-01-01',
    },
  ];

  it('detecta un hábito semanal (miércoles de pizza) tras 3 o más ocurrencias', () => {
    // 3 Miércoles consecutivos:
    // 2026-09-02 (Miércoles)
    // 2026-09-09 (Miércoles)
    // 2026-09-16 (Miércoles)
    const expenses: Transaction[] = [
      {
        id: 'tx1',
        familyGroupId: 'fg1',
        accountId: 'acc_bank',
        categoryId: 'cat_food',
        createdByUserId: 'u1',
        type: 'expense',
        amount: 65000,
        currency: 'COP',
        description: 'Pizza familiar',
        merchantName: 'Pizzería Napoli',
        transactionDate: '2026-09-02',
        status: 'confirmed',
        createdAt: '2026-09-02T20:00:00Z',
        updatedAt: '2026-09-02T20:00:00Z',
      },
      {
        id: 'tx2',
        familyGroupId: 'fg1',
        accountId: 'acc_bank',
        categoryId: 'cat_food',
        createdByUserId: 'u1',
        type: 'expense',
        amount: 68000,
        currency: 'COP',
        description: 'Pizza y gaseosa',
        merchantName: 'Pizzería Napoli',
        transactionDate: '2026-09-09',
        status: 'confirmed',
        createdAt: '2026-09-09T20:15:00Z',
        updatedAt: '2026-09-09T20:15:00Z',
      },
      {
        id: 'tx3',
        familyGroupId: 'fg1',
        accountId: 'acc_bank',
        categoryId: 'cat_food',
        createdByUserId: 'u1',
        type: 'expense',
        amount: 62000,
        currency: 'COP',
        description: 'Pizza artesanal',
        merchantName: 'Pizzería Napoli',
        transactionDate: '2026-09-16',
        status: 'confirmed',
        createdAt: '2026-09-16T20:30:00Z',
        updatedAt: '2026-09-16T20:30:00Z',
      },
    ];

    const habits = detector.execute(expenses, mockCategories);
    expect(habits.length).toBe(1);

    const pizzaHabit = habits[0];
    expect(pizzaHabit.dayOfWeek).toBe(3); // Miércoles
    expect(pizzaHabit.merchantName).toBe('Pizzería Napoli');
    expect(pizzaHabit.title).toContain('Miércoles de Pizzería Napoli');
    expect(pizzaHabit.icon).toBe('pizza');
    expect(pizzaHabit.timePrompt).toBe('21:00');
    expect(pizzaHabit.estimatedAmount).toBe(65000); // Promedio de 65k, 68k, 62k
    expect(pizzaHabit.confidenceScore).toBeGreaterThan(0.6);
  });

  it('no confunde gastos de arriendo o servicios fijos con hábitos', () => {
    // Pagos repetidos de arriendo
    const expenses: Transaction[] = [
      {
        id: 'tx_rent1',
        familyGroupId: 'fg1',
        accountId: 'acc_bank',
        categoryId: 'cat_rent',
        createdByUserId: 'u1',
        type: 'expense',
        amount: 1500000,
        currency: 'COP',
        description: 'Pago mensual arriendo',
        merchantName: 'Inmobiliaria',
        transactionDate: '2026-08-05',
        status: 'confirmed',
        createdAt: '2026-08-05T10:00:00Z',
        updatedAt: '2026-08-05T10:00:00Z',
      },
      {
        id: 'tx_rent2',
        familyGroupId: 'fg1',
        accountId: 'acc_bank',
        categoryId: 'cat_rent',
        createdByUserId: 'u1',
        type: 'expense',
        amount: 1500000,
        currency: 'COP',
        description: 'Pago arriendo',
        merchantName: 'Inmobiliaria',
        transactionDate: '2026-09-05',
        status: 'confirmed',
        createdAt: '2026-09-05T10:00:00Z',
        updatedAt: '2026-09-05T10:00:00Z',
      },
      {
        id: 'tx_rent3',
        familyGroupId: 'fg1',
        accountId: 'acc_bank',
        categoryId: 'cat_rent',
        createdByUserId: 'u1',
        type: 'expense',
        amount: 1500000,
        currency: 'COP',
        description: 'Arriendo',
        merchantName: 'Inmobiliaria',
        transactionDate: '2026-10-05',
        status: 'confirmed',
        createdAt: '2026-10-05T10:00:00Z',
        updatedAt: '2026-10-05T10:00:00Z',
      },
    ];

    const habits = detector.execute(expenses, mockCategories);
    expect(habits.length).toBe(0);
  });
});

describe('ZenHabits — EvaluateHabitNudge', () => {
  const evaluator = new EvaluateHabitNudge();

  const habitPizza: HabitPattern = {
    id: 'habit_pizza_miercoles',
    title: 'Miércoles de Pizza',
    dayOfWeek: 3, // Miércoles
    timePrompt: '21:00',
    merchantName: 'Pizzería Napoli',
    defaultAccountId: 'acc1',
    defaultCategoryId: 'cat_food',
    estimatedAmount: 65000,
    confidenceScore: 0.85,
    isActive: true,
    consecutiveSkips: 0,
    createdAt: '2026-09-01T00:00:00Z',
  };

  it('no notifica si hoy no es el día de la semana del hábito', () => {
    // Un martes (dayOfWeek = 2)
    const tuesday = new Date('2026-09-15T21:30:00');
    const result = evaluator.execute(habitPizza, [], tuesday);
    expect(result.shouldNudge).toBe(false);
    expect(result.reason).toBe('wrong_day');
  });

  it('no notifica antes de la hora fijada (al terminar el plan)', () => {
    // Miércoles pero a las 3:00 PM (15:00)
    const wednesdayAfternoon = new Date('2026-09-16T15:00:00');
    const result = evaluator.execute(habitPizza, [], wednesdayAfternoon);
    expect(result.shouldNudge).toBe(false);
    expect(result.reason).toBe('too_early');
  });

  it('activa el recordatorio en la noche si no se ha registrado ningún gasto hoy', () => {
    // Miércoles a las 9:15 PM (21:15)
    const wednesdayNight = new Date('2026-09-16T21:15:00');
    const result = evaluator.execute(habitPizza, [], wednesdayNight);
    expect(result.shouldNudge).toBe(true);
    expect(result.reason).toBe('ready');
  });

  it('Aplica Regla de Silencio Inteligente: No notifica si el usuario ya anotó la pizza hoy', () => {
    const wednesdayNight = new Date('2026-09-16T21:15:00');
    const todayExpenses: Transaction[] = [
      {
        id: 'tx_today',
        familyGroupId: 'fg1',
        accountId: 'acc1',
        categoryId: 'cat_food',
        createdByUserId: 'u1',
        type: 'expense',
        amount: 67000,
        currency: 'COP',
        description: 'Cena pizza con niños',
        merchantName: 'Pizzería Napoli',
        transactionDate: '2026-09-16',
        status: 'confirmed',
        createdAt: '2026-09-16T20:30:00Z',
        updatedAt: '2026-09-16T20:30:00Z',
      },
    ];

    const result = evaluator.execute(habitPizza, todayExpenses, wednesdayNight);
    expect(result.shouldNudge).toBe(false);
    expect(result.reason).toBe('silenced_by_existing_transaction');
  });

  it('no notifica si ya fue descartado hoy por el usuario', () => {
    const wednesdayNight = new Date('2026-09-16T21:15:00');
    const result = evaluator.execute(habitPizza, [], wednesdayNight, true);
    expect(result.shouldNudge).toBe(false);
    expect(result.reason).toBe('dismissed_today');
  });
});
