/**
 * ZenMoney — Entidad Account
 */

export type AccountType = 'bank' | 'cash' | 'credit_card' | 'loan' | 'investment';

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
  color?: string;
  icon?: string;
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
  color?: string;
  icon?: string;
}
