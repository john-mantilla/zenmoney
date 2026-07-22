/**
 * ZenMoney — Interface BudgetRepository
 */

import { Budget, CreateBudgetInput } from '../entities/Budget';

export interface BudgetRepository {
  getById(id: string): Promise<Budget | null>;
  getAll(): Promise<Budget[]>;
  getByMonth(year: number, month: number): Promise<Budget[]>;
  create(input: CreateBudgetInput): Promise<Budget>;
  update(id: string, data: Partial<CreateBudgetInput>): Promise<Budget>;
  delete(id: string): Promise<void>;
}
