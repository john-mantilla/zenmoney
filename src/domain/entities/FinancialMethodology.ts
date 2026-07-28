/**
 * ZenMoney — Entidad FinancialMethodology
 *
 * Representa un modelo de presupuesto o metodología financiera (50/30/20, 70/20/10, FIRE, etc.)
 */

export type BudgetRole = 'needs' | 'wants' | 'savings' | 'charity' | 'income' | 'ignore';

export interface MethodologyTargets {
  needs?: number;
  wants?: number;
  savings?: number;
  charity?: number;
}

export interface FinancialMethodology {
  id: string;
  familyGroupId: string | null; // null si es preset del sistema
  name: string;
  code: string;
  description: string;
  isPreset: boolean;
  targets: MethodologyTargets;
  isActive: boolean;
  createdAt: string;
}

export interface FinancialHealthBreakdown {
  methodology: FinancialMethodology;
  totalIncome: number;
  totalExpense: number;
  actualAmounts: Record<BudgetRole, number>;
  actualPercentages: Record<BudgetRole, number>;
  targetPercentages: MethodologyTargets;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  recommendations: string[];
}
