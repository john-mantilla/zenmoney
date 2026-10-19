/**
 * ZenMoney — Caso de Uso: ValidateTransaction
 *
 * Realiza la validación de negocio para la creación o actualización de transacciones.
 */

import { CreateTransactionInput } from '../entities/Transaction';
import { Account } from '../entities/Account';
import { CreateTransactionSchema } from '../schemas/TransactionSchema';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class ValidateTransaction {
  /**
   * Valida los datos de entrada de una transacción utilizando Zod y reglas contextuales.
   */
  execute(input: CreateTransactionInput, activeAccounts: Account[]): ValidationResult {
    const errors: string[] = [];

    // 1. Validación de esquema mediante Zod
    const zodParsed = CreateTransactionSchema.safeParse(input);
    if (!zodParsed.success) {
      const formattedErrors = zodParsed.error.issues.map((err) => err.message);
      errors.push(...formattedErrors);
    }

    // 2. Validar existencia y estado activo de Cuenta Origen en tiempo de ejecución
    const accountExists = activeAccounts.some((acc) => acc.id === input.accountId && acc.isActive);
    if (!accountExists) {
      errors.push('La cuenta seleccionada no existe o no está activa.');
    }

    // 3. Validar existencia y estado activo de Cuenta Destino para transferencias
    if (input.type === 'transfer' && input.transferToAccountId) {
      const transferAccountExists = activeAccounts.some((acc) => acc.id === input.transferToAccountId && acc.isActive);
      if (!transferAccountExists) {
        errors.push('La cuenta de destino no existe o no está activa.');
      }
    }

    // 4. Validar Fecha límite (máximo 1 año en el futuro)
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

    // 5. Validar Desglose Multicategoría (Category Split)
    if (input.splits && input.splits.length > 0) {
      if (input.splits.length < 2) {
        errors.push('El desglose multicategoría debe contener al menos 2 categorías.');
      }
      const sumSplits = input.splits.reduce((acc, s) => acc + s.amount, 0);
      const diff = Math.abs(sumSplits - input.amount);
      if (diff > 0.01) {
        if (sumSplits < input.amount) {
          const missing = input.amount - sumSplits;
          errors.push(`La suma de las categorías no coincide con el total. Faltan $${missing} por asignar.`);
        } else {
          const excess = sumSplits - input.amount;
          errors.push(`La suma de las categorías supera el total por $${excess}.`);
        }
      }
      if (input.splits.some((s) => s.amount <= 0)) {
        errors.push('Cada categoría desglosada debe tener un monto mayor a cero.');
      }
    }

    // 6. Validar Prorrateo Temporal (Period Split)
    if (input.periodSplit) {
      const { totalMonths } = input.periodSplit;
      if (totalMonths < 2 || totalMonths > 36) {
        errors.push('El prorrateo debe ser de entre 2 y 36 meses.');
      }
    }

    // Eliminar posibles errores duplicados manteniendo el primer mensaje
    const uniqueErrors = Array.from(new Set(errors));

    return {
      isValid: uniqueErrors.length === 0,
      errors: uniqueErrors,
    };
  }

  /**
   * Valida transiciones de estado permitidas:
   * pending -> confirmed (confirmar pago/ingreso)
   * pending -> archived (archivar/cancelar factura agendada)
   * confirmed -> archived (archivar transacción histórica)
   * archived -> confirmed (desarchivar transacción)
   */
  validateStatusTransition(currentStatus: string, newStatus: string): { isValid: boolean; error?: string } {
    if (currentStatus === newStatus) return { isValid: true };

    const allowedTransitions: Record<string, string[]> = {
      pending: ['confirmed', 'archived'],
      confirmed: ['archived'],
      archived: ['confirmed'],
    };

    const allowed = allowedTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return {
        isValid: false,
        error: `No se permite cambiar de estado '${currentStatus}' a '${newStatus}'.`,
      };
    }

    return { isValid: true };
  }
}
