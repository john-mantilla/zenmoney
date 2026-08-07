/**
 * ZenMoney — Caso de Uso: GetFinancialSummary
 *
 * Genera un resumen financiero consolidado para un periodo de tiempo dado.
 */

import { TransactionRepository } from '../repositories/TransactionRepository';

export interface CategorySummary {
  categoryId: string;
  amount: number;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  net: number;
  topExpenseCategories: CategorySummary[];
  transactionCount: number;
  averageExpense: number;
}

export class GetFinancialSummary {
  constructor(private transactionRepository: TransactionRepository) {}

  /**
   * Ejecuta la generación del resumen financiero.
   */
  async execute(startDate: string, endDate: string, preferCache = false): Promise<FinancialSummary> {
    const transactions = await (this.transactionRepository as any).getAll({
      startDate,
      endDate,
      status: 'confirmed',
    }, preferCache);

    let totalIncome = 0;
    let totalExpenses = 0;
    let expenseCount = 0;
    const categoryTotals: Record<string, number> = {};

    for (const tx of transactions) {
      const amount = Number(tx.amount);
      if (tx.type === 'income') {
        totalIncome += amount;
      } else if (tx.type === 'expense') {
        totalExpenses += amount;
        expenseCount++;
        
        if (tx.categoryId) {
          categoryTotals[tx.categoryId] = (categoryTotals[tx.categoryId] || 0) + amount;
        }
      }
    }

    // Convertir y ordenar categorías de mayor a menor gasto
    const topExpenseCategories: CategorySummary[] = Object.entries(categoryTotals)
      .map(([categoryId, amount]) => ({ categoryId, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5); // Tomar el Top 5

    const net = totalIncome - totalExpenses;
    const averageExpense = expenseCount > 0 ? totalExpenses / expenseCount : 0;

    return {
      totalIncome,
      totalExpenses,
      net,
      topExpenseCategories,
      transactionCount: transactions.length,
      averageExpense: Math.round(averageExpense * 100) / 100,
    };
  }
}
