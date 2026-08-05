import { Account } from '../entities/Account';
import { CreateTransactionInput } from '../entities/Transaction';

export interface UserProfileSecurityInfo {
  userId: string;
  familyGroupId: string;
  role?: string;
  isActive?: boolean;
}

export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
}

export class SecurityGuard {
  /** Umbral de seguridad máximo recomendado para una sola transacción individual ($1,000,000) */
  private static MAX_SINGLE_TRANSACTION_LIMIT = 1000000;

  /**
   * Verifica si un usuario tiene autorización y parámetros seguros para registrar una transacción.
   */
  static canUserCreateTransaction(
    user: UserProfileSecurityInfo | null,
    input: CreateTransactionInput
  ): SecurityCheckResult {
    if (!user) {
      return { allowed: false, reason: 'Usuario no autenticado.' };
    }

    if (user.isActive === false) {
      return { allowed: false, reason: 'El usuario se encuentra inactivo.' };
    }

    if (input.amount <= 0) {
      return { allowed: false, reason: 'El monto debe ser estrictamente mayor a cero.' };
    }

    if (input.amount > this.MAX_SINGLE_TRANSACTION_LIMIT) {
      return {
        allowed: false,
        reason: `El monto excede el umbral máximo de seguridad por transacción ($${this.MAX_SINGLE_TRANSACTION_LIMIT.toLocaleString()}).`,
      };
    }

    return { allowed: true };
  }

  /**
   * Verifica si un usuario tiene acceso a una cuenta bancaria o de crédito según su propiedad o grupo familiar.
   */
  static canUserAccessAccount(
    user: UserProfileSecurityInfo | null,
    account: Account
  ): SecurityCheckResult {
    if (!user) {
      return { allowed: false, reason: 'Usuario no autenticado.' };
    }

    // Cuentas privadas del usuario
    if (account.isPrivate && account.ownerUserId && account.ownerUserId !== user.userId) {
      return { allowed: false, reason: 'No tienes acceso a esta cuenta privada.' };
    }

    // Cuentas familiares
    if (account.familyGroupId && account.familyGroupId !== user.familyGroupId) {
      return { allowed: false, reason: 'La cuenta no pertenece a tu grupo familiar.' };
    }

    return { allowed: true };
  }
}
