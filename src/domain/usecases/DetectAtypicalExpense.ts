/**
 * ZenMoney — Caso de Uso: DetectAtypicalExpense
 *
 * Analiza un gasto recién registrado en una categoría y determina si es inusual/atípico
 * comparándolo con el comportamiento histórico de esa misma categoría.
 */

import { Transaction } from '../entities/Transaction';

export interface AtypicalDetectionResult {
  isAtypical: boolean;
  average: number;
  threshold: number;
  differenceRatio: number; // Por cuánto multiplica el promedio (ej. 3.4x)
}

export class DetectAtypicalExpense {
  
  /**
   * Evalúa si una transacción de gasto es atípica.
   *
   * @param amount - Monto del nuevo gasto
   * @param categoryId - Categoría del gasto
   * @param historicalTransactions - Últimos 30-90 días de transacciones generales
   */
  execute(
    amount: number,
    categoryId: string,
    historicalTransactions: Transaction[]
  ): AtypicalDetectionResult {
    // 1. Filtrar transacciones históricas de gasto confirmadas de la misma categoría
    const catExpenses = historicalTransactions.filter(
      tx => tx.categoryId === categoryId && tx.type === 'expense' && tx.status === 'confirmed'
    );

    // Si hay menos de 3 movimientos históricos, no hay suficiente muestra para juzgar
    if (catExpenses.length < 3) {
      return {
        isAtypical: false,
        average: 0,
        threshold: 0,
        differenceRatio: 1,
      };
    }

    // 2. Calcular la media (promedio) de gastos en la categoría
    const totalAmount = catExpenses.reduce((sum, tx) => sum + tx.amount, 0);
    const average = totalAmount / catExpenses.length;

    // 3. Establecer umbral de alerta: 2.5 veces el promedio histórico
    const thresholdMultiplier = 2.5;
    const threshold = average * thresholdMultiplier;

    const differenceRatio = average > 0 ? amount / average : 1;

    // 4. Determinar si califica como atípico
    const isAtypical = amount > threshold;

    return {
      isAtypical,
      average: Math.round(average),
      threshold: Math.round(threshold),
      differenceRatio: Math.round(differenceRatio * 10) / 10, // 1 decimal
    };
  }
}
