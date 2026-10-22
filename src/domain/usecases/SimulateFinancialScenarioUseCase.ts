/**
 * ZenMoney — Caso de Uso: SimulateFinancialScenarioUseCase
 *
 * Motor de Simulación What-If en Memoria.
 * Superpone el impacto de un crédito o compra financiada sobre la curva de pronóstico base.
 */

import { CashFlowForecast, DailyLiquidityPoint, ForecastDayEvent } from '../entities/CashFlowForecast';
import { LoanScenarioInput, ScenarioComparison } from '../entities/LoanScenario';
import {
  annualEffectiveToMonthlyRate,
  normalizeMonthlyRate,
  generateAmortizationSchedule,
} from '../utils/financialMath';

export class SimulateFinancialScenarioUseCase {
  execute(
    baseForecast: CashFlowForecast,
    scenario: LoanScenarioInput,
    reserveThreshold: number = 0
  ): ScenarioComparison {
    // 1. Determinar tasa periódica mensual
    const monthlyRate =
      scenario.rateType === 'EA'
        ? annualEffectiveToMonthlyRate(scenario.interestRate)
        : normalizeMonthlyRate(scenario.interestRate);

    // 2. Generar cronograma de amortización
    const startStr = scenario.startDate || (baseForecast.points[0]?.date ?? new Date().toISOString().split('T')[0]);
    const amortization = generateAmortizationSchedule(
      scenario.principal,
      monthlyRate,
      scenario.months,
      startStr
    );

    // 3. Mapear eventos simulados por fecha
    const simulatedInflowsByDate = new Map<string, number>();
    const simulatedOutflowsByDate = new Map<string, number>();
    const simulatedEventsByDate = new Map<string, ForecastDayEvent[]>();

    // Si es préstamo de liquidez, inyectamos el capital en startDate
    if (scenario.type === 'loan') {
      simulatedInflowsByDate.set(startStr, (simulatedInflowsByDate.get(startStr) || 0) + scenario.principal);
      const evList = simulatedEventsByDate.get(startStr) || [];
      evList.push({
        description: `Desembolso Crédito: ${scenario.name}`,
        amount: scenario.principal,
        type: 'income',
        source: 'recurrence',
      });
      simulatedEventsByDate.set(startStr, evList);
    }

    // Cuotas mensuales de amortización
    for (const row of amortization.schedule) {
      simulatedOutflowsByDate.set(row.dueDate, (simulatedOutflowsByDate.get(row.dueDate) || 0) + row.installment);
      const evList = simulatedEventsByDate.get(row.dueDate) || [];
      evList.push({
        description: `Cuota ${row.monthIndex}/${amortization.months}: ${scenario.name}`,
        amount: row.installment,
        type: 'expense',
        source: 'bill',
      });
      simulatedEventsByDate.set(row.dueDate, evList);
    }

    // 4. Reconstruir serie temporal diaria simulada
    const simulatedPoints: DailyLiquidityPoint[] = [];
    let currentClosing = baseForecast.initialLiquidity;
    let minSimulatedBalance = baseForecast.initialLiquidity;
    let deficitDate: string | null = null;
    let daysToDeficit: number | null = null;

    for (let i = 0; i < baseForecast.points.length; i++) {
      const basePoint = baseForecast.points[i];
      const extraInflows = simulatedInflowsByDate.get(basePoint.date) || 0;
      const extraOutflows = simulatedOutflowsByDate.get(basePoint.date) || 0;
      const extraEvents = simulatedEventsByDate.get(basePoint.date) || [];

      let opening = i === 0 ? baseForecast.initialLiquidity : currentClosing;
      if (i === 0 && scenario.type === 'loan' && basePoint.date === startStr) {
        // En el día 0, si coincide con el inicio del préstamo, se suma al saldo
        currentClosing = opening + extraInflows;
      }

      const totalInflows = basePoint.inflows + (i === 0 ? 0 : extraInflows);
      const totalOutflows = basePoint.outflows + extraOutflows;
      const netChange = totalInflows - totalOutflows - basePoint.organicSpending;

      if (i > 0) {
        currentClosing = Math.round(opening + netChange);
      }

      if (currentClosing < minSimulatedBalance) {
        minSimulatedBalance = currentClosing;
      }

      if (currentClosing < reserveThreshold && deficitDate === null) {
        deficitDate = basePoint.date;
        daysToDeficit = basePoint.dayIndex;
      }

      simulatedPoints.push({
        date: basePoint.date,
        dayIndex: basePoint.dayIndex,
        openingBalance: opening,
        inflows: totalInflows,
        outflows: totalOutflows,
        organicSpending: basePoint.organicSpending,
        closingBalance: currentClosing,
        netChange,
        events: [...basePoint.events, ...extraEvents],
      });
    }

    const causesNewDeficit = deficitDate !== null && !baseForecast.isAtRisk;
    const endingSimulatedBalance = simulatedPoints[simulatedPoints.length - 1]?.closingBalance ?? currentClosing;
    const netImpactOnLiquidity = endingSimulatedBalance - baseForecast.endingBalance;

    return {
      scenario,
      baseForecast,
      simulatedPoints,
      monthlyInstallment: amortization.monthlyInstallment,
      totalInterestPaid: amortization.totalInterest,
      totalPaid: amortization.totalPaid,
      endingSimulatedBalance,
      minimumSimulatedBalance: minSimulatedBalance,
      causesNewDeficit,
      deficitDate,
      daysToDeficit,
      netImpactOnLiquidity,
    };
  }
}
