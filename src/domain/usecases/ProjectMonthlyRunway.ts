/**
 * ZenMoney — Caso de Uso: ProjectMonthlyRunway
 *
 * Proyecta el saldo de caja para el final del mes en base a:
 * - Saldo líquido actual.
 * - Velocidad promedio de gasto diario acumulada este mes.
 * - Transacciones recurrentes programadas que faltan por ejecutarse de aquí a fin de mes.
 */

import { Transaction } from '../entities/Transaction';
import { RecurringRule } from '../entities/RecurringRule';

export interface RunwayProjection {
  currentBalance: number;
  projectedBalance: number;
  spendingVelocity: number; // Promedio de gasto diario
  projectedOrganicSpending: number; // Gasto proyectado de aquí a fin de mes
  remainingRecurrencesNet: number; // Net de futuros ingresos/gastos recurrentes
  daysRemaining: number;
  isAtRisk: boolean; // Alerta si el saldo proyectado es negativo (<0)
}

export class ProjectMonthlyRunway {
  /**
   * Ejecuta la proyección financiera de fin de mes.
   *
   * @param currentBalance - Saldo líquido actual consolidado
   * @param transactionsThisMonth - Historial de transacciones del mes en curso
   * @param activeRecurringRules - Reglas recurrentes de la familia
   * @param todayStr - Fecha actual (YYYY-MM-DD)
   */
  execute(
    currentBalance: number,
    transactionsThisMonth: Transaction[],
    activeRecurringRules: RecurringRule[],
    todayStr: string
  ): RunwayProjection {
    const today = new Date(todayStr);
    const year = today.getUTCFullYear();
    const month = today.getUTCMonth(); // 0-11
    
    // 1. Calcular días transcurridos y restantes del mes
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const dayOfMonth = today.getUTCDate();
    const daysRemaining = Math.max(0, lastDayOfMonth - dayOfMonth);
    const daysElapsed = dayOfMonth;

    // 2. Calcular velocidad de gasto diario orgánico (excluyendo transferencias)
    const expensesThisMonth = transactionsThisMonth.filter(
      tx => tx.type === 'expense' && tx.status === 'confirmed'
    );
    const totalSpentThisMonth = expensesThisMonth.reduce((sum, tx) => sum + tx.amount, 0);
    const spendingVelocity = daysElapsed > 0 ? totalSpentThisMonth / daysElapsed : 0;
    
    // Gasto orgánico proyectado de aquí a fin de mes
    const projectedOrganicSpending = spendingVelocity * daysRemaining;

    // 3. Proyectar ingresos y gastos recurrentes que faltan por ejecutarse este mes
    let remainingRecurrencesNet = 0;
    
    for (const rule of activeRecurringRules) {
      if (!rule.isActive) continue;

      // Evaluar las fechas de ocurrencia restantes en el mes actual
      const nextOccurrences = this.getFutureOccurrencesThisMonth(rule, today, lastDayOfMonth);
      
      for (const _date of nextOccurrences) {
        if (rule.type === 'income') {
          remainingRecurrencesNet += rule.amount; // Ingreso suma
        } else if (rule.type === 'expense') {
          remainingRecurrencesNet -= rule.amount; // Gasto resta
        }
      }
    }

    // 4. Calcular saldo final proyectado
    const projectedBalance = currentBalance + remainingRecurrencesNet - projectedOrganicSpending;

    return {
      currentBalance,
      projectedBalance: Math.round(projectedBalance),
      spendingVelocity: Math.round(spendingVelocity),
      projectedOrganicSpending: Math.round(projectedOrganicSpending),
      remainingRecurrencesNet: Math.round(remainingRecurrencesNet),
      daysRemaining,
      isAtRisk: projectedBalance < 0,
    };
  }

  /**
   * Obtiene las ocurrencias futuras de una regla recurrente de hoy a fin de mes.
   */
  private getFutureOccurrencesThisMonth(rule: RecurringRule, today: Date, lastDay: number): string[] {
    const occurrences: string[] = [];
    const startDate = new Date(rule.startDate);
    startDate.setUTCHours(0, 0, 0, 0);

    const year = today.getUTCFullYear();
    const month = today.getUTCMonth();

    // Iterar día por día hasta fin de mes usando UTC
    for (let day = today.getUTCDate() + 1; day <= lastDay; day++) {
      const evaluationDate = new Date(Date.UTC(year, month, day));
      evaluationDate.setUTCHours(0, 0, 0, 0);

      if (evaluationDate < startDate) continue;
      
      if (rule.endDate) {
        const ruleEndDate = new Date(rule.endDate);
        ruleEndDate.setUTCHours(0, 0, 0, 0);
        if (evaluationDate > ruleEndDate) continue;
      }

      if (this.isOccurrenceDay(evaluationDate, rule)) {
        occurrences.push(evaluationDate.toISOString().split('T')[0]);
      }
    }

    return occurrences;
  }

  /**
   * Helper para verificar si un día específico es día de ocurrencia de la regla.
   */
  private isOccurrenceDay(date: Date, rule: RecurringRule): boolean {
    const startDate = new Date(rule.startDate);
    startDate.setUTCHours(0, 0, 0, 0);
    
    // date ya viene en UTC y con horas en 0
    const diffTime = Math.abs(date.getTime() - startDate.getTime());
    // division entera exacta de días ya que ambas fechas están en UTC medianoche
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (rule.frequency === 'daily') {
      return true;
    }
    if (rule.frequency === 'weekly') {
      return diffDays % 7 === 0;
    }
    if (rule.frequency === 'biweekly') {
      return diffDays % 14 === 0;
    }
    if (rule.frequency === 'monthly') {
      if (rule.dayOfMonth) {
        return date.getUTCDate() === rule.dayOfMonth;
      }
      return date.getUTCDate() === startDate.getUTCDate();
    }
    if (rule.frequency === 'yearly') {
      const isLeapDay = startDate.getUTCMonth() === 1 && startDate.getUTCDate() === 29;
      if (isLeapDay && date.getUTCMonth() === 1) {
        const lastDayOfFeb = new Date(Date.UTC(date.getUTCFullYear(), 2, 0)).getUTCDate();
        return date.getUTCDate() === lastDayOfFeb;
      }
      return (
        date.getUTCMonth() === startDate.getUTCMonth() &&
        date.getUTCDate() === startDate.getUTCDate()
      );
    }
    return false;
  }
}
