/**
 * ZenMoney — Caso de Uso: ForecastCashFlowUseCase
 *
 * Motor de pronóstico diario de liquidez a 30, 60, 90 y 180 días.
 * Cruza la liquidez inicial real con facturas pendientes, reglas recurrentes
 * y velocidad de gasto orgánico.
 */

import { Account } from '../entities/Account';
import { Transaction } from '../entities/Transaction';
import { RecurringRule } from '../entities/RecurringRule';
import {
  CashFlowForecast,
  DailyLiquidityPoint,
  ForecastOptions,
  ForecastDayEvent,
} from '../entities/CashFlowForecast';

export class ForecastCashFlowUseCase {
  /**
   * Ejecuta la proyección del flujo de caja.
   */
  execute(
    accounts: Account[],
    pendingTransactions: Transaction[],
    activeRecurringRules: RecurringRule[],
    options: ForecastOptions
  ): CashFlowForecast {
    const horizonDays = options.horizonDays || 30;
    const spendingMode = options.spendingMode || 'commitments_only';
    const reserveThreshold = options.minimumReserveThreshold ?? 0;
    const todayStr = options.todayStr || new Date().toISOString().split('T')[0];
    const organicDailyRate = options.dailyOrganicSpendingRate ?? 0;

    // 1. Calcular la Liquidez Consolidada Inicial (efectivo + bancos operativos)
    const liquidAccounts = accounts.filter(
      (acc) => acc.isActive !== false && ['cash', 'bank'].includes(acc.type)
    );
    const initialLiquidity = liquidAccounts.reduce((sum, acc) => {
      const bal = acc.currentBalance !== undefined && acc.currentBalance !== null
        ? Number(acc.currentBalance)
        : Number(acc.initialBalance || 0);
      return sum + bal;
    }, 0);

    // 2. Indexar facturas pendientes por fecha para búsqueda O(1)
    const pendingByDate = new Map<string, Transaction[]>();
    const existingRuleDates = new Set<string>(); // para evitar doble contabilización con reglas recurrentes

    for (const tx of pendingTransactions) {
      if (tx.status !== 'pending') continue;
      const txDate =
        tx.aiMetadata?.dueDate ||
        tx.aiMetadata?.occurrenceDate ||
        tx.transactionDate;

      if (!txDate) continue;
      const list = pendingByDate.get(txDate) || [];
      list.push(tx);
      pendingByDate.set(txDate, list);

      if (tx.recurringRuleId) {
        existingRuleDates.add(`${tx.recurringRuleId}_${txDate}`);
      }
    }

    // 3. Proyectar fechas de ocurrencia para cada regla recurrente en el horizonte
    const baseDate = new Date(todayStr + 'T00:00:00');
    const endDate = new Date(baseDate.getTime());
    endDate.setDate(endDate.getDate() + horizonDays);

    const recurringEventsByDate = new Map<string, Array<{ rule: RecurringRule; date: string }>>();

    for (const rule of activeRecurringRules) {
      if (!rule.isActive) continue;
      const occurrences = this.calculateOccurrenceDates(baseDate, endDate, rule);

      for (const occDate of occurrences) {
        if (occDate < todayStr) continue;
        // Si ya existe una factura física pending para esta misma regla y fecha, no duplicamos
        if (existingRuleDates.has(`${rule.id}_${occDate}`)) continue;

        const list = recurringEventsByDate.get(occDate) || [];
        list.push({ rule, date: occDate });
        recurringEventsByDate.set(occDate, list);
      }
    }

    // 4. Generar la serie temporal diaria (Puntos día 0 al día H)
    const points: DailyLiquidityPoint[] = [];
    let currentClosingBalance = initialLiquidity;
    let minBalance = initialLiquidity;
    let minBalanceDate = todayStr;
    let deficitDate: string | null = null;
    let daysToDeficit: number | null = null;

    let totalInflows = 0;
    let totalOutflows = 0;
    let totalOrganicSpending = 0;

    // Punto día 0 (Hoy)
    points.push({
      date: todayStr,
      dayIndex: 0,
      openingBalance: initialLiquidity,
      inflows: 0,
      outflows: 0,
      organicSpending: 0,
      closingBalance: initialLiquidity,
      netChange: 0,
      events: [],
    });

    if (initialLiquidity < reserveThreshold) {
      deficitDate = todayStr;
      daysToDeficit = 0;
    }

    // Iterar día 1 hasta horizonDays
    for (let day = 1; day <= horizonDays; day++) {
      const d = new Date(baseDate.getTime());
      d.setDate(d.getDate() + day);
      const dateStr = d.toISOString().split('T')[0];

      const openingBalance = currentClosingBalance;
      let dayInflows = 0;
      let dayOutflows = 0;
      const events: ForecastDayEvent[] = [];

      // Facturas pendientes en este día
      const billsThisDay = pendingByDate.get(dateStr) || [];
      for (const bill of billsThisDay) {
        if (bill.type === 'income') {
          dayInflows += bill.amount;
          events.push({
            description: bill.description || 'Ingreso pendiente',
            amount: bill.amount,
            type: 'income',
            source: 'bill',
          });
        } else if (bill.type === 'expense') {
          dayOutflows += bill.amount;
          events.push({
            description: bill.description || 'Factura por pagar',
            amount: bill.amount,
            type: 'expense',
            source: 'bill',
          });
        }
      }

      // Reglas recurrentes en este día
      const recurrencesThisDay = recurringEventsByDate.get(dateStr) || [];
      for (const { rule } of recurrencesThisDay) {
        if (rule.type === 'income') {
          dayInflows += rule.amount;
          events.push({
            description: rule.description || 'Ingreso recurrente programado',
            amount: rule.amount,
            type: 'income',
            source: 'recurrence',
          });
        } else if (rule.type === 'expense') {
          dayOutflows += rule.amount;
          events.push({
            description: rule.description || 'Gasto recurrente programado',
            amount: rule.amount,
            type: 'expense',
            source: 'recurrence',
          });
        }
      }

      // Gasto orgánico diario (si aplica el modo total)
      const dayOrganic = spendingMode === 'total_projected' ? Math.round(organicDailyRate) : 0;

      const netChange = dayInflows - dayOutflows - dayOrganic;
      currentClosingBalance = Math.round(openingBalance + netChange);

      totalInflows += dayInflows;
      totalOutflows += dayOutflows;
      totalOrganicSpending += dayOrganic;

      if (currentClosingBalance < minBalance) {
        minBalance = currentClosingBalance;
        minBalanceDate = dateStr;
      }

      if (currentClosingBalance < reserveThreshold && deficitDate === null) {
        deficitDate = dateStr;
        daysToDeficit = day;
      }

      points.push({
        date: dateStr,
        dayIndex: day,
        openingBalance,
        inflows: dayInflows,
        outflows: dayOutflows,
        organicSpending: dayOrganic,
        closingBalance: currentClosingBalance,
        netChange,
        events,
      });
    }

    return {
      initialLiquidity: Math.round(initialLiquidity),
      horizonDays,
      spendingMode,
      points,
      endingBalance: Math.round(currentClosingBalance),
      minimumBalance: Math.round(minBalance),
      minimumBalanceDate: minBalanceDate,
      isAtRisk: deficitDate !== null,
      deficitDate,
      daysToDeficit,
      totalInflows: Math.round(totalInflows),
      totalOutflows: Math.round(totalOutflows),
      totalOrganicSpending: Math.round(totalOrganicSpending),
    };
  }

  /**
   * Genera las fechas de ocurrencia de una regla recurrente en el rango [start, end].
   */
  private calculateOccurrenceDates(start: Date, end: Date, rule: RecurringRule): string[] {
    const dates: string[] = [];
    const ruleStart = new Date(rule.startDate + 'T00:00:00');
    const ruleEnd = rule.endDate ? new Date(rule.endDate + 'T00:00:00') : null;

    const current = new Date(Math.max(start.getTime(), ruleStart.getTime()));
    const limit = ruleEnd && ruleEnd < end ? ruleEnd : end;

    while (current <= limit) {
      dates.push(current.toISOString().split('T')[0]);

      if (rule.frequency === 'daily') {
        current.setDate(current.getDate() + 1);
      } else if (rule.frequency === 'weekly') {
        current.setDate(current.getDate() + 7);
      } else if (rule.frequency === 'biweekly') {
        current.setDate(current.getDate() + 14);
      } else if (rule.frequency === 'monthly') {
        const nextMonth = current.getMonth() + 1;
        const targetDay = rule.dayOfMonth || ruleStart.getDate();
        current.setMonth(nextMonth, targetDay);
      } else if (rule.frequency === 'yearly') {
        current.setFullYear(current.getFullYear() + 1);
      } else {
        break;
      }
    }

    return dates;
  }
}
