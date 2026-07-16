/**
 * ZenMoney — Estructuras para Procesamiento de Lenguaje Natural (NLQ)
 */

import { TransactionType } from './Transaction';
import { Account } from './Account';
import { Category } from './Category';
import { BudgetProgress } from './Budget';
import { Transaction } from './Transaction';

export interface NLQParseResult {
  amount: number | null;
  type: TransactionType | null;
  suggestedCategoryName: string | null;
  suggestedAccountName: string | null;
  merchantName: string | null;
  description: string | null;
  transactionDate: string | null;
  confidence: number; // 0 a 1
  needsUserInput: string[]; // Lista de campos requeridos no detectados
  rawInput: string;
}

export interface NLQQueryResult {
  answer: string;
  data?: Record<string, unknown>;
  suggestedActions?: string[];
}

export interface FinancialContext {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  budgets: BudgetProgress[];
  recentTransactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  currentDate: string;
  currency: string;
}

export interface AIProvider {
  readonly name: string;
  parseTransaction(
    input: string,
    accounts: Account[],
    categories: Category[]
  ): Promise<NLQParseResult>;
  queryFinances(
    question: string,
    context: FinancialContext
  ): Promise<NLQQueryResult>;
}
