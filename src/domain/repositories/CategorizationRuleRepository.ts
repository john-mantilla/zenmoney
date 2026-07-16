/**
 * ZenMoney — Interface CategorizationRuleRepository
 */

import { CategorizationRule, CreateCategorizationRuleInput } from '../entities/CategorizationRule';

export interface CategorizationRuleRepository {
  getAll(): Promise<CategorizationRule[]>;
  create(input: CreateCategorizationRuleInput): Promise<CategorizationRule>;
  update(id: string, data: Partial<CreateCategorizationRuleInput>): Promise<CategorizationRule>;
}
