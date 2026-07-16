/**
 * ZenMoney — Interface TransactionRepository
 */

import { Transaction, CreateTransactionInput } from '../entities/Transaction';

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  type?: Transaction['type'];
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  status?: Transaction['status'];
  inputMethod?: Transaction['inputMethod'];
  recurringRuleId?: string;
  limit?: number;
  offset?: number;
}

export interface TransactionRepository {
  getById(id: string): Promise<Transaction | null>;
  getAll(filters?: TransactionFilters): Promise<Transaction[]>;
  create(input: CreateTransactionInput): Promise<Transaction>;
  update(id: string, data: Partial<CreateTransactionInput>): Promise<Transaction>;
  delete(id: string): Promise<void>;
  getByDateRange(startDate: string, endDate: string): Promise<Transaction[]>;
  getTotalByType(type: Transaction['type'], startDate: string, endDate: string): Promise<number>;
}
