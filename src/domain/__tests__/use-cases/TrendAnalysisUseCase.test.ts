import { describe, it, expect, vi } from 'vitest';
import { TrendAnalysisUseCase } from '../../usecases/TrendAnalysisUseCase';
import { Transaction } from '../../entities/Transaction';
import { Budget } from '../../entities/Budget';

function makeTx(type: 'income' | 'expense', amount: number, dateStr: string): Transaction {
  return {
    id: `tx-${Math.random()}`,
    familyGroupId: 'fam-1',
    accountId: 'acc-1',
    categoryId: 'cat-1',
    createdByUserId: 'usr-1',
    type,
    amount,
    currency: 'USD',
    description: null,
    merchantName: null,
    transactionDate: dateStr,
    transferToAccountId: null,
    isRecurringInstance: false,
    recurringRuleId: null,
    status: 'confirmed',
    inputMethod: 'manual',
    aiMetadata: null,
    isPrivate: false,
    createdAt: `${dateStr}T00:00:00Z`,
    updatedAt: `${dateStr}T00:00:00Z`,
    syncedAt: null,
  };
}

describe('TrendAnalysisUseCase', () => {
  it('genera 12 puntos de tendencia mensual agregando ingresos, gastos y presupuestos', async () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthStr = String(today.getMonth() + 1).padStart(2, '0');
    const currentDate = `${currentYear}-${currentMonthStr}-15`;

    const txs: Transaction[] = [
      makeTx('income', 2000, currentDate),
      makeTx('expense', 400, currentDate),
    ];

    const fakeTxRepo = {
      getAll: vi.fn(async () => txs),
    } as any;

    const fakeBudgetRepo = {
      getByMonth: vi.fn(async (year: number, month: number) => [
        {
          id: 'b-1',
          familyGroupId: 'fam-1',
          categoryId: 'cat-1',
          amountLimit: 1000,
          year,
          month,
          scope: 'family',
          ownerUserId: null,
          createdAt: '2026-01-01T00:00:00Z',
        } as Budget,
      ]),
    } as any;

    const usecase = new TrendAnalysisUseCase(fakeTxRepo, fakeBudgetRepo);
    const points = await usecase.execute();

    expect(points).toHaveLength(12);

    const currentPoint = points.find((p) => p.fullDate === `${currentYear}-${currentMonthStr}`);
    expect(currentPoint).toBeDefined();
    expect(currentPoint?.income).toBe(2000);
    expect(currentPoint?.expense).toBe(400);
    expect(currentPoint?.budget).toBe(1000);
  });
});
