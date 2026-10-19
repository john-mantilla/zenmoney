import { describe, it, expect } from 'vitest';
import { getImputedAmountForCategoryInMonth } from '../../utils/budgetUtils';
import { Transaction } from '../../entities/Transaction';
import { AtomicPacingService } from '../../services/AtomicPacingService';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    familyGroupId: 'fam-1',
    accountId: 'acc-1',
    categoryId: 'cat-main',
    createdByUserId: 'usr-1',
    type: 'expense',
    amount: 100,
    currency: 'USD',
    description: null,
    merchantName: null,
    transactionDate: '2026-05-10',
    transferToAccountId: null,
    isRecurringInstance: false,
    recurringRuleId: null,
    status: 'confirmed',
    inputMethod: 'manual',
    aiMetadata: null,
    isPrivate: false,
    createdAt: '2026-05-10T00:00:00Z',
    updatedAt: '2026-05-10T00:00:00Z',
    syncedAt: null,
    ...overrides,
  };
}

describe('getImputedAmountForCategoryInMonth', () => {
  it('retorna el monto completo si coincide la categoría y el mes para gasto regular', () => {
    const tx = makeTx({ amount: 250, categoryId: 'cat-groceries', transactionDate: '2026-05-15' });
    const amount = getImputedAmountForCategoryInMonth(tx, 'cat-groceries', '2026-05');
    expect(amount).toBe(250);
  });

  it('retorna 0 si el mes no coincide para gasto regular', () => {
    const tx = makeTx({ amount: 250, categoryId: 'cat-groceries', transactionDate: '2026-05-15' });
    const amount = getImputedAmountForCategoryInMonth(tx, 'cat-groceries', '2026-06');
    expect(amount).toBe(0);
  });

  it('retorna 0 si la categoría no coincide', () => {
    const tx = makeTx({ amount: 250, categoryId: 'cat-groceries', transactionDate: '2026-05-15' });
    const amount = getImputedAmountForCategoryInMonth(tx, 'cat-rent', '2026-05');
    expect(amount).toBe(0);
  });

  it('procesa splits de múltiples categorías correctamente sumando solo la categoría objetivo', () => {
    const tx = makeTx({
      amount: 300000,
      categoryId: null,
      transactionDate: '2026-10-15',
      splits: [
        { id: 's1', categoryId: 'cat-market', amount: 200000 },
        { id: 's2', categoryId: 'cat-home', amount: 60000 },
        { id: 's3', categoryId: 'cat-pets', amount: 40000 },
      ],
    });

    expect(getImputedAmountForCategoryInMonth(tx, 'cat-market', '2026-10')).toBe(200000);
    expect(getImputedAmountForCategoryInMonth(tx, 'cat-home', '2026-10')).toBe(60000);
    expect(getImputedAmountForCategoryInMonth(tx, 'cat-pets', '2026-10')).toBe(40000);
    expect(getImputedAmountForCategoryInMonth(tx, 'cat-other', '2026-10')).toBe(0);
  });

  it('soporta targetCategoryIds como Set o Array para categoría padre y subcategorías', () => {
    const tx = makeTx({
      amount: 300000,
      categoryId: null,
      transactionDate: '2026-10-15',
      splits: [
        { id: 's1', categoryId: 'cat-market', amount: 200000 },
        { id: 's2', categoryId: 'cat-home', amount: 60000 },
        { id: 's3', categoryId: 'cat-pets', amount: 40000 },
      ],
    });

    const combinedSet = new Set(['cat-home', 'cat-pets']);
    expect(getImputedAmountForCategoryInMonth(tx, combinedSet, '2026-10')).toBe(100000);
  });

  it('imputa la alícuota mensual cuando tiene periodSplit y el mes evaluado está dentro del rango', () => {
    const tx = makeTx({
      amount: 1200000,
      categoryId: 'cat-insurance',
      transactionDate: '2026-01-15',
      periodSplit: {
        totalMonths: 12,
        monthlyAmount: 100000,
        startMonth: '2026-01',
        endMonth: '2026-12',
        accountFlowDate: '2026-01-15',
      },
    });

    expect(getImputedAmountForCategoryInMonth(tx, 'cat-insurance', '2026-01')).toBe(100000);
    expect(getImputedAmountForCategoryInMonth(tx, 'cat-insurance', '2026-06')).toBe(100000);
    expect(getImputedAmountForCategoryInMonth(tx, 'cat-insurance', '2026-12')).toBe(100000);
    expect(getImputedAmountForCategoryInMonth(tx, 'cat-insurance', '2027-01')).toBe(0);
  });

  it('combina periodSplit y splits prorrateando proporcionalmente cada categoría', () => {
    const tx = makeTx({
      amount: 1200000,
      categoryId: null,
      transactionDate: '2026-01-15',
      splits: [
        { id: 's1', categoryId: 'cat-insurance', amount: 900000 }, // 75%
        { id: 's2', categoryId: 'cat-service', amount: 300000 },   // 25%
      ],
      periodSplit: {
        totalMonths: 12,
        monthlyAmount: 100000, // Total mensual
        startMonth: '2026-01',
        endMonth: '2026-12',
        accountFlowDate: '2026-01-15',
      },
    });

    expect(getImputedAmountForCategoryInMonth(tx, 'cat-insurance', '2026-05')).toBe(75000);
    expect(getImputedAmountForCategoryInMonth(tx, 'cat-service', '2026-05')).toBe(25000);
  });

  it('protege el cálculo de Safe-to-Spend en AtomicPacingService evitando el estado exhausted en mes inicial', () => {
    const monthlyBudgetLimit = 150000;
    const testDate = new Date(2026, 0, 10); // 10 de Enero 2026
    
    // Gasto de seguro anual de 1.200.000 pagado el 5 de enero amortizado en 12 meses
    const tx = makeTx({
      amount: 1200000,
      categoryId: 'cat-insurance',
      transactionDate: '2026-01-05',
      periodSplit: {
        totalMonths: 12,
        monthlyAmount: 100000,
        startMonth: '2026-01',
        endMonth: '2026-12',
        accountFlowDate: '2026-01-05',
      },
    });

    const imputedSpent = getImputedAmountForCategoryInMonth(tx, 'cat-insurance', '2026-01');
    expect(imputedSpent).toBe(100000);

    const safeToSpend = AtomicPacingService.calculateSafeToSpend(
      monthlyBudgetLimit,
      imputedSpent,
      testDate,
      { enableWeekendWeight: false }
    );

    expect(safeToSpend.remainingBudget).toBe(50000);
    expect(safeToSpend.pacingStatus).not.toBe('exhausted');
    expect(safeToSpend.dailySafeToSpend).toBeGreaterThan(0);
  });
});
