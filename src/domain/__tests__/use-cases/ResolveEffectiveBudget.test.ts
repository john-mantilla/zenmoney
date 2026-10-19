import { describe, it, expect } from 'vitest';
import { ResolveEffectiveBudget } from '../../usecases/ResolveEffectiveBudget';
import { Budget } from '../../entities/Budget';

describe('ResolveEffectiveBudget UseCase', () => {
  const masterBudget: Budget = {
    id: 'b-master',
    familyGroupId: 'fam-1',
    categoryId: 'cat-groceries',
    amountLimit: 1000000,
    year: 2026,
    month: 1, // Vigente desde Enero 2026
    scope: 'family',
    ownerUserId: null,
    isOverride: false,
    createdAt: '2026-01-01T00:00:00Z',
  };

  const decemberOverride: Budget = {
    id: 'b-override-dec',
    familyGroupId: 'fam-1',
    categoryId: 'cat-groceries',
    amountLimit: 2500000,
    year: 2026,
    month: 12, // Exclusivo de Diciembre 2026
    scope: 'family',
    ownerUserId: null,
    isOverride: true,
    overrideReason: 'Navidad y Cenas Familiares',
    createdAt: '2026-12-01T00:00:00Z',
  };

  const allBudgets = [masterBudget, decemberOverride];

  it('debe aplicar la regla maestra recurrente en los meses normales anteriores al override', () => {
    // Noviembre 2026 (mes 11)
    const resolved = ResolveEffectiveBudget.resolveAll(allBudgets, 2026, 11);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].isOverride).toBe(false);
    expect(resolved[0].budget.amountLimit).toBe(1000000);
    expect(resolved[0].budget.id).toBe('b-master');
  });

  it('debe aplicar el límite extraordinario (override) únicamente en el mes correspondiente', () => {
    // Diciembre 2026 (mes 12)
    const resolved = ResolveEffectiveBudget.resolveAll(allBudgets, 2026, 12);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].isOverride).toBe(true);
    expect(resolved[0].budget.amountLimit).toBe(2500000);
    expect(resolved[0].overrideReason).toBe('Navidad y Cenas Familiares');
    expect(resolved[0].baseMasterBudget?.amountLimit).toBe(1000000);
  });

  it('debe retomar automáticamente la regla maestra al mes siguiente (Enero 2027) sin propagar el override', () => {
    // Enero 2027 (mes 1)
    const resolved = ResolveEffectiveBudget.resolveAll(allBudgets, 2027, 1);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].isOverride).toBe(false);
    expect(resolved[0].budget.amountLimit).toBe(1000000);
    expect(resolved[0].budget.id).toBe('b-master');
  });

  it('debe retornar lista vacía si no existe ni override ni regla maestra previa', () => {
    // Año 2025 (antes de crear el presupuesto de 2026)
    const resolved = ResolveEffectiveBudget.resolveAll(allBudgets, 2025, 12);
    expect(resolved).toHaveLength(0);
  });

  it('permite coexistencia de múltiples categorías con y sin overrides', () => {
    const transportMaster: Budget = {
      id: 'b-transport',
      familyGroupId: 'fam-1',
      categoryId: 'cat-transport',
      amountLimit: 300000,
      year: 2026,
      month: 6,
      scope: 'family',
      ownerUserId: null,
      isOverride: false,
      createdAt: '2026-06-01T00:00:00Z',
    };

    const resolved = ResolveEffectiveBudget.resolveAll([...allBudgets, transportMaster], 2026, 12);
    expect(resolved).toHaveLength(2);

    const groceries = resolved.find((r) => r.budget.categoryId === 'cat-groceries');
    const transport = resolved.find((r) => r.budget.categoryId === 'cat-transport');

    expect(groceries?.isOverride).toBe(true);
    expect(groceries?.budget.amountLimit).toBe(2500000);

    expect(transport?.isOverride).toBe(false);
    expect(transport?.budget.amountLimit).toBe(300000);
  });
});
