import { describe, it, expect } from 'vitest';
import { CalculateFinancialHealth } from '../../usecases/CalculateFinancialHealth';
import { Transaction } from '../../entities/Transaction';
import { Category } from '../../entities/Category';
import { FinancialMethodology } from '../../entities/FinancialMethodology';

describe('CalculateFinancialHealth — Framework de Metodologías Financieras', () => {

  const mockCategories: Category[] = [
    { id: 'cat-1', name: 'Alimentación', icon: 'cart', color: '#4CAF50', parentCategoryId: null, budgetRole: 'needs', isSystem: true, isPrivate: false, familyGroupId: null, createdAt: '' },
    { id: 'cat-2', name: 'Restaurantes', icon: 'food', color: '#FF9800', parentCategoryId: null, budgetRole: 'wants', isSystem: true, isPrivate: false, familyGroupId: null, createdAt: '' },
    { id: 'cat-3', name: 'Ahorro Fiduciaria', icon: 'piggy-bank', color: '#2196F3', parentCategoryId: null, budgetRole: 'savings', isSystem: true, isPrivate: false, familyGroupId: null, createdAt: '' },
  ];

  const mockTransactions: Transaction[] = [
    // Ingreso: $1.000.000
    { id: 't1', familyGroupId: 'fam-1', accountId: 'acc-1', amount: 1000000, type: 'income', categoryId: null, date: '2026-07-01', description: 'Sueldo', isRecurringInstance: false, createdAt: '' },
    // Necesidades: $500.000 (50%)
    { id: 't2', familyGroupId: 'fam-1', accountId: 'acc-1', amount: 500000, type: 'expense', categoryId: 'cat-1', date: '2026-07-05', description: 'Mercado', isRecurringInstance: false, createdAt: '' },
    // Deseos: $300.000 (30%)
    { id: 't3', familyGroupId: 'fam-1', accountId: 'acc-1', amount: 300000, type: 'expense', categoryId: 'cat-2', date: '2026-07-10', description: 'Cenas', isRecurringInstance: false, createdAt: '' },
    // Ahorro: $200.000 (20%)
    { id: 't4', familyGroupId: 'fam-1', accountId: 'acc-1', amount: 200000, type: 'expense', categoryId: 'cat-3', date: '2026-07-15', description: 'Bolsillo', isRecurringInstance: false, createdAt: '' },
  ];

  const rule503020: FinancialMethodology = {
    id: 'm1',
    familyGroupId: null,
    name: '50/30/20',
    code: 'rule_50_30_20',
    description: 'Warren rule',
    isPreset: true,
    targets: { needs: 50, wants: 30, savings: 20 },
    isActive: true,
    createdAt: '',
  };

  const ruleFIRE: FinancialMethodology = {
    id: 'm2',
    familyGroupId: null,
    name: 'FIRE',
    code: 'rule_fire',
    description: 'FIRE 50/50',
    isPreset: true,
    targets: { needs: 50, savings: 50 },
    isActive: false,
    createdAt: '',
  };

  it('calcula porcentajes exactos para la regla 50/30/20 y retorna estatus excelente', () => {
    const result = CalculateFinancialHealth.execute(mockTransactions, mockCategories, rule503020);

    expect(result.totalIncome).toBe(1000000);
    expect(result.totalExpense).toBe(1000000);
    expect(result.actualPercentages.needs).toBe(50);
    expect(result.actualPercentages.wants).toBe(30);
    expect(result.actualPercentages.savings).toBe(20);
    expect(result.status).toBe('excellent');
  });

  it('evalúa una desviación bajo la metodología FIRE cuando falta ahorro', () => {
    const result = CalculateFinancialHealth.execute(mockTransactions, mockCategories, ruleFIRE);

    // FIRE espera 50% ahorro, pero solo hubo 20%
    expect(result.actualPercentages.savings).toBe(20);
    expect(result.recommendations.some(r => r.includes('Ahorro e Inversión'))).toBe(true);
  });

});
