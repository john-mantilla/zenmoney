/**
 * ZenMoney — Caso de Uso: CalculateFinancialHealth
 *
 * Evalúa cuantitativamente el desglose de gastos e ingresos del hogar frente
 * a las metas de la Metodología Financiera seleccionada (50/30/20, 70/20/10, 60/20/20, FIRE).
 */

import { Transaction } from '../entities/Transaction';
import { Category, inferCategoryBudgetRole } from '../entities/Category';
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
    methodology: FinancialMethodology
  ): FinancialHealthBreakdown {
    // Mapa de categorías para resolución jerárquica
    const fullCatMap = new Map<string, Category>();
    categories.forEach((cat) => fullCatMap.set(cat.id, cat));

    const resolveRole = (catId: string | null): BudgetRole => {
      if (!catId) return 'needs';
      const cat = fullCatMap.get(catId);
      if (!cat) return 'needs';

      const parent = cat.parentCategoryId ? fullCatMap.get(cat.parentCategoryId) : undefined;
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
      }
    });

    // La torta del consumo desglosado suma el 100% del gasto analizado
    const totalTracked = actualAmounts.needs + actualAmounts.wants + actualAmounts.savings + actualAmounts.charity;
    const baseAmount = totalTracked > 0 ? totalTracked : 1;

    const actualPercentages: Record<BudgetRole, number> = {
      needs: totalTracked > 0 ? Number(((actualAmounts.needs / baseAmount) * 100).toFixed(1)) : 0,
      wants: totalTracked > 0 ? Number(((actualAmounts.wants / baseAmount) * 100).toFixed(1)) : 0,
      savings: totalTracked > 0 ? Number(((actualAmounts.savings / baseAmount) * 100).toFixed(1)) : 0,
      charity: totalTracked > 0 ? Number(((actualAmounts.charity / baseAmount) * 100).toFixed(1)) : 0,
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
