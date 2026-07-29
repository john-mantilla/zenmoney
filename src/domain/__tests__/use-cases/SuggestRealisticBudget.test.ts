import { describe, it, expect } from 'vitest';
import { SuggestRealisticBudget } from '../../usecases/SuggestRealisticBudget';
import { Transaction } from '../../entities/Transaction';
import { Category } from '../../entities/Category';

describe('SuggestRealisticBudget', () => {

  const mockCategories: Category[] = [
    { id: 'cat-dining', familyGroupId: null, name: 'Restaurantes', icon: 'food', color: '#FF9800', parentCategoryId: null, budgetRole: 'wants', isSystem: true, isPrivate: false, createdAt: '' },
  ];

  const mockTransactions: Transaction[] = [
    // Hace 1 mes: $1.500.000
    { id: 't1', familyGroupId: 'fam-1', accountId: 'acc-1', categoryId: 'cat-dining', createdByUserId: 'u1', type: 'expense', amount: 1500000, currency: 'COP', description: '', merchantName: null, transactionDate: '2026-06-15', transferToAccountId: null, isRecurringInstance: false, recurringRuleId: null, status: 'confirmed', inputMethod: 'manual', aiMetadata: null, isPrivate: false, createdAt: '', updatedAt: '', syncedAt: null },
    // Hace 2 meses: $1.500.000
    { id: 't2', familyGroupId: 'fam-1', accountId: 'acc-1', categoryId: 'cat-dining', createdByUserId: 'u1', type: 'expense', amount: 1500000, currency: 'COP', description: '', merchantName: null, transactionDate: '2026-05-15', transferToAccountId: null, isRecurringInstance: false, recurringRuleId: null, status: 'confirmed', inputMethod: 'manual', aiMetadata: null, isPrivate: false, createdAt: '', updatedAt: '', syncedAt: null },
  ];

  it('sugiere una meta intermedia realista cuando el promedio histórico supera por mucho la meta deseada', () => {
    // Usuario intenta fijar $1.000.000 pero su promedio es $1.500.000
    const suggestion = SuggestRealisticBudget.execute(
      'cat-dining',
      1000000,
      mockTransactions,
      mockCategories,
      2026,
      7
    );

    expect(suggestion).not.toBeNull();
    expect(suggestion?.historical3MonthAverage).toBe(1500000);
    // Sugerencia esperada: 1.500.000 - (500.000 * 0.4) = 1.300.000
    expect(suggestion?.suggestedAmount).toBe(1300000);
    expect(suggestion?.reason).toContain('1.300.000');
  });

  it('retorna null cuando la meta del usuario ya es realista o cercana al histórico', () => {
    // Usuario intenta fijar $1.400.000 y su promedio es $1.500.000 (dentro del 15%)
    const suggestion = SuggestRealisticBudget.execute(
      'cat-dining',
      1400000,
      mockTransactions,
      mockCategories,
      2026,
      7
    );

    expect(suggestion).toBeNull();
  });

});
