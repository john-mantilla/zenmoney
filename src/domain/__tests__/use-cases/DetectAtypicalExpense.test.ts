import { describe, it, expect } from 'vitest';
import { DetectAtypicalExpense } from '../../usecases/DetectAtypicalExpense';
import { Transaction } from '../../entities/Transaction';

function makeTx(amount: number, categoryId: string): Transaction {
  return {
    id: `tx-${Math.random()}`,
    familyGroupId: 'fam-1',
    accountId: 'acc-1',
    categoryId,
    createdByUserId: 'usr-1',
    type: 'expense',
    amount,
    currency: 'USD',
    description: 'Test tx',
    merchantName: null,
    transactionDate: '2026-07-28',
    transferToAccountId: null,
    isRecurringInstance: false,
    recurringRuleId: null,
    status: 'confirmed',
    inputMethod: 'manual',
    aiMetadata: null,
    isPrivate: false,
    createdAt: '2026-07-28T00:00:00Z',
    updatedAt: '2026-07-28T00:00:00Z',
    syncedAt: null,
  };
}

describe('DetectAtypicalExpense', () => {
  const detector = new DetectAtypicalExpense();

  it('no marca atípico si hay menos de 3 gastos históricos en la categoría', () => {
    const history = [makeTx(50, 'cat-food'), makeTx(60, 'cat-food')];
    const result = detector.execute(500, 'cat-food', history);

    expect(result.isAtypical).toBe(false);
    expect(result.average).toBe(0);
  });

  it('marca como atípico un gasto que supera el umbral de 2.5x el promedio histórico', () => {
    // Promedio de 100
    const history = [makeTx(100, 'cat-food'), makeTx(100, 'cat-food'), makeTx(100, 'cat-food')];
    // Umbral = 250. Gasto = 300 (3.0x promedio)
    const result = detector.execute(300, 'cat-food', history);

    expect(result.isAtypical).toBe(true);
    expect(result.average).toBe(100);
    expect(result.threshold).toBe(250);
    expect(result.differenceRatio).toBe(3);
  });

  it('no marca atípico si el gasto está por debajo del umbral 2.5x', () => {
    const history = [makeTx(100, 'cat-food'), makeTx(100, 'cat-food'), makeTx(100, 'cat-food')];
    const result = detector.execute(200, 'cat-food', history);

    expect(result.isAtypical).toBe(false);
    expect(result.differenceRatio).toBe(2);
  });
});
