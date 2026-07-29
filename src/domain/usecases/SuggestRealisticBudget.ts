/**
 * ZenMoney — Caso de Uso: SuggestRealisticBudget
 *
 * Analiza el historial de consumo de los últimos 3 meses para una categoría y evalúa
 * si el límite que el usuario intenta fijar (o tiene fijado) es desmedidamente irreal
 * (Wishful Thinking Gap). Ofrece una meta intermedia alcanzable (anclaje progresivo).
 */

import { Category } from '../entities/Category';
import { Transaction } from '../entities/Transaction';

export interface RealisticBudgetSuggestion {
  categoryId: string;
  categoryName: string;
  userTargetAmount: number;
  historical3MonthAverage: number;
  suggestedAmount: number;
  gapPercentage: number;
  reason: string;
}

export class SuggestRealisticBudget {
  /**
   * Genera una sugerencia de presupuesto realista basada en el historial de 3 meses.
   */
  static execute(
    categoryId: string,
    targetAmount: number,
    historicTransactions: Transaction[],
    categories: Category[] = [],
    referenceYear: number = new Date().getFullYear(),
    referenceMonth: number = new Date().getMonth() + 1
  ): RealisticBudgetSuggestion | null {
    if (!categoryId || targetAmount <= 0) {
      return null;
    }

    const categoryObj = categories.find((c) => c.id === categoryId);
    const categoryName = categoryObj ? categoryObj.name : 'esta categoría';

    // Identificar IDs de la categoría objetivo y sus subcategorías
    const targetCategoryIds = new Set<string>([categoryId]);
    categories.forEach((c) => {
      if (c.parentCategoryId === categoryId) {
        targetCategoryIds.add(c.id);
      }
    });

    // Definir rango de los 3 meses anteriores
    const monthsToScan: { year: number; month: number }[] = [];
    let curY = referenceYear;
    let curM = referenceMonth - 1; // Mes anterior al de referencia

    for (let i = 0; i < 3; i++) {
      if (curM < 1) {
        curM = 12;
        curY -= 1;
      }
      monthsToScan.push({ year: curY, month: curM });
      curM -= 1;
    }

    // Filtrar gastos dentro de esos 3 meses
    let total3MonthSpend = 0;
    let monthsWithData = 0;

    monthsToScan.forEach(({ year, month }) => {
      const monthStr = String(month).padStart(2, '0');
      const prefix = `${year}-${monthStr}`;

      const monthExpenses = historicTransactions.filter(
        (tx) =>
          tx.type === 'expense' &&
          tx.status === 'confirmed' &&
          tx.categoryId &&
          targetCategoryIds.has(tx.categoryId) &&
          tx.transactionDate.startsWith(prefix)
      );

      const sum = monthExpenses.reduce((acc, tx) => acc + Number(tx.amount), 0);
      if (sum > 0) {
        total3MonthSpend += sum;
        monthsWithData++;
      }
    });

    if (monthsWithData === 0) {
      return null;
    }

    const historical3MonthAverage = Math.round(total3MonthSpend / Math.max(1, monthsWithData));

    // Si el promedio histórico supera el objetivo por más del 15%, hay un Wishful Thinking Gap
    if (historical3MonthAverage > targetAmount * 1.15) {
      const gap = historical3MonthAverage - targetAmount;
      // Anclaje progresivo: Reducir el 40% del abismo en lugar del 100% de golpe
      let rawSuggested = historical3MonthAverage - gap * 0.4;

      // Redondear al múltiplo de $10.000 más cercano
      let suggestedAmount = Math.round(rawSuggested / 10000) * 10000;
      if (suggestedAmount <= targetAmount) {
        suggestedAmount = Math.round((targetAmount + 10000) / 10000) * 10000;
      }

      const gapPercentage = Math.round(((historical3MonthAverage - targetAmount) / targetAmount) * 100);

      const formattedAvg = `$${historical3MonthAverage.toLocaleString('es-CO')}`;
      const formattedSuggested = `$${suggestedAmount.toLocaleString('es-CO')}`;

      return {
        categoryId,
        categoryName,
        userTargetAmount: targetAmount,
        historical3MonthAverage,
        suggestedAmount,
        gapPercentage,
        reason: `Tu promedio real en ${categoryName} en los últimos 3 meses es de ${formattedAvg}. Reducir un ${gapPercentage}% de golpe suele causar frustración. ¿Prefieres iniciar con una meta alcanzable de ${formattedSuggested}?`,
      };
    }

    return null;
  }
}
