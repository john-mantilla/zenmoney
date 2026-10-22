import { describe, it, expect } from 'vitest';
import { SimulateFinancialScenarioUseCase } from '../../usecases/SimulateFinancialScenarioUseCase';
import { ForecastCashFlowUseCase } from '../../usecases/ForecastCashFlowUseCase';
import { Account } from '../../entities/Account';
import { LoanScenarioInput } from '../../entities/LoanScenario';

describe('SimulateFinancialScenarioUseCase', () => {
  const forecastUseCase = new ForecastCashFlowUseCase();
  const simulator = new SimulateFinancialScenarioUseCase();

  const mockAccounts: Account[] = [
    {
      id: 'acc-1',
      familyGroupId: 'fam-1',
      ownerUserId: 'user-1',
      name: 'Banco',
      type: 'bank',
      initialBalance: 0,
      currentBalance: 3000000,
      currency: 'COP',
      isActive: true,
      createdAt: '2026-01-01',
    },
  ];

  it('simula una compra a cuotas con tarjeta de crédito sin desembolso inicial', () => {
    const baseForecast = forecastUseCase.execute(mockAccounts, [], [], {
      horizonDays: 90,
      spendingMode: 'commitments_only',
      todayStr: '2026-11-01',
    });

    const scenario: LoanScenarioInput = {
      name: 'Compra Nevera',
      type: 'card_purchase',
      principal: 1200000,
      months: 6,
      interestRate: 0, // 0% interés
      rateType: 'EM',
      startDate: '2026-11-01',
    };

    const comparison = simulator.execute(baseForecast, scenario);

    expect(comparison.monthlyInstallment).toBe(200000);
    expect(comparison.totalInterestPaid).toBe(0);
    expect(comparison.totalPaid).toBe(1200000);

    // En los primeros 90 días (del 1 nov al 30 ene) entran 2 cuotas (1 dic y 1 ene) = -400.000
    // Saldo inicial 3.000.000 - 400.000 = 2.600.000 al día 90
    expect(comparison.endingSimulatedBalance).toBe(2600000);
    expect(comparison.causesNewDeficit).toBe(false);
  });

  it('simula un crédito con desembolso inicial e identifica si causa nuevo déficit', () => {
    // Cuenta con saldo inicial bajo: 500.000
    const lowAccount: Account = {
      ...mockAccounts[0],
      currentBalance: 500000,
    };

    const baseForecast = forecastUseCase.execute([lowAccount], [], [], {
      horizonDays: 60,
      spendingMode: 'commitments_only',
      todayStr: '2026-11-01',
    });

    // Compra con tarjeta por 2.000.000 a 2 cuotas de 1.000.000 (sin desembolso)
    const scenario: LoanScenarioInput = {
      name: 'Gasto Mayor',
      type: 'card_purchase',
      principal: 2000000,
      months: 2,
      interestRate: 0,
      rateType: 'EM',
      startDate: '2026-11-01',
    };

    const comparison = simulator.execute(baseForecast, scenario);

    // 500.000 - 1.000.000 (cuota 1 en dic) = -500.000 -> causa nuevo déficit
    expect(comparison.causesNewDeficit).toBe(true);
    expect(comparison.deficitDate).toBeDefined();
    expect(comparison.minimumSimulatedBalance).toBeLessThan(0);
  });

  it('calcula la cuota con tasa Efectiva Anual (E.A.) para crédito de libre inversión', () => {
    const baseForecast = forecastUseCase.execute(mockAccounts, [], [], {
      horizonDays: 180,
      spendingMode: 'commitments_only',
      todayStr: '2026-11-01',
    });

    const scenario: LoanScenarioInput = {
      name: 'Préstamo Remodelación',
      type: 'loan',
      principal: 5000000,
      months: 12,
      interestRate: 26.824, // ≈ 2% EM
      rateType: 'EA',
      startDate: '2026-11-01',
    };

    const comparison = simulator.execute(baseForecast, scenario);

    // Cuota esperada cerca de 472.798
    expect(comparison.monthlyInstallment).toBeCloseTo(472798, -2);
    expect(comparison.totalPaid).toBeGreaterThan(5000000);
    expect(comparison.totalInterestPaid).toBeGreaterThan(0);
    // Como es préstamo, el saldo en el día 0 incluye el capital desembolsado
    expect(comparison.simulatedPoints[0].closingBalance).toBe(3000000 + 5000000);
  });
});
