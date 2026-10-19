/**
 * ZenMoney — Caso de Uso: CalculateBudgetRollover
 *
 * Calcula el saldo acumulado (Rollover) de un presupuesto específico desde el mes anterior.
 * Si el usuario gastó menos de su límite disponible el mes anterior, el superávit se suma
 * como bono de ahorro. Si se sobregiró, el déficit se descuenta para compensar.
 */

import { Budget } from '../entities/Budget';
import { Transaction } from '../entities/Transaction';
import { Category } from '../entities/Category';

export interface BudgetRolloverResult {
  hasRollover: boolean;
  baseLimit: number;
  rolloverAmount: number; // Monto arrastrado del mes anterior (puede ser positivo o negativo)
  effectiveLimit: number; // baseLimit + rolloverAmount (mínimo 0)
}

export class CalculateBudgetRollover {
  /**
   * Calcula el límite efectivo de un presupuesto considerando el rollover del mes inmediatamente anterior.
   *
   * @param budget Presupuesto del mes evaluado
   * @param pastMonthBudget Presupuesto vigente en el mes anterior (si existía)
   * @param pastMonthExpenses Transacciones de gasto del mes anterior
   * @param categories Lista de categorías para considerar subcategorías si aplica
   */
  static execute(params: {
    budget: Budget;
    pastMonthBudget?: Budget | null;
    pastMonthExpenses: Transaction[];
    categories?: Category[];
  }): BudgetRolloverResult {
    const { budget, pastMonthBudget, pastMonthExpenses, categories = [] } = params;

    const baseLimit = Number(budget.amountLimit) || 0;

    // Si el presupuesto no tiene activado el Rollover, el límite efectivo es simplemente el base
    if (!budget.hasRollover) {
      return {
        hasRollover: false,
        baseLimit,
        rolloverAmount: 0,
        effectiveLimit: baseLimit,
      };
    }

    // Si no había presupuesto configurado o vigente en el mes anterior, no hay saldo a arrastrar
    if (!pastMonthBudget) {
      return {
        hasRollover: true,
        baseLimit,
        rolloverAmount: 0,
        effectiveLimit: baseLimit,
      };
    }

    // Obtener todas las categorías objetivo (la categoría del presupuesto + sus subcategorías si es padre)
    const targetCategoryIds = new Set<string>([pastMonthBudget.categoryId]);
    categories.forEach((cat) => {
      if (cat.parentCategoryId === pastMonthBudget.categoryId) {
        targetCategoryIds.add(cat.id);
      }
    });

    // Filtrar los gastos del mes anterior que correspondan a este presupuesto
    const filteredExpenses = pastMonthExpenses.filter((tx) => {
      if (tx.type !== 'expense' || tx.status !== 'confirmed') return false;
      if (!tx.categoryId || !targetCategoryIds.has(tx.categoryId)) return false;

      // Si el presupuesto es individual, solo computan los gastos del propietario
      if (pastMonthBudget.scope === 'individual' && pastMonthBudget.ownerUserId) {
        return tx.createdByUserId === pastMonthBudget.ownerUserId;
      }

      return true;
    });

    const pastSpent = filteredExpenses.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const pastLimit = Number(pastMonthBudget.amountLimit) || 0;

    // Rollover = Límite del mes anterior - Gasto real del mes anterior
    // Positivo si sobró dinero (ahorro), negativo si hubo exceso (déficit)
    const rolloverAmount = pastLimit - pastSpent;

    // El límite efectivo nunca debe ser menor a 0
    const effectiveLimit = Math.max(0, baseLimit + rolloverAmount);

    return {
      hasRollover: true,
      baseLimit,
      rolloverAmount,
      effectiveLimit,
    };
  }
}
