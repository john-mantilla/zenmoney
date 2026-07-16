/**
 * ZenMoney — Caso de Uso: CalculateAccountBalance
 *
 * Calcula el saldo actual de una cuenta basándose en sus transacciones confirmadas.
 * Soporta cuentas normales (efectivo, banco, inversión) y tarjetas de crédito.
 */

import { Account } from '../entities/Account';
import { TransactionRepository } from '../repositories/TransactionRepository';

export class CalculateAccountBalance {
  constructor(private transactionRepository: TransactionRepository) {}

  /**
   * Ejecuta el cálculo de saldo de la cuenta dada.
   *
   * Reglas de negocio:
   * - Solo incluye transacciones con estado 'confirmed'.
   * - Para cuentas normales: saldoInicial + ingresos - gastos - transferenciasEnviadas + transferenciasRecibidas.
   * - Para tarjetas de crédito: saldoInicial (típicamente 0 o límite negativo) - gastos + ingresos (pagos a la tarjeta).
   * - Las transferencias entre cuentas propias se restan de la origen y se suman en la destino.
   */
  async execute(account: Account): Promise<number> {
    const transactions = await this.transactionRepository.getAll({
      accountId: account.id,
      status: 'confirmed',
    });

    let balance = Number(account.initialBalance);
    const isDebt = ['credit_card', 'loan', 'mortgage'].includes(account.type);

    for (const tx of transactions) {
      const amount = Number(tx.amount);

      if (isDebt) {
        // Cuentas de Deuda: el saldo representa la deuda total acumulada
        if (tx.type === 'expense') {
          // El gasto aumenta la deuda
          balance += amount;
        } else if (tx.type === 'income') {
          // El ingreso (pago directo) disminuye la deuda
          balance -= amount;
        } else if (tx.type === 'transfer') {
          if (tx.transferToAccountId === account.id) {
            // Transferencia de abono entrante para pagar la deuda (disminuye deuda)
            balance -= amount;
          } else if (tx.accountId === account.id) {
            // Transferencia saliendo de la tarjeta (ej. avance de efectivo) (incrementa deuda)
            balance += amount;
          }
        }
      } else {
        // Cuentas Estándar (efectivo, banco, inversiones): saldo disponible líquido
        if (tx.type === 'income') {
          // El ingreso aumenta el disponible
          balance += amount;
        } else if (tx.type === 'expense') {
          // El gasto disminuye el disponible
          balance -= amount;
        } else if (tx.type === 'transfer') {
          if (tx.accountId === account.id) {
            // Transferencia saliendo (disminuye disponible)
            balance -= amount;
          } else if (tx.transferToAccountId === account.id) {
            // Transferencia entrante (aumenta disponible)
            balance += amount;
          }
        }
      }
    }

    return balance;
  }
}
