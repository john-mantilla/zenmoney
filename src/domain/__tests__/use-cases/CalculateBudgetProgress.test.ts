import { describe, it, expect, vi } from 'vitest';
import { CalculateBudgetProgress } from '../../usecases/CalculateBudgetProgress';
import { Budget } from '../../entities/Budget';
import { Transaction } from '../../entities/Transaction';
import { TransactionRepository } from '../../repositories/TransactionRepository';

function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'bdg-1',
    familyGroupId: 'fam-1',
    categoryId: 'cat-food',
    amountLimit: 1000,
    year: 2026,
    month: 7,
    scope: 'family',
    ownerUserId: null,
    createdAt: '2026-07-01T00:00:00Z',
    ...overrides,
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

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    familyGroupId: 'fam-1',
    accountId: 'acc-1',
    categoryId: 'cat-food',
    createdByUserId: 'usr-1',
    type: 'expense',
    amount: 200,
    currency: 'USD',
    description: 'Mercado',
    merchantName: null,
    transactionDate: '2026-07-10',
    transferToAccountId: null,
    isRecurringInstance: false,
    recurringRuleId: null,
    status: 'confirmed',
    inputMethod: 'manual',
    aiMetadata: null,
    isPrivate: false,
    createdAt: '2026-07-10T00:00:00Z',
    updatedAt: '2026-07-10T00:00:00Z',
    syncedAt: null,
    ...overrides,
  };
}

describe('CalculateBudgetProgress', () => {
  it('calcula el progreso normal (status ok < 80%)', async () => {
    const budget = makeBudget({ amountLimit: 1000 });
    const repo = makeFakeRepo([makeTx({ amount: 300 }), makeTx({ amount: 200 })]);
    const usecase = new CalculateBudgetProgress(repo);

    const progress = await usecase.execute(budget);

    expect(progress.spent).toBe(500);
    expect(progress.remaining).toBe(500);
    expect(progress.percentage).toBe(50);
    expect(progress.status).toBe('ok');
  });

  it('alerta al alcanzar el 80% o más (status warning)', async () => {
    const budget = makeBudget({ amountLimit: 1000 });
    const repo = makeFakeRepo([makeTx({ amount: 850 })]);
    const usecase = new CalculateBudgetProgress(repo);

    const progress = await usecase.execute(budget);

    expect(progress.spent).toBe(850);
    expect(progress.percentage).toBe(85);
    expect(progress.status).toBe('warning');
  });

  it('alerta al superar el 100% (status exceeded)', async () => {
    const budget = makeBudget({ amountLimit: 1000 });
    const repo = makeFakeRepo([makeTx({ amount: 1100 })]);
    const usecase = new CalculateBudgetProgress(repo);

    const progress = await usecase.execute(budget);

    expect(progress.spent).toBe(1100);
    expect(progress.remaining).toBe(-100);
    expect(progress.percentage).toBe(110);
    expect(progress.status).toBe('exceeded');
  });

  it('filtra solo gastos del usuario cuando el scope es individual', async () => {
    const budget = makeBudget({ scope: 'individual', ownerUserId: 'usr-1', amountLimit: 500 });
    const repo = makeFakeRepo([
      makeTx({ amount: 200, createdByUserId: 'usr-1' }),
      makeTx({ amount: 300, createdByUserId: 'usr-2' }), // Gasto de otro usuario
    ]);
    const usecase = new CalculateBudgetProgress(repo);

    const progress = await usecase.execute(budget);

    expect(progress.spent).toBe(200);
    expect(progress.percentage).toBe(40);
  });
});
