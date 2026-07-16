/**
 * ZenMoney — Caso de Uso: CalculateBudgetProgress
 *
 * Calcula el progreso de consumo de un presupuesto comparándolo con los gastos reales
 * de su categoría para el mes y año configurado.
 */

import { Budget, BudgetProgress } from '../entities/Budget';
import { TransactionRepository } from '../repositories/TransactionRepository';

export class CalculateBudgetProgress {
  constructor(private transactionRepository: TransactionRepository) {}

  /**
   * Ejecuta la evaluación del progreso del presupuesto.
   *
   * Reglas de negocio:
   * - Filtra transacciones de tipo 'expense' para la categoría específica.
   * - Filtra en el rango de fechas del mes y año especificado por el presupuesto.
   * - Alerta al alcanzar el 80% (warning) y al superar el 100% (exceeded).
   */
  async execute(budget: Budget): Promise<BudgetProgress> {
    const startDate = `${budget.year}-${String(budget.month).padStart(2, '0')}-01`;
    // Obtener el último día del mes
    const lastDay = new Date(budget.year, budget.month, 0).getDate();
    const endDate = `${budget.year}-${String(budget.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const transactions = await this.transactionRepository.getAll({
      categoryId: budget.categoryId,
      type: 'expense',
      startDate,
      endDate,
      status: 'confirmed',
    });

    const spent = transactions.reduce((acc, tx) => acc + Number(tx.amount), 0);
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
