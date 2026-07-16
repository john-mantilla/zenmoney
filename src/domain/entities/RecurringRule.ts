/**
 * ZenMoney — Entidad RecurringRule
 */

export type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface RecurringRule {
  id: string;
  familyGroupId: string;
  accountId: string;
  categoryId: string | null;
  type: 'income' | 'expense';
  amount: number;
  description: string | null;
  frequency: Frequency;
  dayOfMonth: number | null; // Relevante para mensual/anual
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD (opcional)
  isActive: boolean;
  createdAt: string;
}

export interface CreateRecurringRuleInput {
  accountId: string;
  categoryId?: string | null;
  type: 'income' | 'expense';
  amount: number;
  description?: string | null;
  frequency: Frequency;
  dayOfMonth?: number | null;
  startDate: string;
  endDate?: string | null;
}
