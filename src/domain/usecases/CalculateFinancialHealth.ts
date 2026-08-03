/**
 * ZenMoney — Caso de Uso: CalculateFinancialHealth
 *
 * Evalúa cuantitativamente el desglose de gastos e ingresos del hogar frente
 * a las metas de la Metodología Financiera seleccionada (50/30/20, 70/20/10, 60/20/20, FIRE).
 */

import { Transaction } from '../entities/Transaction';
import { Category, inferCategoryBudgetRole } from '../entities/Category';
import { Account } from '../entities/Account';
import {
  FinancialMethodology,
  FinancialHealthBreakdown,
  BudgetRole,
  MethodologyTargets,
} from '../entities/FinancialMethodology';

export class CalculateFinancialHealth {
  
  static execute(
    transactions: Transaction[],
    categories: Category[],
    methodology: FinancialMethodology,
    accounts: Account[] = []
  ): FinancialHealthBreakdown {
    // Mapa de categorías para resolución jerárquica
    const fullCatMap = new Map<string, Category>();
    categories.forEach((cat) => fullCatMap.set(cat.id, cat));

    // Mapa de cuentas para evaluar transferencias hacia/desde inversión
    const accountMap = new Map<string, Account>();
    accounts.forEach((acc) => accountMap.set(acc.id, acc));

    const resolveRole = (catId: string | null): BudgetRole => {
      if (!catId) return 'needs';
      const cat = fullCatMap.get(catId);
      if (!cat) return 'needs';

      const parent = cat.parentCategoryId ? fullCatMap.get(cat.parentCategoryId) : undefined;

      // Respetar el rol explícito asignado a la categoría o a su categoría padre
      if (cat.budgetRole) return cat.budgetRole;
      if (parent?.budgetRole) return parent.budgetRole;

      return inferCategoryBudgetRole(cat.name, parent?.name, cat.budgetRole);
    };

    let totalIncome = 0;
    let totalExpense = 0;

    const actualAmounts: Record<BudgetRole, number> = {
      needs: 0,
      wants: 0,
      savings: 0,
      charity: 0,
      income: 0,
      ignore: 0,
    };

    // Procesar cada transacción
    transactions.forEach((tx) => {
      if (tx.type === 'income') {
        totalIncome += tx.amount;
        actualAmounts.income += tx.amount;
      } else if (tx.type === 'expense') {
        totalExpense += tx.amount;
        const role = resolveRole(tx.categoryId);
        if (role !== 'ignore' && role !== 'income') {
          actualAmounts[role] = (actualAmounts[role] || 0) + tx.amount;
        }
      } else if (tx.type === 'transfer') {
        const sourceAccount = accountMap.get(tx.accountId);
        const targetAccount = tx.transferToAccountId ? accountMap.get(tx.transferToAccountId) : undefined;

        const isTargetInvestment = targetAccount?.type === 'investment';
        const isSourceInvestment = sourceAccount?.type === 'investment';

        if (isTargetInvestment && !isSourceInvestment) {
          // Transferencia hacia cuenta de inversión (Ahorro/Inversión activo)
          actualAmounts.savings += tx.amount;
        } else if (isSourceInvestment && !isTargetInvestment) {
          // Retiro de cuenta de inversión hacia cuenta operativa (Desinversión)
          actualAmounts.savings = Math.max(0, actualAmounts.savings - tx.amount);
        }
      }
    });

    // La base de análisis es el Ingreso Total del mes (Elizabeth Warren 50/30/20 standard).
    // Si no se registraron ingresos en el mes (totalIncome === 0), se usa como fallback la suma trackeada.
    const totalTracked = actualAmounts.needs + actualAmounts.wants + actualAmounts.savings + actualAmounts.charity;
    const baseAmount = totalIncome > 0 ? totalIncome : (totalTracked > 0 ? totalTracked : 1);

    const actualPercentages: Record<BudgetRole, number> = {
      needs: Number(((actualAmounts.needs / baseAmount) * 100).toFixed(1)),
      wants: Number(((actualAmounts.wants / baseAmount) * 100).toFixed(1)),
      savings: Number(((actualAmounts.savings / baseAmount) * 100).toFixed(1)),
      charity: Number(((actualAmounts.charity / baseAmount) * 100).toFixed(1)),
      income: 100,
      ignore: 0,
    };

    const targets: MethodologyTargets = methodology.targets || {};
    const differences: Record<string, number> = {};

    // Diagnóstico de salud y diferencias monetarias
    const recommendations: string[] = [];
    let deviationCount = 0;

    if (targets.needs !== undefined) {
      const targetAmount = baseAmount * (targets.needs / 100);
      differences.needs = actualAmounts.needs - targetAmount;
      if (actualPercentages.needs > targets.needs + 5) {
        deviationCount++;
        const formattedDiff = `$${Math.abs(Math.round(differences.needs)).toLocaleString('es-CO')}`;
        recommendations.push(
          `Tus Necesidades Básicas (${actualPercentages.needs}%) exceden la meta del ${targets.needs}% por ${formattedDiff}.`
        );
      }
    }

    if (targets.wants !== undefined) {
      const targetAmount = baseAmount * (targets.wants / 100);
      differences.wants = actualAmounts.wants - targetAmount;
      if (actualPercentages.wants > targets.wants + 5) {
        deviationCount++;
        const formattedDiff = `$${Math.abs(Math.round(differences.wants)).toLocaleString('es-CO')}`;
        recommendations.push(
          `Tus Deseos (${actualPercentages.wants}%) superan la meta del ${targets.wants}% por ${formattedDiff}.`
        );
      }
    }

    if (targets.savings !== undefined) {
      const targetAmount = baseAmount * (targets.savings / 100);
      differences.savings = actualAmounts.savings - targetAmount;
      if (actualPercentages.savings < targets.savings - 3) {
        deviationCount++;
        const formattedNeeded = `$${Math.abs(Math.round(differences.savings)).toLocaleString('es-CO')}`;
        recommendations.push(
          `Tu Ahorro e Inversión (${actualPercentages.savings}%) está bajo la meta del ${targets.savings}%. Te faltaron ${formattedNeeded} este mes.`
        );
      }
    }

    let status: 'excellent' | 'good' | 'warning' | 'critical' = 'excellent';
    if (deviationCount === 0) {
      status = 'excellent';
      recommendations.push('¡Excelente alineación! Tus gastos están perfectamente balanceados según tu metodología.');
    } else if (deviationCount === 1) {
      status = 'good';
    } else if (deviationCount === 2) {
      status = 'warning';
    } else {
      status = 'critical';
    }

    return {
      methodology,
      totalIncome,
      totalExpense,
      actualAmounts,
      actualPercentages,
      targetPercentages: targets,
      status,
      recommendations,
    };
  }
}
