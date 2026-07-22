/**
 * ZenMoney — TrendAnalysisUseCase
 *
 * Agrupa y procesa los datos históricos de los últimos 12 meses para
 * graficarlos en el dashboard de análisis.
 */

import { Transaction } from '@/src/domain/entities/Transaction';
import { Budget } from '@/src/domain/entities/Budget';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { HybridBudgetRepository } from '@/src/data/repositories/HybridBudgetRepository';

export interface TrendDataPoint {
  label: string; // ej. "Jul", "Ago"
  income: number;
  expense: number;
  budget: number;
  fullDate: string; // YYYY-MM
}

export class TrendAnalysisUseCase {
  constructor(
    private transactionRepo: HybridTransactionRepository,
    private budgetRepo: HybridBudgetRepository
  ) {}

  async execute(): Promise<TrendDataPoint[]> {
    const today = new Date();
    
    // Preparar el arreglo de 12 meses hacia atrás
    const points: TrendDataPoint[] = [];
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1; // 1-12
      const monthLabel = monthNames[month - 1];
      
      points.push({
        label: monthLabel,
        income: 0,
        expense: 0,
        budget: 0,
        fullDate: `${year}-${String(month).padStart(2, '0')}`
      });
    }

    const startDate = `${points[0].fullDate}-01`;
    // Traer todas las transacciones de los últimos 12 meses
    const txs = await this.transactionRepo.getAll({ startDate });
    
    // Cargar todos los presupuestos de estos meses
    const budgetsMap: Record<string, number> = {};
    for (const pt of points) {
      const [y, m] = pt.fullDate.split('-');
      const budgets = await this.budgetRepo.getByMonth(parseInt(y), parseInt(m));
      budgetsMap[pt.fullDate] = budgets.reduce((sum, b) => sum + b.amountLimit, 0);
      pt.budget = budgetsMap[pt.fullDate];
    }

    // Agregar transacciones
    for (const tx of txs) {
      if (tx.status !== 'confirmed') continue;
      
      const prefix = tx.transactionDate.substring(0, 7); // YYYY-MM
      const point = points.find(p => p.fullDate === prefix);
      if (point) {
        if (tx.type === 'income') point.income += tx.amount;
        if (tx.type === 'expense') point.expense += tx.amount;
      }
    }

    return points;
  }
}
