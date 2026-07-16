/**
 * ZenMoney — Interface AccountRepository
 */

import { Account, CreateAccountInput } from '../entities/Account';

export interface AccountRepository {
  getById(id: string): Promise<Account | null>;
  getAll(): Promise<Account[]>;
  create(input: CreateAccountInput): Promise<Account>;
  update(id: string, data: Partial<CreateAccountInput>): Promise<Account>;
  delete(id: string): Promise<void>;
}
