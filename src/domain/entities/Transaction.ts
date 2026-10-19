/**
 * ZenMoney — Entidad Transaction
 */

import { Tag } from './Tag';

export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionStatus = 'confirmed' | 'pending' | 'archived';
export type InputMethod = 'manual' | 'voice' | 'nlq' | 'email' | 'photo';

export interface InstallmentMetadata {
  groupId: string;
  totalAmount: number;
  count: number;
  currentNumber: number;
  monthlyAmount: number;
  startDate: string;
}

export interface TransactionCategorySplit {
  id: string;
  categoryId: string;
  amount: number;
  note?: string | null;
}

export interface TransactionPeriodSplit {
  totalMonths: number;          // 2 a 36 meses
  monthlyAmount: number;        // Monto prorrateado mensual (round(amount / totalMonths))
  startMonth: string;           // "YYYY-MM"
  endMonth: string;             // "YYYY-MM"
  accountFlowDate: string;      // "YYYY-MM-DD" fecha real del débito bancario
}

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
  is_bank_notification?: boolean;
  bank_name?: string;
  installments?: InstallmentMetadata;
  splits?: TransactionCategorySplit[];
  periodSplit?: TransactionPeriodSplit;
  isBill?: boolean;
  isCCStatement?: boolean;
}

/**
 * Determina si una transacción corresponde a una Factura / Cuenta por Pagar (Bill).
 * Estas transacciones representan obligaciones a pagar (recurrentes o puntuales)
 * y pertenecen al calendario de Facturas, NO a la bandeja de confirmación de correos.
 */
export function isBillTransaction(tx: Partial<Transaction>): boolean {
  if (tx.isRecurringInstance || tx.recurringRuleId) return true;
  if (tx.aiMetadata?.isBill || tx.aiMetadata?.dueDate || (tx.aiMetadata as any)?.isCCStatement) return true;
  return false;
}

/**
 * Determina si una transacción es un movimiento pendiente por confirmar (Factura electrónica DIAN,
 * notificación bancaria recibida por correo, o nota de voz del smartwatch sin confirmar).
 * Se excluyen explícitamente las Facturas / Cuentas por Pagar (Bills).
 */
export function isPendingConfirmationTransaction(tx: Partial<Transaction>): boolean {
  if (tx.status !== 'pending') return false;
  if (isBillTransaction(tx)) return false;
  return true;
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
  tags?: Tag[]; // Etiquetas de la transacción
  splits?: TransactionCategorySplit[];
  periodSplit?: TransactionPeriodSplit;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
}

export interface CreateTransactionInput {
  id?: string;
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
  tags?: string[]; // IDs de los tags a asociar
  splits?: TransactionCategorySplit[];
  periodSplit?: TransactionPeriodSplit;
}

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  search?: string;
  status?: TransactionStatus;
  tagIds?: string[];
  limit?: number;
  offset?: number;
}
