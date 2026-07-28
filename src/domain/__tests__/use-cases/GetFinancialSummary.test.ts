import { describe, it, expect, vi } from 'vitest';
import { GetFinancialSummary } from '../../usecases/GetFinancialSummary';
import { Transaction } from '../../entities/Transaction';
import { TransactionRepository } from '../../repositories/TransactionRepository';

function makeTx(type: 'income' | 'expense', amount: number, categoryId: string | null = null): Transaction {
  return {
    id: `tx-${Math.random()}`,
    familyGroupId: 'fam-1',
    accountId: 'acc-1',
    categoryId,
    createdByUserId: 'usr-1',
    type,
    amount,
    currency: 'USD',
    description: null,
    merchantName: null,
    transactionDate: '2026-07-15',
    transferToAccountId: null,
    isRecurringInstance: false,
    recurringRuleId: null,
    status: 'confirmed',
    inputMethod: 'manual',
    aiMetadata: null,
    isPrivate: false,
    createdAt: '2026-07-15T00:00:00Z',
    updatedAt: '2026-07-15T00:00:00Z',
    syncedAt: null,
  };
}

function makeFakeRepo(transactions: Transaction[]): TransactionRepository {
  return {
    getAll: vi.fn(async () => transactions),
    getById: vi.fn(async () => null),
    create: vi.fn(async () => { throw new Error('Not implemented'); }),
    update: vi.fn(async () => { throw new Error('Not implemented'); }),
    delete: vi.fn(async () => { throw new Error('Not implemented'); }),
    getByDateRange: vi.fn(async () => []),
    getTotalByType: vi.fn(async () => 0),
  };
}

describe('GetFinancialSummary', () => {
  it('calcula correctamente el total de ingresos, gastos, neto y top de categorías', async () => {
    const txs = [
      makeTx('income', 3000),
      makeTx('expense', 500, 'cat-rent'),
      makeTx('expense', 400, 'cat-food'),
      makeTx('expense', 200, 'cat-food'),
    ];
    const repo = makeFakeRepo(txs);
    const usecase = new GetFinancialSummary(repo);

    const summary = await usecase.execute('2026-07-01', '2026-07-31');

    expect(summary.totalIncome).toBe(3000);
    expect(summary.totalExpenses).toBe(1100);
    expect(summary.net).toBe(1900);
    expect(summary.transactionCount).toBe(4);
    expect(summary.averageExpense).toBe(366.67);
    expect(summary.topExpenseCategories).toHaveLength(2);
    expect(summary.topExpenseCategories[0]).toEqual({ categoryId: 'cat-food', amount: 600 });
    expect(summary.topExpenseCategories[1]).toEqual({ categoryId: 'cat-rent', amount: 500 });
  });

  it('retorna valores en cero si no hay transacciones en el periodo', async () => {
    const repo = makeFakeRepo([]);
    const usecase = new GetFinancialSummary(repo);

    const summary = await usecase.execute('2026-07-01', '2026-07-31');

    expect(summary.totalIncome).toBe(0);
    expect(summary.totalExpenses).toBe(0);
    expect(summary.net).toBe(0);
    expect(summary.transactionCount).toBe(0);
    expect(summary.averageExpense).toBe(0);
    expect(summary.topExpenseCategories).toEqual([]);
  });
});
