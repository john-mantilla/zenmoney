import { describe, it, expect } from 'vitest';
import { CalculateBudgetRollover } from '../../usecases/CalculateBudgetRollover';
import { Budget } from '../../entities/Budget';
import { Transaction } from '../../entities/Transaction';
import { Category } from '../../entities/Category';

describe('CalculateBudgetRollover', () => {
  const mockBudgetOct: Budget = {
    id: 'b-oct-2026',
    familyGroupId: 'fam-1',
    categoryId: 'cat-leisure',
    amountLimit: 100000,
    year: 2026,
    month: 10,
    scope: 'family',
    ownerUserId: null,
    hasRollover: true,
    createdAt: '2026-10-01T00:00:00Z',
  };

  const mockBudgetSep: Budget = {
    id: 'b-sep-2026',
    familyGroupId: 'fam-1',
    categoryId: 'cat-leisure',
    amountLimit: 100000,
    year: 2026,
    month: 9,
    scope: 'family',
    ownerUserId: null,
    hasRollover: true,
    createdAt: '2026-09-01T00:00:00Z',
  };

  const makeExpense = (amount: number, dateStr: string, categoryId = 'cat-leisure'): Transaction => ({
    id: `tx-${Math.random()}`,
    familyGroupId: 'fam-1',
    accountId: 'acc-1',
    categoryId,
    createdByUserId: 'u1',
    type: 'expense',
    amount,
    currency: 'COP',
    description: 'Salida de ocio',
    merchantName: 'Cine',
    transactionDate: dateStr,
    status: 'confirmed',
    inputMethod: 'manual',
    isPrivate: false,
    createdAt: `${dateStr}T12:00:00Z`,
    updatedAt: `${dateStr}T12:00:00Z`,
  });

  it('no altera el límite si hasRollover está desactivado', () => {
    const budgetWithoutRollover: Budget = {
      ...mockBudgetOct,
      hasRollover: false,
    };

    const pastExpenses = [makeExpense(60000, '2026-09-15')];
    const result = CalculateBudgetRollover.execute({
      budget: budgetWithoutRollover,
      pastMonthBudget: mockBudgetSep,
      pastMonthExpenses: pastExpenses,
    });

    expect(result.hasRollover).toBe(false);
    expect(result.rolloverAmount).toBe(0);
    expect(result.effectiveLimit).toBe(100000);
  });

  it('suma el superávit del mes anterior como bono de ahorro si gastó menos', () => {
    // En septiembre gastó $60.000 de $100.000 (sobraron $40.000)
    const pastExpenses = [makeExpense(60000, '2026-09-15')];

    const result = CalculateBudgetRollover.execute({
      budget: mockBudgetOct,
      pastMonthBudget: mockBudgetSep,
      pastMonthExpenses: pastExpenses,
    });

    expect(result.hasRollover).toBe(true);
    expect(result.baseLimit).toBe(100000);
    expect(result.rolloverAmount).toBe(40000);
    expect(result.effectiveLimit).toBe(140000); // 100k base + 40k rollover
  });

  it('descuenta el déficit si el usuario se sobregiró el mes anterior', () => {
    // En septiembre gastó $120.000 de $100.000 (se pasó por $20.000)
    const pastExpenses = [
      makeExpense(70000, '2026-09-10'),
      makeExpense(50000, '2026-09-25'),
    ];

    const result = CalculateBudgetRollover.execute({
      budget: mockBudgetOct,
      pastMonthBudget: mockBudgetSep,
      pastMonthExpenses: pastExpenses,
    });

    expect(result.hasRollover).toBe(true);
    expect(result.baseLimit).toBe(100000);
    expect(result.rolloverAmount).toBe(-20000);
    expect(result.effectiveLimit).toBe(80000); // 100k base - 20k déficit
  });

  it('acumula los gastos de subcategorías si la categoría presupuestada es padre', () => {
    const categories: Category[] = [
      {
        id: 'cat-leisure',
        familyGroupId: 'fam-1',
        name: 'Ocio',
        icon: 'popcorn',
        color: '#FF9800',
        budgetRole: 'flexible',
        parentCategoryId: null,
        isSystem: false,
        isPrivate: false,
        createdAt: '2026-01-01',
      },
      {
        id: 'sub-cine',
        familyGroupId: 'fam-1',
        name: 'Cine',
        icon: 'movie',
        color: '#FF9800',
        budgetRole: 'flexible',
        parentCategoryId: 'cat-leisure',
        isSystem: false,
        isPrivate: false,
        createdAt: '2026-01-01',
      },
      {
        id: 'sub-juegos',
        familyGroupId: 'fam-1',
        name: 'Videojuegos',
        icon: 'gamepad',
        color: '#FF9800',
        budgetRole: 'flexible',
        parentCategoryId: 'cat-leisure',
        isSystem: false,
        isPrivate: false,
        createdAt: '2026-01-01',
      },
    ];

    // Gastos repartidos en subcategorías: $30.000 en cine + $20.000 en juegos = $50.000
    const pastExpenses = [
      makeExpense(30000, '2026-09-12', 'sub-cine'),
      makeExpense(20000, '2026-09-18', 'sub-juegos'),
    ];

    const result = CalculateBudgetRollover.execute({
      budget: mockBudgetOct,
      pastMonthBudget: mockBudgetSep,
      pastMonthExpenses: pastExpenses,
      categories,
    });

    expect(result.rolloverAmount).toBe(50000); // 100k - 50k gastado
    expect(result.effectiveLimit).toBe(150000);
  });

  it('establece effectiveLimit como baseLimit si no hubo presupuesto en el mes anterior', () => {
    const result = CalculateBudgetRollover.execute({
      budget: mockBudgetOct,
      pastMonthBudget: null,
      pastMonthExpenses: [],
    });

    expect(result.rolloverAmount).toBe(0);
    expect(result.effectiveLimit).toBe(100000);
  });
});
