/**
 * ZenMoney — Utilidades de Imputación de Presupuesto y Gastos
 *
 * Resuelve el cómputo de montos de transacciones desglosadas por categoría (Category Split)
 * y amortizadas a lo largo del tiempo (Period Split / Prorrateo contable).
 */

import { Transaction } from '../entities/Transaction';

/**
 * Calcula el monto efectivo que una transacción imputa a una o varias categorías
 * en un mes específico (formato 'YYYY-MM').
 *
 * Reglas:
 * 1. Si la transacción posee `splits`, solo suma los desgloses cuya categoría coincida con las buscadas.
 * 2. Si la transacción posee `periodSplit`, verifica si `targetYearMonth` se encuentra entre
 *    `startMonth` y `endMonth`. Si está dentro, imputa la alícuota mensual proporcional. Si está fuera, imputa 0.
 * 3. Si no posee `periodSplit`, solo imputa si el mes de `transactionDate` es igual a `targetYearMonth`.
 * 4. Si la categoría no coincide, retorna 0.
 */
export function getImputedAmountForCategoryInMonth(
  tx: Transaction,
  targetCategoryIds: string | string[] | Set<string>,
  targetYearMonth: string // "YYYY-MM"
): number {
  const categorySet = targetCategoryIds instanceof Set
    ? targetCategoryIds
    : new Set(Array.isArray(targetCategoryIds) ? targetCategoryIds : [targetCategoryIds]);

  // 1. Determinar base de monto para la categoría / categorías objetivo
  let categoryBaseAmount = 0;
  if (tx.splits && tx.splits.length > 0) {
    const matchingSplits = tx.splits.filter((s) => categorySet.has(s.categoryId));
    if (matchingSplits.length === 0) return 0;
    categoryBaseAmount = matchingSplits.reduce((acc, s) => acc + s.amount, 0);
  } else if (tx.categoryId && categorySet.has(tx.categoryId)) {
    categoryBaseAmount = tx.amount;
  } else {
    return 0;
  }

  // 2. Evaluar si la transacción está prorrateada en el tiempo (Period Split)
  if (tx.periodSplit) {
    const { startMonth, endMonth, totalMonths, monthlyAmount } = tx.periodSplit;
    if (targetYearMonth >= startMonth && targetYearMonth <= endMonth) {
      // Si también tenía splits, prorratear proporcionalmente la cuota de la categoría
      if (tx.splits && tx.splits.length > 0 && tx.amount > 0) {
        return Math.round((categoryBaseAmount / tx.amount) * monthlyAmount);
      }
      return monthlyAmount;
    }
    return 0; // Fuera del período de amortización
  }

  // 3. Gasto estándar: imputar solo si la fecha real coincide con el mes evaluado
  const txMonth = tx.transactionDate ? tx.transactionDate.substring(0, 7) : '';
  return txMonth === targetYearMonth ? categoryBaseAmount : 0;
}

/**
 * Alias explícito de dominio para getImputedAmountForCategoryInMonth
 */
export const calculateEffectiveCategoryExpense = getImputedAmountForCategoryInMonth;
