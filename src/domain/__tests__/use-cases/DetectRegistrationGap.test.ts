import { describe, it, expect } from 'vitest';
import { DetectRegistrationGap } from '../../usecases/DetectRegistrationGap';
import { Transaction } from '../../entities/Transaction';

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
    transactionDate: '2026-07-10',
    transferToAccountId: null,
    isRecurringInstance: false,
    recurringRuleId: null,
    status: 'confirmed',
    inputMethod: 'manual',
    aiMetadata: null,
    isPrivate: false,
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    syncedAt: null,
    ...overrides,
  };
}

describe('DetectRegistrationGap', () => {
  it('no alerta si el usuario tiene poco historial (usuario nuevo)', () => {
    const txs = [makeTx({ transactionDate: '2026-07-01' }), makeTx({ transactionDate: '2026-07-02' })];
    const result = new DetectRegistrationGap().execute(txs, '2026-07-13');
    expect(result.hasGap).toBe(false);
  });

  it('detecta un vacío cuando el usuario registra casi a diario y lleva varios días sin nada', () => {
    const txs = Array.from({ length: 20 }, (_, i) => {
      const d = new Date('2026-07-05T00:00:00');
      d.setDate(d.getDate() - i);
      return makeTx({ id: `tx-${i}`, transactionDate: d.toISOString().split('T')[0] });
    });
    const result = new DetectRegistrationGap().execute(txs, '2026-07-13');
    expect(result.hasGap).toBe(true);
    expect(result.daysSinceLastTransaction).toBe(8);
  });

  it('no alerta si el usuario registra esporádicamente y el vacío actual es normal para su ritmo', () => {
    const txs = [
      makeTx({ id: 'tx-1', transactionDate: '2026-06-15' }),
      makeTx({ id: 'tx-2', transactionDate: '2026-06-25' }),
      makeTx({ id: 'tx-3', transactionDate: '2026-07-05' }),
      makeTx({ id: 'tx-4', transactionDate: '2026-06-05' }),
      makeTx({ id: 'tx-5', transactionDate: '2026-05-25' }),
    ];
    const result = new DetectRegistrationGap().execute(txs, '2026-07-08');
    expect(result.hasGap).toBe(false);
  });

  it('ignora transacciones pendientes al calcular el historial', () => {
    const txs = [
      makeTx({ id: 'tx-1', transactionDate: '2026-07-12', status: 'pending' }),
      ...Array.from({ length: 6 }, (_, i) => makeTx({ id: `tx-old-${i}`, transactionDate: `2026-06-0${i + 1}` })),
    ];
    const result = new DetectRegistrationGap().execute(txs, '2026-07-13');
    expect(result.daysSinceLastTransaction).toBeGreaterThan(30);
  });
});
