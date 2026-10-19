/**
 * ZenMoney — Helper de sincronización automática del presupuesto hacia el Widget Android
 */

import { HybridBudgetRepository } from '@/src/data/repositories/HybridBudgetRepository';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { HybridCategoryRepository } from '@/src/data/repositories/HybridCategoryRepository';
import { WidgetSyncService } from './WidgetSyncService';
import { Budget } from '@/src/domain/entities/Budget';

export class BudgetSyncHelper {
  /**
   * Sincroniza directamente valores calculados de forma autoritativa.
   */
  static async syncCalculatedBudget(remainingBudget: number, spentPercentage: number): Promise<void> {
    try {
      await WidgetSyncService.updateWidget({
        remainingBudget: Math.max(0, remainingBudget),
        spentPercentage: Math.max(0, spentPercentage),
      });
    } catch (e) {
      console.warn('[BudgetSyncHelper] Error syncing calculated budget to widget:', e);
    }
  }

  /**
   * Calcula el presupuesto consolidado del mes actual con lógica de herencia (carry-forward)
   * idéntica a la pantalla de Presupuestos y lo envía al Widget Android Glance.
   */
  static async syncMonthlyBudget(forcedAvailable?: number, forcedPercentage?: number): Promise<void> {
    if (forcedAvailable !== undefined) {
      await this.syncCalculatedBudget(forcedAvailable, forcedPercentage ?? 0);
      return;
    }

    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const budgetRepo = new HybridBudgetRepository();
      const transactionRepo = new HybridTransactionRepository();
      const categoryRepo = new HybridCategoryRepository();

      const [allBudgets, loadedCats] = await Promise.all([
        budgetRepo.getAll(),
        categoryRepo.getAll(true, true),
      ]);

      // 1. Filtrar presupuestos privados si pertenecen a otro usuario
      let currentUserId: string | undefined;
      try {
        const { useAuthStore } = require('@/src/infrastructure/auth/authStore');
        currentUserId = useAuthStore.getState().userProfile?.id;
      } catch {}

      const privacyBudgets = allBudgets.filter((b) => {
        if (b.scope === 'individual' && b.ownerUserId && b.ownerUserId !== currentUserId) {
          return false;
        }
        return true;
      });

      // 2. Herencia de presupuestos de meses anteriores (carry-forward)
      const targetValue = currentYear * 12 + currentMonth;
      const pastBudgets = privacyBudgets.filter((b) => b.year * 12 + b.month <= targetValue);

      const latestByKey: Record<string, { budget: Budget; value: number }> = {};
      for (const b of pastBudgets) {
        const bValue = b.year * 12 + b.month;
        const key = `${b.categoryId}_${b.scope || 'family'}_${b.ownerUserId || 'family'}`;
        if (!latestByKey[key] || latestByKey[key].value < bValue) {
          latestByKey[key] = { budget: b, value: bValue };
        }
      }

      const monthlyBudgets: Budget[] = Object.values(latestByKey).map((item) => item.budget);

      if (monthlyBudgets.length === 0) {
        return;
      }

      // 3. Gastos del mes actual
      const lastDay = new Date(currentYear, currentMonth, 0).getDate();
      const monthStr = String(currentMonth).padStart(2, '0');
      const startDate = `${currentYear}-${monthStr}-01`;
      const endDate = `${currentYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

      const monthlyExpenses = await transactionRepo.getAll(
        {
          startDate,
          endDate,
          type: 'expense',
          status: 'confirmed',
        },
        true
      );

      // 4. Calcular gasto por categoría y subcategorías
      const getCategoryAndSubcategoriesSpent = (catId: string, budget?: Budget) => {
        const subCatIds = loadedCats.filter((c) => c.parentCategoryId === catId).map((c) => c.id);
        const targetIds = [catId, ...subCatIds];
        return monthlyExpenses
          .filter((tx) => {
            if (!tx.categoryId || !targetIds.includes(tx.categoryId)) return false;
            if (budget && budget.scope === 'individual' && budget.ownerUserId) {
              return tx.createdByUserId === budget.ownerUserId;
            }
            return true;
          })
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      };

      // 5. Agrupar por categoría padre para evitar duplicar límites entre padre e hijos
      const parentGroups: Record<string, { parentBudgets: Budget[]; subBudgets: Budget[] }> = {};
      for (const b of monthlyBudgets) {
        const cat = loadedCats.find((c) => c.id === b.categoryId);
        const isSub = !!cat?.parentCategoryId;
        const parentId = isSub ? cat!.parentCategoryId! : b.categoryId;

        if (!parentGroups[parentId]) {
          parentGroups[parentId] = { parentBudgets: [], subBudgets: [] };
        }
        if (isSub) {
          parentGroups[parentId].subBudgets.push(b);
        } else {
          parentGroups[parentId].parentBudgets.push(b);
        }
      }

      let totalLimit = 0;
      let totalSpent = 0;

      for (const [parentId, group] of Object.entries(parentGroups)) {
        const parentBudget = group.parentBudgets[0];
        if (group.subBudgets.length > 0) {
          const limit = parentBudget
            ? Number(parentBudget.amountLimit || 0)
            : group.subBudgets.reduce((sum, s) => sum + Number(s.amountLimit || 0), 0);
          const spent = getCategoryAndSubcategoriesSpent(parentId, parentBudget || group.subBudgets[0]);
          totalLimit += limit;
          totalSpent += spent;
        } else if (parentBudget) {
          totalLimit += Number(parentBudget.amountLimit || 0);
          totalSpent += getCategoryAndSubcategoriesSpent(parentId, parentBudget);
        }
      }

      const remaining = Math.max(0, totalLimit - totalSpent);
      const percentage = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

      await WidgetSyncService.updateWidget({
        remainingBudget: remaining,
        spentPercentage: percentage,
      });
    } catch (e) {
      console.warn('[BudgetSyncHelper] Error syncing budget to widget:', e);
    }
  }
}
