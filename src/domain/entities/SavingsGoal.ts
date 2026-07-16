/**
 * ZenMoney — Entidad SavingsGoal
 */

export type GoalStatus = 'active' | 'completed' | 'cancelled';

export interface SavingsGoal {
  id: string;
  familyGroupId: string;
  ownerUserId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // YYYY-MM-DD
  status: GoalStatus;
  createdAt: string;
}

export interface CreateSavingsGoalInput {
  name: string;
  targetAmount: number;
  targetDate: string;
  currentAmount?: number;
}
