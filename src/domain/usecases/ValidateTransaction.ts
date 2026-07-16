/**
 * ZenMoney — Caso de Uso: ValidateTransaction
 *
 * Realiza la validación de negocio para la creación o actualización de transacciones.
 */

import { CreateTransactionInput } from '../entities/Transaction';
import { Account } from '../entities/Account';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class ValidateTransaction {
  /**
   * Valida los datos de entrada de una transacción contra las reglas de negocio básicas.
   */
  execute(input: CreateTransactionInput, activeAccounts: Account[]): ValidationResult {
    const errors: string[] = [];

    // 1. Validar Monto
    if (input.amount <= 0) {
      errors.push('El monto de la transacción debe ser mayor a cero.');
    }

    // 2. Validar Cuenta Origen
    const accountExists = activeAccounts.some(acc => acc.id === input.accountId && acc.isActive);
    if (!accountExists) {
      errors.push('La cuenta seleccionada no existe o no está activa.');
    }

    // 3. Validar Categoría
    if (input.type !== 'transfer' && !input.categoryId) {
      errors.push('Las transacciones de ingreso o gasto requieren una categoría.');
    }

    // 4. Validar Transferencias
    if (input.type === 'transfer') {
      if (!input.transferToAccountId) {
        errors.push('Las transferencias requieren una cuenta de destino.');
      } else {
        if (input.transferToAccountId === input.accountId) {
          errors.push('La cuenta de destino no puede ser la misma cuenta de origen.');
        }
        const transferAccountExists = activeAccounts.some(acc => acc.id === input.transferToAccountId && acc.isActive);
        if (!transferAccountExists) {
          errors.push('La cuenta de destino no existe o no está activa.');
        }
      }
    }

    // 5. Validar Fecha
    if (input.transactionDate) {
      const parts = input.transactionDate.split('-');
      const txYear = Number(parts[0]);
      const txMonth = Number(parts[1]) - 1;
      const txDay = Number(parts[2]);

      const txDate = new Date(txYear, txMonth, txDay, 0, 0, 0, 0);
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      oneYearFromNow.setHours(23, 59, 59, 999);

      if (txDate > oneYearFromNow) {
        errors.push('La fecha de la transacción no puede ser mayor a un año en el futuro.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
