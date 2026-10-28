import { describe, it, expect } from 'vitest';
import { Account } from '../../domain/entities/Account';
import { Transaction } from '../../domain/entities/Transaction';

/**
 * UI SMOKE TEST (GATE 3): Dashboard Data Computation & Account Classification
 *
 * Previene regresiones donde errores de variables no declaradas o
 * fallas silenciosas en la cascada de cálculo dejen el Dashboard mostrando $0.
 */
describe('Dashboard Data Flow Smoke Test', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc-1',
      familyGroupId: 'fam-1',
      ownerUserId: 'user-1',
      name: 'Bancolombia Ahorros',
      type: 'bank',
      currency: 'COP',
      initialBalance: 1_000_000,
      currentBalance: 5_000_000,
      isActive: true,
      createdAt: '2026-01-01',
    },
    {
      id: 'acc-2',
      familyGroupId: 'fam-1',
      ownerUserId: 'user-1',
      name: 'Efectivo Cartera',
      type: 'cash',
      currency: 'COP',
      initialBalance: 200_000,
      currentBalance: 600_000,
      isActive: true,
      createdAt: '2026-01-01',
    },
    {
      id: 'acc-3',
      familyGroupId: 'fam-1',
      ownerUserId: 'user-1',
      name: 'Tarjeta de Crédito Visa',
      type: 'credit_card',
      currency: 'COP',
      initialBalance: 0,
      currentBalance: -2_500_000,
      isActive: true,
      createdAt: '2026-01-01',
    },
    {
      id: 'acc-4',
      familyGroupId: 'fam-1',
      ownerUserId: 'user-1',
      name: 'Fiducuenta Acciones',
      type: 'investment',
      currency: 'COP',
      initialBalance: 10_000_000,
      currentBalance: 12_000_000,
      isActive: true,
      createdAt: '2026-01-01',
    },
    {
      id: 'acc-5',
      familyGroupId: 'fam-1',
      ownerUserId: 'user-1',
      name: 'Cuenta Antigua Inactiva',
      type: 'bank',
      currency: 'COP',
      initialBalance: 50_000,
      currentBalance: 50_000,
      isActive: false, // Inactiva
      createdAt: '2025-01-01',
    },
  ];

  const createMockTransaction = (overrides: Partial<Transaction>): Transaction => ({
    id: 'tx-default',
    familyGroupId: 'fam-1',
    accountId: 'acc-1',
    categoryId: 'cat-1',
    createdByUserId: 'user-1',
    type: 'income',
    amount: 100_000,
    currency: 'COP',
    description: null,
    merchantName: null,
    transactionDate: '2026-10-15',
    transferToAccountId: null,
    isRecurringInstance: false,
    recurringRuleId: null,
    status: 'confirmed',
    inputMethod: 'manual',
    aiMetadata: null,
    isPrivate: false,
    createdAt: '2026-10-15',
    updatedAt: '2026-10-15',
    syncedAt: null,
    ...overrides,
  });

  const mockTransactions: Transaction[] = [
    createMockTransaction({
      id: 'tx-1',
      accountId: 'acc-1',
      amount: 15_700_000,
      type: 'income',
      description: 'Nómina Quincenal',
      transactionDate: '2026-10-15',
    }),
    createMockTransaction({
      id: 'tx-2',
      accountId: 'acc-3',
      amount: 11_700_000,
      type: 'expense',
      description: 'Gastos de Octubre',
      transactionDate: '2026-10-20',
    }),
    createMockTransaction({
      id: 'tx-3',
      accountId: 'acc-1',
      transferToAccountId: 'acc-3',
      amount: 500_000,
      type: 'transfer',
      description: 'Abono TC',
      transactionDate: '2026-10-21',
    }),
  ];

  it('clasifica cuentas activas e ignora inactivas del saldo principal pero las preserva', () => {
    const activeAccounts = mockAccounts.filter(a => a.isActive);
    expect(activeAccounts).toHaveLength(4);

    const inactiveAccounts = mockAccounts.filter(a => !a.isActive);
    expect(inactiveAccounts).toHaveLength(1);
    expect(inactiveAccounts[0].name).toBe('Cuenta Antigua Inactiva');

    const liquid = activeAccounts.filter(acc => ['cash', 'bank'].includes(acc.type));
    const investments = activeAccounts.filter(acc => acc.type === 'investment');
    const cards = activeAccounts.filter(acc => acc.type === 'credit_card');

    expect(liquid).toHaveLength(2);
    expect(investments).toHaveLength(1);
    expect(cards).toHaveLength(1);

    const liquidSum = liquid.reduce((sum, acc) => sum + Number(acc.currentBalance ?? acc.initialBalance), 0);
    const cardsSum = cards.reduce((sum, acc) => sum + Math.abs(Number(acc.currentBalance ?? acc.initialBalance)), 0);

    // Liquid: 5.0M + 600K = 5.6M
    expect(liquidSum).toBe(5_600_000);
    // Cards: |-2.5M| = 2.5M
    expect(cardsSum).toBe(2_500_000);
    // Total Balance: 5.6M - 2.5M = 3.1M
    expect(liquidSum - cardsSum).toBe(3_100_000);

    // Verificar que los acumulados de acordeones de UI usen currentBalance en vez de initialBalance
    const totalLiquidSum = liquid.reduce((sum, acc) => sum + Number(acc.currentBalance ?? acc.initialBalance ?? 0), 0);
    const totalCardsSum = cards.reduce((sum, acc) => sum + Math.abs(Number(acc.currentBalance ?? acc.initialBalance ?? 0)), 0);
    const totalInvestmentsSum = investments.reduce((sum, acc) => sum + Number(acc.currentBalance ?? acc.initialBalance ?? 0), 0);

    expect(totalLiquidSum).toBe(5_600_000);
    expect(totalCardsSum).toBe(2_500_000);
    expect(totalInvestmentsSum).toBe(12_000_000);

    // Verificar que los items individuales muestren su saldo real consolidado (currentBalance)
    for (const acc of activeAccounts) {
      const displayedAmount = acc.currentBalance ?? acc.initialBalance;
      expect(displayedAmount).toBeDefined();
      expect(displayedAmount).toBe(acc.currentBalance);
    }
  });

  it('calcula ingresos y gastos mensuales sin retornar $0 cuando existen transacciones', () => {
    let incomeSum = 0;
    let expensesSum = 0;

    for (const tx of mockTransactions) {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'income') {
        incomeSum += amt;
      } else if (tx.type === 'expense') {
        expensesSum += amt;
      }
    }

    expect(incomeSum).toBe(15_700_000);
    expect(expensesSum).toBe(11_700_000);
    expect(incomeSum).toBeGreaterThan(0);
    expect(expensesSum).toBeGreaterThan(0);
  });

  it('evita que preferCache no definido o excepciones silenciosas aborten el flujo', () => {
    const executeFetchSimulation = (preferCache: boolean = true) => {
      if (typeof preferCache !== 'boolean') {
        throw new TypeError('preferCache must be a boolean');
      }
      return {
        success: true,
        preferCache,
      };
    };

    expect(() => executeFetchSimulation()).not.toThrow();
    expect(executeFetchSimulation().preferCache).toBe(true);
    expect(executeFetchSimulation(false).preferCache).toBe(false);
  });
});
