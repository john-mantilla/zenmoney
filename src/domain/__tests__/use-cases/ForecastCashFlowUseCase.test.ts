import { describe, it, expect } from 'vitest';
import { ForecastCashFlowUseCase } from '../../usecases/ForecastCashFlowUseCase';
import { Account } from '../../entities/Account';
import { Transaction } from '../../entities/Transaction';
import { RecurringRule } from '../../entities/RecurringRule';

describe('ForecastCashFlowUseCase', () => {
  const useCase = new ForecastCashFlowUseCase();

  const mockAccounts: Account[] = [
    {
      id: 'acc-bank',
      familyGroupId: 'fam-1',
      ownerUserId: 'user-1',
      name: 'Bancolombia Ahorros',
      type: 'bank',
      initialBalance: 0,
      currentBalance: 2500000,
      currency: 'COP',
      isActive: true,
      createdAt: '2026-01-01',
    },
    {
      id: 'acc-cash',
      familyGroupId: 'fam-1',
      ownerUserId: 'user-1',
      name: 'Billetera Efectivo',
      type: 'cash',
      initialBalance: 0,
      currentBalance: 300000,
      currency: 'COP',
      isActive: true,
      createdAt: '2026-01-01',
    },
    {
      id: 'acc-credit',
      familyGroupId: 'fam-1',
      ownerUserId: 'user-1',
      name: 'Tarjeta Visa',
      type: 'credit_card',
      initialBalance: 0,
      currentBalance: -1200000,
      currency: 'COP',
      isActive: true,
      createdAt: '2026-01-01',
    },
    {
      id: 'acc-inactive',
      familyGroupId: 'fam-1',
      ownerUserId: 'user-1',
      name: 'Cuenta Cerrada',
      type: 'bank',
      initialBalance: 0,
      currentBalance: 500000,
      currency: 'COP',
      isActive: false,
      createdAt: '2026-01-01',
    },
  ];

  it('calcula la liquidez inicial sumando solo cuentas de efectivo y banco activas', () => {
    const forecast = useCase.execute(mockAccounts, [], [], {
      horizonDays: 30,
      spendingMode: 'commitments_only',
      todayStr: '2026-11-01',
    });

    // 2.500.000 (banco) + 300.000 (efectivo) = 2.800.000 (omitiendo TDC e inactiva)
    expect(forecast.initialLiquidity).toBe(2800000);
    expect(forecast.points.length).toBe(31); // día 0 + 30 días
    expect(forecast.endingBalance).toBe(2800000);
    expect(forecast.isAtRisk).toBe(false);
  });

  it('proyecta facturas pendientes y reglas recurrentes en el horizonte', () => {
    const pendingTxs: Transaction[] = [
      {
        id: 'tx-pending-1',
        familyGroupId: 'fam-1',
        creatorUserId: 'user-1',
        accountId: 'acc-bank',
        type: 'expense',
        amount: 800000,
        description: 'Arriendo',
        transactionDate: '2026-11-05',
        status: 'pending',
        currency: 'COP',
        createdAt: '2026-10-25',
      },
    ];

    const recurringRules: RecurringRule[] = [
      {
        id: 'rule-salary',
        familyGroupId: 'fam-1',
        accountId: 'acc-bank',
        categoryId: null,
        type: 'income',
        amount: 2000000,
        description: 'Salario Quincenal',
        frequency: 'biweekly',
        dayOfMonth: null,
        startDate: '2026-11-15',
        endDate: null,
        isActive: true,
        createdAt: '2026-10-01',
      },
    ];

    const forecast = useCase.execute(mockAccounts, pendingTxs, recurringRules, {
      horizonDays: 30,
      spendingMode: 'commitments_only',
      todayStr: '2026-11-01',
    });

    // Initial: 2.800.000
    // Día 5: -800.000 -> 2.000.000
    // Día 15 (2026-11-15): +2.000.000 -> 4.000.000
    // Día 29 (2026-11-29): +2.000.000 -> 6.000.000
    expect(forecast.totalOutflows).toBe(800000);
    expect(forecast.totalInflows).toBeGreaterThanOrEqual(2000000);
    expect(forecast.endingBalance).toBeGreaterThan(2800000);
    expect(forecast.minimumBalance).toBe(2000000);
  });

  it('detecta quiebre de liquidez temprano cuando el saldo proyectado cae por debajo de cero', () => {
    const bigBill: Transaction = {
      id: 'tx-big',
      familyGroupId: 'fam-1',
      creatorUserId: 'user-1',
      accountId: 'acc-bank',
      type: 'expense',
      amount: 3500000, // Mayor a la liquidez de 2.800.000
      description: 'Pago Deuda Mayor',
      transactionDate: '2026-11-10',
      status: 'pending',
      currency: 'COP',
      createdAt: '2026-10-25',
    };

    const forecast = useCase.execute(mockAccounts, [bigBill], [], {
      horizonDays: 60,
      spendingMode: 'commitments_only',
      todayStr: '2026-11-01',
    });

    expect(forecast.isAtRisk).toBe(true);
    expect(forecast.deficitDate).toBe('2026-11-10');
    expect(forecast.daysToDeficit).toBe(9); // Del 1 al 10 de nov son 9 días
    expect(forecast.minimumBalance).toBe(-700000);
  });

  it('deduce velocidad de gasto diario orgánico en modo total_projected', () => {
    const forecast = useCase.execute(mockAccounts, [], [], {
      horizonDays: 30,
      spendingMode: 'total_projected',
      dailyOrganicSpendingRate: 50000, // 50k por día
      todayStr: '2026-11-01',
    });

    // 2.800.000 - (50.000 * 30) = 1.300.000
    expect(forecast.totalOrganicSpending).toBe(1500000);
    expect(forecast.endingBalance).toBe(1300000);
  });
});
