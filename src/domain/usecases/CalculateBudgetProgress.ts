/**
 * ZenMoney — Caso de Uso: CalculateBudgetProgress
 *
 * Calcula el progreso de consumo de un presupuesto comparándolo con los gastos reales
 * de su categoría para el mes y año configurado.
 */

import { Budget, BudgetProgress } from '../entities/Budget';
import { Category } from '../entities/Category';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { getImputedAmountForCategoryInMonth } from '../utils/budgetUtils';

export class CalculateBudgetProgress {
  constructor(private transactionRepository: TransactionRepository) {}

  /**
   * Ejecuta la evaluación del progreso del presupuesto.
   *
   * Reglas de negocio:
   * - Filtra transacciones de tipo 'expense' para la categoría específica y sus subcategorías.
   * - Imputa transacciones desglosadas (splits) y amortizadas temporalmente (periodSplit).
   * - Alerta al alcanzar el 80% (warning) y al superar el 100% (exceeded).
   */
  async execute(budget: Budget, categories: Category[] = []): Promise<BudgetProgress> {
    const monthStr = String(budget.month).padStart(2, '0');
    const startDate = `${budget.year}-${monthStr}-01`;
    const lastDay = new Date(budget.year, budget.month, 0).getDate();
    const endDate = `${budget.year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
    const targetYearMonth = `${budget.year}-${monthStr}`;

    // Construir conjunto de IDs que pertenecen al presupuesto (categoría + subcategorías)
    const targetCategoryIds = new Set<string>([budget.categoryId]);
    if (categories.length > 0) {
      categories.forEach((cat) => {
        if (cat.parentCategoryId === budget.categoryId) {
          targetCategoryIds.add(cat.id);
        }
      });
    }

    let allExpenses = await this.transactionRepository.getAll({
      type: 'expense',
      startDate,
      endDate,
      status: 'confirmed',
    });

    let eligibleExpenses = allExpenses;
    // Regla de Negocio: Si el presupuesto es individual/personal, solo sumar los gastos de ese usuario
    if (budget.scope === 'individual' && budget.ownerUserId) {
      eligibleExpenses = eligibleExpenses.filter(tx => tx.createdByUserId === budget.ownerUserId);
    }

    const spent = eligibleExpenses.reduce((acc, tx) => {
      return acc + getImputedAmountForCategoryInMonth(tx, targetCategoryIds, targetYearMonth);
    }, 0);
    const remaining = Number(budget.amountLimit) - spent;
    const percentage = Number(budget.amountLimit) > 0 
      ? (spent / Number(budget.amountLimit)) * 100 
      : 0;

    let status: BudgetProgress['status'] = 'ok';
    if (percentage >= 100) {
      status = 'exceeded';
    } else if (percentage >= 80) {
      status = 'warning';
    }

    return {
      budget,
      spent,
      remaining,
      percentage: Math.round(percentage * 100) / 100, // Redondear a 2 decimales
      status,
    };
  }
}
