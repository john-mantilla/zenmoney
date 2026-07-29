import { describe, it, expect } from 'vitest';
import { Evaluate7DayChallenge } from '../../usecases/Evaluate7DayChallenge';
import { Transaction } from '../../entities/Transaction';

describe('Evaluate7DayChallenge', () => {

  const createMockTx = (dateStr: string): Transaction => ({
    id: `tx-${dateStr}`,
    familyGroupId: 'fam-1',
    accountId: 'acc-1',
    categoryId: 'cat-1',
    createdByUserId: 'user-1',
    type: 'expense',
    amount: 50000,
    currency: 'COP',
    description: 'Gasto prueba',
    merchantName: null,
    transactionDate: dateStr,
    transferToAccountId: null,
    isRecurringInstance: false,
    recurringRuleId: null,
    status: 'confirmed',
    inputMethod: 'manual',
    aiMetadata: null,
    isPrivate: false,
    createdAt: '',
    updatedAt: '',
    syncedAt: null,
  });

  it('evalúa correctamente los días completados en la ventana de 7 días', () => {
    const txs: Transaction[] = [
      createMockTx('2026-07-23'),
      createMockTx('2026-07-24'),
      createMockTx('2026-07-25'),
      createMockTx('2026-07-26'),
      createMockTx('2026-07-27'),
    ];

    const challenge = Evaluate7DayChallenge.execute(txs, '2026-07-29', 'user-1');

    expect(challenge.targetDays).toBe(7);
    expect(challenge.completedDays).toBe(5);
    expect(challenge.status).toBe('active');
    expect(challenge.days).toHaveLength(7);
    expect(challenge.days[6].isToday).toBe(true);
  });

  it('marca el desafío como completado cuando los 7 días tienen registros', () => {
    const dates = [
      '2026-07-23',
      '2026-07-24',
      '2026-07-25',
      '2026-07-26',
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
    ];
    const txs = dates.map(createMockTx);

    const challenge = Evaluate7DayChallenge.execute(txs, '2026-07-29', 'user-1');

    expect(challenge.completedDays).toBe(7);
    expect(challenge.status).toBe('completed');
  });

});
