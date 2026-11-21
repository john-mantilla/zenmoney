import { describe, it, expect } from 'vitest';
import { SmartSearchTransactions } from '@/src/domain/usecases/SmartSearchTransactions';
import { Transaction } from '@/src/domain/entities/Transaction';
import { Category } from '@/src/domain/entities/Category';
import { Account } from '@/src/domain/entities/Account';

describe('TransactionsSearchSmoke (UI Smoke Tests)', () => {
  const engine = new SmartSearchTransactions();

  const mockCategories: Category[] = [
    {
      id: 'cat_mercado',
      familyGroupId: 'fam_1',
      name: 'Mercado',
      parentCategoryId: null,
      icon: 'cart',
      color: '#10B981',
      budgetRole: 'needs',
      isSystem: false,
      isPrivate: false,
      createdAt: '2024-01-01',
    },
  ];

  const mockAccounts: Account[] = [
    {
      id: 'acc_1',
      familyGroupId: 'fam_1',
      ownerUserId: 'user_1',
      name: 'Nequi',
      type: 'bank',
      initialBalance: 0,
      currency: 'COP',
      isActive: true,
      isPrivate: false,
      createdAt: '2024-01-01',
    },
  ];

  const makeTx = (data: Partial<Transaction> & { id: string; amount: number; transactionDate: string }): Transaction => ({
    familyGroupId: 'fam_1',
    accountId: 'acc_1',
    categoryId: 'cat_mercado',
    createdByUserId: 'user_1',
    type: 'expense',
    currency: 'COP',
    description: null,
    merchantName: null,
    transferToAccountId: null,
    isRecurringInstance: false,
    recurringRuleId: null,
    status: 'confirmed',
    inputMethod: 'manual',
    aiMetadata: null,
    isPrivate: false,
    createdAt: '2026-11-20T10:00:00Z',
    updatedAt: '2026-11-20T10:00:00Z',
    syncedAt: null,
    tags: [],
    ...data,
  });

  const mockHistory: Transaction[] = [
    makeTx({
      id: 'tx_nov_2026',
      amount: 120000,
      description: 'Mercado Carulla',
      transactionDate: '2026-11-20',
    }),
    makeTx({
      id: 'tx_ago_2025',
      amount: 250000,
      description: 'Mercado Éxito aniversario',
      transactionDate: '2025-08-15',
    }),
    makeTx({
      id: 'tx_ene_2024',
      categoryId: null,
      type: 'income',
      amount: 3000000,
      description: 'Salario inicio de año',
      transactionDate: '2024-01-30',
    }),
  ];

  it('calcula sumas y flujos netos correctamente sin regresiones de $0', () => {
    // Búsqueda en todo el historial por palabra "mercado"
    const searchRes = engine.execute(mockHistory, mockCategories, mockAccounts, {
      query: 'mercado',
      scope: 'all',
    });

    expect(searchRes.totalMatches).toBe(2);
    expect(searchRes.expenseSum).toBe(370000); // 120.000 + 250.000
    expect(searchRes.incomeSum).toBe(0);
    expect(searchRes.netSum).toBe(-370000);
    expect(searchRes.matchedMonthsCount).toBe(2);
  });

  it('permite buscar en todo el historial transacciones de años anteriores sin desplazarse mes a mes', () => {
    // Buscar salario de 2024 cuando el mes visualizado es Nov 2026
    const res = engine.execute(mockHistory, mockCategories, mockAccounts, {
      query: 'salario',
      scope: 'all',
      targetYear: 2026,
      targetMonth: 11,
    });

    expect(res.totalMatches).toBe(1);
    expect(res.transactions[0].id).toBe('tx_ene_2024');
    expect(res.incomeSum).toBe(3000000);
    expect(res.netSum).toBe(3000000);
  });
});
