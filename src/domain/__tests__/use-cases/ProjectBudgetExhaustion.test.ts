import { describe, it, expect } from 'vitest';
import { ProjectBudgetExhaustion } from '../../usecases/ProjectBudgetExhaustion';
import { Budget, BudgetProgress } from '../../entities/Budget';

function makeProgress(overrides: Partial<BudgetProgress> = {}): BudgetProgress {
  const budget: Budget = {
    id: 'budget-1',
    familyGroupId: 'fam-1',
    categoryId: 'cat-restaurantes',
    amountLimit: 300000,
    year: 2026,
    month: 7,
    scope: 'family',
    ownerUserId: null,
    createdAt: '2026-07-01T00:00:00.000Z',
  };
  return {
    budget,
    spent: 150000,
    remaining: 150000,
    percentage: 50,
    status: 'ok',
    ...overrides,
  };
}

describe('ProjectBudgetExhaustion', () => {
  it('proyecta que se agotará antes de fin de mes si el ritmo actual lo supera', () => {
    const progress = makeProgress({ spent: 200000, remaining: 60000 });
    const result = new ProjectBudgetExhaustion().execute(progress, 10, 8);
    expect(result.willExceedBeforeMonthEnd).toBe(true);
    expect(result.daysUntilExceeded).toBe(3);
  });

  it('no proyecta agotamiento si el ritmo actual alcanza para todo el mes', () => {
    const progress = makeProgress({ spent: 60000, remaining: 240000 });
    const result = new ProjectBudgetExhaustion().execute(progress, 10, 20);
    expect(result.willExceedBeforeMonthEnd).toBe(false);
    expect(result.daysUntilExceeded).toBeNull();
  });

  it('no proyecta nada si el presupuesto ya está excedido', () => {
    const progress = makeProgress({ status: 'exceeded', spent: 350000, remaining: -50000 });
    const result = new ProjectBudgetExhaustion().execute(progress, 15, 15);
    expect(result.willExceedBeforeMonthEnd).toBe(false);
    expect(result.daysUntilExceeded).toBeNull();
  });

  it('no proyecta nada si todavía no hay gasto registrado este mes', () => {
    const progress = makeProgress({ spent: 0, remaining: 300000 });
    const result = new ProjectBudgetExhaustion().execute(progress, 5, 25);
    expect(result.willExceedBeforeMonthEnd).toBe(false);
    expect(result.daysUntilExceeded).toBeNull();
  });
});
