/**
 * ZenMoney — Entidad Transaction
 */

export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionStatus = 'confirmed' | 'pending';
export type InputMethod = 'manual' | 'voice' | 'nlq' | 'email' | 'photo';

export interface AIMetadata {
  rawInput: string;
  parsedAmount: number | null;
  parsedCategory: string | null;
  parsedAccount: string | null;
  parsedMerchant: string | null;
  confidence: number;
  corrections: Record<string, { original: string; corrected: string }>;
  dueDate?: string;
  occurrenceDate?: string;
}

export interface Transaction {
  id: string;
  familyGroupId: string;
  accountId: string;
  categoryId: string | null;
  createdByUserId: string;
  type: TransactionType;
  amount: number; // Siempre positivo en el dominio
  currency: string;
  description: string | null;
  merchantName: string | null;
  transactionDate: string; // Formato YYYY-MM-DD
  transferToAccountId: string | null; // Null excepto para transferencias
  isRecurringInstance: boolean;
  recurringRuleId: string | null;
  status: TransactionStatus;
  inputMethod: InputMethod;
  aiMetadata: AIMetadata | null;
  /** Si es true, solo el creador puede verla — el resto de la familia no (RLS). */
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
}

export interface CreateTransactionInput {
  accountId: string;
  categoryId: string | null;
  type: TransactionType;
  amount: number;
  currency?: string;
  description?: string | null;
  merchantName?: string | null;
  transactionDate?: string;
  transferToAccountId?: string | null;
  inputMethod?: InputMethod;
  aiMetadata?: AIMetadata | null;
  isPrivate?: boolean;
}
