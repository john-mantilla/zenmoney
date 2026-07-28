import { describe, it, expect } from 'vitest';
import { Budget, BudgetProgress } from '../../entities/Budget';

describe('Budget Entity', () => {
  it('debe definir la estructura de un presupuesto mensual por categoría', () => {
    const budget: Budget = {
      id: 'bdg-1',
      familyGroupId: 'fam-1',
      categoryId: 'cat-groceries',
      amountLimit: 500,
      year: 2026,
      month: 7,
      scope: 'family',
      ownerUserId: null,
      createdAt: '2026-07-01T00:00:00Z',
    };

    expect(budget.amountLimit).toBe(500);
    expect(budget.month).toBe(7);
    expect(budget.year).toBe(2026);
    expect(budget.scope).toBe('family');
    expect(budget.ownerUserId).toBeNull();
  });

  it('debe validar la estructura de progreso de presupuesto (BudgetProgress)', () => {
    const budget: Budget = {
      id: 'bdg-2',
      familyGroupId: 'fam-1',
      categoryId: 'cat-dining',
      amountLimit: 200,
      year: 2026,
      month: 7,
      scope: 'individual',
      ownerUserId: 'usr-1',
      createdAt: '2026-07-01T00:00:00Z',
    };

    const progress: BudgetProgress = {
      budget,
      spent: 150,
      remaining: 50,
      percentage: 75,
      status: 'warning',
    };

    expect(progress.spent).toBe(150);
    expect(progress.remaining).toBe(50);
    expect(progress.percentage).toBe(75);
    expect(progress.status).toBe('warning');
  });
});
