/**
 * ZenMoney — Caso de Uso: GetHistoricalFinancialAnalysis
 *
 * Consolida el análisis financiero histórico de los últimos 12 meses:
 * - Desglose mes a mes (ingresos, gastos, balance neto, top categorías).
 * - Métricas agregadas de los últimos 3 meses (trimestre) y 12 meses (anual).
 * - Detección de patrones de gastos recurrentes (arriendos, servicios, suscripciones).
 */

import { TransactionRepository } from '../repositories/TransactionRepository';
import { Category } from '../entities/Category';
import { Transaction } from '../entities/Transaction';

export interface MonthlyHistoryItem {
  monthKey: string; // YYYY-MM
  monthLabel: string; // ej. "Jul 2024"
  income: number;
  expenses: number;
  net: number;
  topCategories: { name: string; amount: number }[];
}

export interface HistoricalAnalysis {
  monthlyBreakdown: MonthlyHistoryItem[];
  totalExpensesLast3Months: number;
  totalIncomeLast3Months: number;
  averageMonthlyExpenseLast3Months: number;
  totalExpensesLast12Months: number;
  totalIncomeLast12Months: number;
  averageMonthlyExpenseLast12Months: number;
  topCategoriesLast12Months: { name: string; amount: number; percentage: number }[];
  recurringPatterns: { concept: string; averageAmount: number; occurrences: number }[];
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export class GetHistoricalFinancialAnalysis {
  constructor(private transactionRepo: TransactionRepository) {}

  async execute(categories: Category[], referenceDate = new Date(), monthsCount = 12): Promise<HistoricalAnalysis> {
    const today = referenceDate;
    const categoryMap = new Map<string, string>();
    for (const cat of categories) {
      categoryMap.set(cat.id, cat.name);
    }

    // 1. Generar los slots de meses en orden cronológico (de más antiguo a más reciente)
    const monthSlots: {
      key: string;
      label: string;
      income: number;
      expenses: number;
      categoryTotals: Record<string, number>;
    }[] = [];

    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const label = `${MONTH_NAMES[month - 1]} ${year}`;

      monthSlots.push({
        key,
        label,
        income: 0,
        expenses: 0,
        categoryTotals: {},
      });
    }

    const startDate = `${monthSlots[0].key}-01`;
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const endDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    // 2. Consultar transacciones en el rango histórico de 12 meses
    const txs = await this.transactionRepo.getAll({
      startDate,
      endDate,
      status: 'confirmed',
    });

    const overallCategoryTotals: Record<string, number> = {};
    const recurringTracker: Record<string, { months: Set<string>; amounts: number[] }> = {};

    // 3. Procesar transacciones
    for (const tx of txs) {
      if (tx.status !== 'confirmed') continue;

      const txMonthKey = tx.transactionDate.substring(0, 7);
      const slot = monthSlots.find(s => s.key === txMonthKey);
      if (!slot) continue;

      const amount = Number(tx.amount);
      if (tx.type === 'income') {
        slot.income += amount;
      } else if (tx.type === 'expense') {
        slot.expenses += amount;

        // Categoría
        const catName = (tx.categoryId && categoryMap.get(tx.categoryId)) || 'Sin clasificar';
        slot.categoryTotals[catName] = (slot.categoryTotals[catName] || 0) + amount;
        overallCategoryTotals[catName] = (overallCategoryTotals[catName] || 0) + amount;

        // Rastreo de recurrencia por concepto
        const concept = (tx.merchantName || tx.description || '').trim();
        if (concept.length >= 3) {
          const normalizedConcept = concept.toLowerCase();
          if (!recurringTracker[normalizedConcept]) {
            recurringTracker[normalizedConcept] = { months: new Set(), amounts: [] };
          }
          recurringTracker[normalizedConcept].months.add(txMonthKey);
          recurringTracker[normalizedConcept].amounts.push(amount);
        }
      }
    }

    // 4. Formatear desglose mensual
    const monthlyBreakdown: MonthlyHistoryItem[] = monthSlots.map(slot => {
      const topCategories = Object.entries(slot.categoryTotals)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);

      return {
        monthKey: slot.key,
        monthLabel: slot.label,
        income: slot.income,
        expenses: slot.expenses,
        net: slot.income - slot.expenses,
        topCategories,
      };
    });

    // 5. Métricas de los últimos 3 meses (trimestre reciente)
    const last3Slots = monthlyBreakdown.slice(-3);
    const totalExpensesLast3Months = last3Slots.reduce((sum, s) => sum + s.expenses, 0);
    const totalIncomeLast3Months = last3Slots.reduce((sum, s) => sum + s.income, 0);
    const averageMonthlyExpenseLast3Months = Math.round(totalExpensesLast3Months / 3);

    // 6. Métricas de los 12 meses
    const totalExpensesLast12Months = monthlyBreakdown.reduce((sum, s) => sum + s.expenses, 0);
    const totalIncomeLast12Months = monthlyBreakdown.reduce((sum, s) => sum + s.income, 0);
    const activeMonthsCount = monthlyBreakdown.filter(s => s.expenses > 0 || s.income > 0).length || 1;
    const averageMonthlyExpenseLast12Months = Math.round(totalExpensesLast12Months / activeMonthsCount);

    // 7. Top 5 categorías del año
    const topCategoriesLast12Months = Object.entries(overallCategoryTotals)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalExpensesLast12Months > 0 ? Math.round((amount / totalExpensesLast12Months) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // 8. Gastos recurrentes observados (al menos 2 meses distintos)
    const recurringPatterns = Object.entries(recurringTracker)
      .filter(([_, data]) => data.months.size >= 2)
      .map(([concept, data]) => {
        const avg = Math.round(data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length);
        // Capitalizar primera letra para presentación limpia
        const prettyConcept = concept.charAt(0).toUpperCase() + concept.slice(1);
        return {
          concept: prettyConcept,
          averageAmount: avg,
          occurrences: data.amounts.length,
        };
      })
      .sort((a, b) => b.averageAmount - a.averageAmount)
      .slice(0, 5);

    return {
      monthlyBreakdown,
      totalExpensesLast3Months,
      totalIncomeLast3Months,
      averageMonthlyExpenseLast3Months,
      totalExpensesLast12Months,
      totalIncomeLast12Months,
      averageMonthlyExpenseLast12Months,
      topCategoriesLast12Months,
      recurringPatterns,
    };
  }
}
