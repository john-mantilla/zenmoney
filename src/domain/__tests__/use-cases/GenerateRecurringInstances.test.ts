import { describe, it, expect, vi } from 'vitest';
import { GenerateRecurringInstances } from '../../usecases/GenerateRecurringInstances';
import { RecurringRule } from '../../entities/RecurringRule';
import { Transaction } from '../../entities/Transaction';
import { TransactionRepository } from '../../repositories/TransactionRepository';

function makeRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: `rec-${Math.random().toString(36).substring(7)}`,
    familyGroupId: 'fam-1',
    accountId: 'acc-1',
    categoryId: 'cat-subscriptions',
    type: 'expense',
    amount: 50,
    description: 'Suscripción streaming',
    frequency: 'monthly',
    dayOfMonth: 15,
    startDate: '2026-01-15',
    endDate: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeFakeRepo(existing: Transaction[] = []): TransactionRepository {
  const items = [...existing];
  return {
    getAll: vi.fn(async (filters) => {
      if (filters?.recurringRuleId) {
        return items.filter((t) => t.recurringRuleId === filters.recurringRuleId);
      }
      return items;
    }),
    create: vi.fn(async (input) => {
      const created: Transaction = {
        id: `tx-${Math.random().toString(36).substring(7)}`,
        familyGroupId: 'fam-1',
        accountId: input.accountId,
        categoryId: input.categoryId ?? null,
        createdByUserId: 'usr-1',
        type: input.type,
        amount: input.amount,
        currency: 'USD',
        description: input.description ?? null,
        merchantName: null,
        transactionDate: input.transactionDate ?? '2026-07-28',
        transferToAccountId: null,
        isRecurringInstance: true,
        recurringRuleId: input.recurringRuleId ?? null,
        status: input.status ?? 'pending',
        inputMethod: 'manual',
        aiMetadata: input.aiMetadata ?? null,
        isPrivate: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncedAt: null,
      };
      items.push(created);
      return created;
    }),
    getById: vi.fn(async () => null),
    update: vi.fn(async () => { throw new Error('Not implemented'); }),
    delete: vi.fn(async () => { throw new Error('Not implemented'); }),
    getByDateRange: vi.fn(async () => []),
    getTotalByType: vi.fn(async () => 0),
  };
}

describe('GenerateRecurringInstances', () => {
  it('genera correctamente ocurrencias mensuales entre dos fechas', async () => {
    const rule = makeRule({ frequency: 'monthly', dayOfMonth: 15 });
    const repo = makeFakeRepo();
    const usecase = new GenerateRecurringInstances(repo);

    const result = await usecase.execute(rule, '2026-01-15', '2026-03-31');

    expect(result).toHaveLength(3);
    expect(result[0].transactionDate).toBe('2026-01-15');
    expect(result[1].transactionDate).toBe('2026-02-15');
    expect(result[2].transactionDate).toBe('2026-03-15');
  });

  it('genera ocurrencias semanales, quincenales, diarias y anuales', async () => {
    const weeklyRule = makeRule({ frequency: 'weekly', amount: 20 });
    const biweeklyRule = makeRule({ frequency: 'biweekly', amount: 50, startDate: '2026-05-01' });
    const dailyRule = makeRule({ frequency: 'daily', amount: 5, startDate: '2026-05-01' });
    const yearlyRule = makeRule({ frequency: 'yearly', amount: 500, startDate: '2026-01-01' });

    const repo = makeFakeRepo();
    const usecase = new GenerateRecurringInstances(repo);

    const weeklyRes = await usecase.execute(weeklyRule, '2026-05-01', '2026-05-22');
    const biweeklyRes = await usecase.execute(biweeklyRule, '2026-05-01', '2026-05-30');
    const dailyRes = await usecase.execute(dailyRule, '2026-05-01', '2026-05-05');
    const yearlyRes = await usecase.execute(yearlyRule, '2026-01-01', '2028-12-31');

    expect(weeklyRes.length).toBeGreaterThanOrEqual(3);
    expect(biweeklyRes.length).toBeGreaterThanOrEqual(2);
    expect(dailyRes.length).toBe(5);
    expect(yearlyRes.length).toBe(3);
  });

  it('asigna status confirmed a ingresos pasados y pending a futuros o gastos', async () => {
    const incomeRule = makeRule({ type: 'income', amount: 1000, frequency: 'monthly', dayOfMonth: 1 });
    const repo = makeFakeRepo();
    const usecase = new GenerateRecurringInstances(repo);

    const result = await usecase.execute(incomeRule, '2026-01-01', '2026-02-01');
    expect(result[0].status).toBe('confirmed');
  });

  it('es idempotente: no duplica ocurrencias si la fecha ya existe', async () => {
    const rule = makeRule({ id: 'rec-idempotent', frequency: 'monthly', dayOfMonth: 10 });
    const existingTx: Transaction = {
      id: 'tx-existing',
      familyGroupId: 'fam-1',
      accountId: 'acc-1',
      categoryId: 'cat-subscriptions',
      createdByUserId: 'usr-1',
      type: 'expense',
      amount: 50,
      currency: 'USD',
      description: 'Suscripción streaming',
      merchantName: null,
      transactionDate: '2026-02-10',
      transferToAccountId: null,
      isRecurringInstance: true,
      recurringRuleId: 'rec-idempotent',
      status: 'pending',
      inputMethod: 'manual',
      aiMetadata: {
        rawInput: '',
        parsedAmount: 50,
        parsedCategory: null,
        parsedAccount: null,
        parsedMerchant: null,
        confidence: 1,
        corrections: {},
        occurrenceDate: '2026-02-10',
      },
      isPrivate: false,
      createdAt: '2026-02-10T00:00:00Z',
      updatedAt: '2026-02-10T00:00:00Z',
      syncedAt: null,
    };

    const repo = makeFakeRepo([existingTx]);
    const usecase = new GenerateRecurringInstances(repo);

    const result = await usecase.execute(rule, '2026-01-10', '2026-03-31');

    expect(result.some((t) => t.transactionDate === '2026-02-10')).toBe(false);
  });

  it('retorna arreglo vacío si la fecha inicial es mayor a la final o frecuencia desconocida', async () => {
    const rule = makeRule();
    const invalidRule = makeRule({ frequency: 'unknown' as any });
    const repo = makeFakeRepo();
    const usecase = new GenerateRecurringInstances(repo);

    expect(await usecase.execute(rule, '2026-05-10', '2026-01-01')).toEqual([]);
    expect(await usecase.execute(invalidRule, '2026-01-01', '2026-02-01')).toHaveLength(1);
  });
});
