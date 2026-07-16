import { describe, it, expect } from 'vitest';
import { ProjectBudgetExhaustion } from './ProjectBudgetExhaustion';
import { Budget, BudgetProgress } from '../entities/Budget';

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
    // Gastados 200.000 en 10 días -> 20.000/día. Quedan 60.000 -> 3 días para agotarse.
    // Quedan 8 días de mes -> se agotará ANTES de fin de mes (3 <= 8).
    const progress = makeProgress({ spent: 200000, remaining: 60000 });
    const result = new ProjectBudgetExhaustion().execute(progress, 10, 8);
    expect(result.willExceedBeforeMonthEnd).toBe(true);
    expect(result.daysUntilExceeded).toBe(3);
  });

  it('no proyecta agotamiento si el ritmo actual alcanza para todo el mes', () => {
    // Gastados 60.000 en 10 días -> 6.000/día. Quedan 240.000 -> 40 días para agotarse.
    // Quedan 20 días de mes -> NO se agota antes de fin de mes.
    const progress = makeProgress({ spent: 60000, remaining: 240000 });
    const result = new ProjectBudgetExhaustion().execute(progress, 10, 20);
    expect(result.willExceedBeforeMonthEnd).toBe(false);
    expect(result.daysUntilExceeded).toBeNull();
  });

  it('no proyecta nada si el presupuesto ya está excedido (lo cubre la alerta de 100%)', () => {
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
