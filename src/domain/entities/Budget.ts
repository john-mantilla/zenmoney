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
  hasRollover?: boolean; // Si true, acumula el superávit o descuenta el déficit del mes anterior
  isOverride?: boolean; // Si true, es una anulación/límite puntual para este mes
  overrideReason?: string; // Motivo opcional (ej. "Navidad", "Vacaciones")
  createdAt: string;
}

export interface BudgetProgress {
  budget: Budget;
  spent: number;
  remaining: number;
  percentage: number; // 0 a 100+
  status: 'ok' | 'warning' | 'exceeded';
  rolloverAmount?: number; // Saldo trasladado del mes anterior (positivo si hubo ahorro, negativo si hubo déficit)
  effectiveLimit?: number; // amountLimit + rolloverAmount
  isOverride?: boolean;
  overrideReason?: string;
  baseMasterLimit?: number; // Límite de la regla maestra si este mes tiene override
}

export interface CreateBudgetInput {
  id?: string;
  categoryId: string;
  amountLimit: number;
  year: number;
  month: number;
  scope?: BudgetScope;
  ownerUserId?: string | null;
  hasRollover?: boolean;
  isOverride?: boolean;
  overrideReason?: string;
}
