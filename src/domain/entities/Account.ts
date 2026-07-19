/**
 * ZenMoney — Entidad Account
 */

export type AccountType = 'cash' | 'bank' | 'credit_card' | 'investment' | 'loan' | 'mortgage';

export interface Account {
  id: string;
  familyGroupId: string;
  ownerUserId: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
  closingDay?: number | null;
  paymentDay?: number | null;
  isPrivate?: boolean;
}

export interface CreateAccountInput {
  id?: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  currency?: string;
  closingDay?: number | null;
  paymentDay?: number | null;
  isPrivate?: boolean;
}
