/**
 * ZenMoney — Helper de sincronización automática del presupuesto hacia el Widget Android
 */

import { HybridBudgetRepository } from '@/src/data/repositories/HybridBudgetRepository';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { HybridCategoryRepository } from '@/src/data/repositories/HybridCategoryRepository';
import { WidgetSyncService } from './WidgetSyncService';

export class BudgetSyncHelper {
  /**
   * Calcula el presupuesto consolidado del mes actual y lo envía al Widget Android Glance.
   */
  static async syncMonthlyBudget(): Promise<void> {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const budgetRepo = new HybridBudgetRepository();
      const transactionRepo = new HybridTransactionRepository();
      const categoryRepo = new HybridCategoryRepository();

      const [budgets, categories] = await Promise.all([
        budgetRepo.getAll(),
        categoryRepo.getAll(true, true),
      ]);

      const currentMonthBudgets = budgets.filter(
        (b) => b.year === currentYear && b.month === currentMonth
      );

      // Si no hay presupuestos configurados para el mes actual, no actualizamos
      if (currentMonthBudgets.length === 0) {
        return;
      }

      const totalLimit = currentMonthBudgets.reduce((sum, b) => sum + Number(b.amountLimit || 0), 0);

      // Calcular gastos del mes
      const lastDay = new Date(currentYear, currentMonth, 0).getDate();
      const monthStr = String(currentMonth).padStart(2, '0');
      const startDate = `${currentYear}-${monthStr}-01`;
      const endDate = `${currentYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

      const transactions = await transactionRepo.getAll({
        type: 'expense',
        status: 'confirmed',
        startDate,
        endDate,
      }, true);

      // Calcular gasto en las categorías presupuestadas
      const budgetedCategoryIds = new Set(currentMonthBudgets.map((b) => b.categoryId));
      // Añadir subcategorías
      categories.forEach((cat) => {
        if (cat.parentCategoryId && budgetedCategoryIds.has(cat.parentCategoryId)) {
          budgetedCategoryIds.add(cat.id);
        }
      });

      const totalSpent = transactions
        .filter((tx) => tx.categoryId && budgetedCategoryIds.has(tx.categoryId))
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

      const remaining = Math.max(0, totalLimit - totalSpent);
      const percentage = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

      await WidgetSyncService.updateWidget({
        remainingBudget: remaining,
        spentPercentage: percentage,
      });
    } catch (e) {
      // Silencioso para no interferir con flujos críticos de usuario
      console.warn('[BudgetSyncHelper] Error syncing budget to widget:', e);
    }
  }
}
