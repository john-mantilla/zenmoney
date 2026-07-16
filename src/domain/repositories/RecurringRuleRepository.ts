/**
 * ZenMoney — Interface RecurringRuleRepository
 */

import { RecurringRule, CreateRecurringRuleInput } from '../entities/RecurringRule';

export interface RecurringRuleRepository {
  getById(id: string): Promise<RecurringRule | null>;
  getAllActive(): Promise<RecurringRule[]>;
  create(input: CreateRecurringRuleInput): Promise<RecurringRule>;
  update(id: string, data: Partial<CreateRecurringRuleInput>): Promise<RecurringRule>;
  delete(id: string): Promise<void>;
}
