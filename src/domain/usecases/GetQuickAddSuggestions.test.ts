import { describe, it, expect } from 'vitest';
import { GetQuickAddSuggestions } from './GetQuickAddSuggestions';
import { Transaction } from '../entities/Transaction';
import { TransactionRepository, TransactionFilters } from '../repositories/TransactionRepository';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    familyGroupId: 'fam-1',
    accountId: 'acc-1',
    categoryId: null,
    createdByUserId: 'user-1',
    type: 'expense',
    amount: 20000,
    currency: 'COP',
    description: null,
    merchantName: null,
    transactionDate: '2026-01-05',
    transferToAccountId: null,
    isRecurringInstance: false,
    recurringRuleId: null,
    status: 'confirmed',
    inputMethod: 'manual',
    aiMetadata: null,
    isPrivate: false,
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
    syncedAt: null,
    ...overrides,
  };
}

/** Repositorio falso: ya devuelve las transacciones en el orden que pide la
 *  UI real (más reciente primero), como hace Supabase con el "order by". */
class FakeTransactionRepository implements TransactionRepository {
  constructor(private ordered: Transaction[]) {}
  async getAll(_filters?: TransactionFilters): Promise<Transaction[]> {
    return this.ordered;
  }
  async getById(): Promise<Transaction | null> { throw new Error('not used'); }
  async create(): Promise<Transaction> { throw new Error('not used'); }
  async update(): Promise<Transaction> { throw new Error('not used'); }
  async delete(): Promise<void> { throw new Error('not used'); }
  async getByDateRange(): Promise<Transaction[]> { throw new Error('not used'); }
  async getTotalByType(): Promise<number> { throw new Error('not used'); }
}

describe('GetQuickAddSuggestions', () => {
  it('toma la transacción más reciente como "última transacción"', async () => {
    const repo = new FakeTransactionRepository([
      makeTx({ id: 'tx-recent', merchantName: 'Éxito', amount: 45000 }),
      makeTx({ id: 'tx-older', merchantName: 'Uber', amount: 12000 }),
    ]);
    const result = await new GetQuickAddSuggestions(repo).execute();
    expect(result.lastTransaction?.id).toBe('tx-recent');
  });

  it('agrupa comercios recientes por cuenta, sin duplicados y en orden de recencia', async () => {
    const repo = new FakeTransactionRepository([
      makeTx({ id: 't1', accountId: 'acc-1', merchantName: 'Éxito' }),
      makeTx({ id: 't2', accountId: 'acc-1', merchantName: 'Uber' }),
      makeTx({ id: 't3', accountId: 'acc-1', merchantName: 'éxito' }), // duplicado (case-insensitive)
      makeTx({ id: 't4', accountId: 'acc-2', merchantName: 'Netflix' }),
    ]);
    const result = await new GetQuickAddSuggestions(repo).execute();
    expect(result.recentMerchantsByAccount['acc-1']).toEqual(['Éxito', 'Uber']);
    expect(result.recentMerchantsByAccount['acc-2']).toEqual(['Netflix']);
  });

  it('ignora ingresos y transferencias al calcular comercios recientes', async () => {
    const repo = new FakeTransactionRepository([
      makeTx({ id: 't1', type: 'income', merchantName: 'Nómina' }),
      makeTx({ id: 't2', type: 'transfer', merchantName: 'Ahorro' }),
    ]);
    const result = await new GetQuickAddSuggestions(repo).execute();
    expect(result.recentMerchantsByAccount).toEqual({});
  });

  it('sugiere la categoría más frecuente históricamente para un comercio', async () => {
    const repo = new FakeTransactionRepository([
      makeTx({ id: 't1', merchantName: 'Éxito', categoryId: 'cat-mercado' }),
      makeTx({ id: 't2', merchantName: 'Éxito', categoryId: 'cat-mercado' }),
      makeTx({ id: 't3', merchantName: 'Éxito', categoryId: 'cat-hogar' }),
    ]);
    const result = await new GetQuickAddSuggestions(repo).execute();
    expect(result.topCategoryByMerchant['éxito']).toBe('cat-mercado');
  });

  it('limita los comercios recientes por cuenta a 8', async () => {
    const txs = Array.from({ length: 12 }, (_, i) => makeTx({ id: `t${i}`, merchantName: `Comercio ${i}` }));
    const repo = new FakeTransactionRepository(txs);
    const result = await new GetQuickAddSuggestions(repo).execute();
    expect(result.recentMerchantsByAccount['acc-1']).toHaveLength(8);
  });
});
