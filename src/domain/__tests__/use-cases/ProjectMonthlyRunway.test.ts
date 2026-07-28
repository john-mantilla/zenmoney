import { describe, it, expect } from 'vitest';
import { ProjectMonthlyRunway } from '../../usecases/ProjectMonthlyRunway';
import { Transaction } from '../../entities/Transaction';
import { RecurringRule } from '../../entities/RecurringRule';

function makeTx(amount: number, date: string): Transaction {
  return {
    id: `tx-${Math.random()}`,
    familyGroupId: 'fam-1',
    accountId: 'acc-1',
    categoryId: 'cat-food',
    createdByUserId: 'usr-1',
    type: 'expense',
    amount,
    currency: 'USD',
    description: null,
    merchantName: null,
    transactionDate: date,
    transferToAccountId: null,
    isRecurringInstance: false,
    recurringRuleId: null,
    status: 'confirmed',
    inputMethod: 'manual',
    aiMetadata: null,
    isPrivate: false,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    syncedAt: null,
  };
}

function makeRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 'rec-1',
    familyGroupId: 'fam-1',
    accountId: 'acc-1',
    categoryId: 'cat-income',
    type: 'income',
    amount: 1500,
    description: 'Nómina',
    frequency: 'monthly',
    dayOfMonth: 15,
    startDate: '2026-01-01',
    endDate: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('ProjectMonthlyRunway', () => {
  const projector = new ProjectMonthlyRunway();

  it('calcula la velocidad de gasto orgánico y el saldo proyectado', () => {
    const txs = Array.from({ length: 10 }, (_, i) => makeTx(100, `2026-07-0${i + 1}`));
    const rules: RecurringRule[] = [];

    const projection = projector.execute(3000, txs, rules, '2026-07-10');

    expect(projection.currentBalance).toBe(3000);
    expect(projection.spendingVelocity).toBe(100);
    expect(projection.daysRemaining).toBe(21);
    expect(projection.projectedOrganicSpending).toBe(2100);
    expect(projection.projectedBalance).toBe(900);
    expect(projection.isAtRisk).toBe(false);
  });

  it('alerta riesgo (isAtRisk = true) si el saldo proyectado es menor a cero', () => {
    const txs = Array.from({ length: 10 }, (_, i) => makeTx(200, `2026-07-0${i + 1}`));
    const projection = projector.execute(1000, txs, [], '2026-07-10');

    expect(projection.spendingVelocity).toBe(200);
    expect(projection.projectedOrganicSpending).toBe(4200);
    expect(projection.projectedBalance).toBe(-3200);
    expect(projection.isAtRisk).toBe(true);
  });

  it('proyecta ocurrencias futuras de reglas recurrentes de ingreso y gasto', () => {
    const txs = [makeTx(100, '2026-07-01')];
    const rules: RecurringRule[] = [
      makeRule({ type: 'income', amount: 1500, dayOfMonth: 15, startDate: '2026-01-01' }),
      makeRule({ type: 'expense', amount: 300, dayOfMonth: 20, startDate: '2026-01-01' }),
      makeRule({ type: 'expense', amount: 50, frequency: 'daily', startDate: '2026-01-01' }),
      makeRule({ type: 'expense', amount: 100, frequency: 'weekly', startDate: '2026-07-01' }),
      makeRule({ type: 'expense', amount: 200, frequency: 'biweekly', startDate: '2026-07-01' }),
      makeRule({ type: 'expense', amount: 500, frequency: 'yearly', startDate: '2026-07-25' }),
      makeRule({ isActive: false, type: 'income', amount: 5000 }), // Regla inactiva (ignorada)
      makeRule({ type: 'expense', amount: 100, endDate: '2026-07-05', startDate: '2026-01-01' }), // Finalizada (ignorada)
    ];

    const projection = projector.execute(2000, txs, rules, '2026-07-10');

    expect(projection.remainingRecurrencesNet).not.toBe(0);
    expect(projection.currentBalance).toBe(2000);
  });
});
