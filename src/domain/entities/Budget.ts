/**
 * ZenMoney — Entidad Budget
 */

export type BudgetScope = 'family' | 'individual';

export interface Budget {
  id: string;
  familyGroupId: string;
  categoryId: string;
  amountLimit: number;
  year: number;
  month: number; // 1-12
  scope: BudgetScope;
  ownerUserId: string | null; // Null si es compartido familiar
  createdAt: string;
}

export interface BudgetProgress {
  budget: Budget;
  spent: number;
  remaining: number;
  percentage: number; // 0 a 100+
  status: 'ok' | 'warning' | 'exceeded';
}

export interface CreateBudgetInput {
  id?: string;
  categoryId: string;
  amountLimit: number;
  year: number;
  month: number;
  scope?: BudgetScope;
  ownerUserId?: string | null;
}
