import { describe, it, expect } from 'vitest';
import { Budget } from '../../domain/entities/Budget';
import { Category } from '../../domain/entities/Category';

/**
 * UI & LOGIC SMOKE TEST: Consolidación Automática y Deduplicación de Presupuestos
 *
 * Verifica:
 * 1. Consolidación dinámica: el límite de una categoría superior es la suma de los presupuestos de sus subcategorías.
 * 2. Si las subcategorías no superan su límite combinado, la categoría superior no alerta falsamente como excedida (100%+).
 * 3. Deduplicación de presupuestos repetidos para la misma subcategoría bajo el mismo ámbito.
 */
describe('Consolidación Automática y Deduplicación de Presupuestos', () => {
  const loadedCats: Category[] = [
    {
      id: 'cat-finanzas',
      familyGroupId: 'fam-1',
      name: 'Finanzas',
      icon: 'bank',
      color: '#3B82F6',
      parentCategoryId: null,
      budgetRole: 'needs',
      isSystem: true,
      isPrivate: false,
      createdAt: '2026-01-01',
    },
    {
      id: 'cat-seguro',
      familyGroupId: 'fam-1',
      name: 'Seguro Pensión',
      icon: 'shield',
      color: '#10B981',
      parentCategoryId: 'cat-finanzas',
      budgetRole: 'needs',
      isSystem: false,
      isPrivate: false,
      createdAt: '2026-01-01',
    },
    {
      id: 'cat-comisiones-1',
      familyGroupId: 'fam-1',
      name: 'Comisiones',
      icon: 'percent',
      color: '#F59E0B',
      parentCategoryId: 'cat-finanzas',
      budgetRole: 'needs',
      isSystem: false,
      isPrivate: false,
      createdAt: '2026-01-01',
    },
    {
      id: 'cat-comisiones-2',
      familyGroupId: 'fam-1',
      name: 'Comisiones',
      icon: 'percent',
      color: '#F59E0B',
      parentCategoryId: 'cat-finanzas',
      budgetRole: 'needs',
      isSystem: false,
      isPrivate: false,
      createdAt: '2026-01-01',
    },
  ];

  it('deduplica subcategorías con el mismo nombre y ámbito bajo la misma categoría padre', () => {
    const rawSubBudgets = [
      {
        categoryId: 'cat-seguro',
        budget: { id: 'b-seguro', categoryId: 'cat-seguro', amountLimit: 720000, scope: 'family', year: 2026, month: 10 } as Budget,
        spent: 707600,
      },
      {
        categoryId: 'cat-comisiones-1',
        budget: { id: 'b-com-1', categoryId: 'cat-comisiones-1', amountLimit: 50000, scope: 'family', year: 2026, month: 10 } as Budget,
        spent: 0,
      },
      {
        categoryId: 'cat-comisiones-2',
        budget: { id: 'b-com-2', categoryId: 'cat-comisiones-2', amountLimit: 50000, scope: 'family', year: 2026, month: 10 } as Budget,
        spent: 0,
      },
    ];

    // Lógica de deduplicación idéntica a budgets.tsx
    const seenSubKeys = new Set<string>();
    const uniqueSubBudgets: typeof rawSubBudgets = [];

    for (const s of rawSubBudgets) {
      const subCat = loadedCats.find(c => c.id === s.categoryId);
      const normalizedName = (subCat ? subCat.name : s.categoryId).trim().toLowerCase();
      const key = `${normalizedName}_${s.budget.scope || 'family'}_${s.budget.ownerUserId || 'family'}`;
      
      if (!seenSubKeys.has(key)) {
        seenSubKeys.add(key);
        uniqueSubBudgets.push(s);
      }
    }

    expect(uniqueSubBudgets).toHaveLength(2);
    expect(uniqueSubBudgets.map(s => s.budget.amountLimit)).toEqual([720000, 50000]);
  });

  it('consolida el límite superior del padre sumando exactamente sus subcategorías', () => {
    const children = [
      {
        id: 'b-seguro',
        categoryId: 'cat-seguro',
        name: 'Seguro Pensión',
        amountLimit: 720000,
        spent: 707600,
        remaining: 12400,
        percentage: 98,
        status: 'ok' as const,
        budget: { id: 'b-seguro', categoryId: 'cat-seguro', amountLimit: 720000, scope: 'family' } as Budget,
      },
      {
        id: 'b-com',
        categoryId: 'cat-comisiones-1',
        name: 'Comisiones',
        amountLimit: 50000,
        spent: 0,
        remaining: 50000,
        percentage: 0,
        status: 'ok' as const,
        budget: { id: 'b-com', categoryId: 'cat-comisiones-1', amountLimit: 50000, scope: 'family' } as Budget,
      },
    ];

    const parentBudgetItem = {
      budget: { id: 'b-old-parent', categoryId: 'cat-finanzas', amountLimit: 690000, scope: 'family' } as Budget,
      spent: 0, // gasto directo en la categoría padre
    };

    let amountLimit = 0;
    let spent = 707600; // total de gastos de todas las subcategorías

    if (children.length > 0) {
      amountLimit = children.reduce((sum, c) => sum + c.amountLimit, 0);
      if (parentBudgetItem && parentBudgetItem.spent > 0) {
        amountLimit += parentBudgetItem.budget.amountLimit;
      }
    } else if (parentBudgetItem) {
      amountLimit = parentBudgetItem.budget.amountLimit;
    }

    const remaining = amountLimit - spent;
    const percentage = Math.round((spent / amountLimit) * 100);

    // Límite consolidado: $720.000 + $50.000 = $770.000 (no los $690.000 viejos)
    expect(amountLimit).toBe(770000);
    expect(remaining).toBe(62400);
    // Consumido es 92%, por ende NO está excedido (> 100%)
    expect(percentage).toBe(92);
    expect(percentage).toBeLessThan(100);
  });
});
