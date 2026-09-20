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
  async execute(account: Account, preferCache = false): Promise<number> {
    // Si estamos en modo offline/caché y la cuenta ya tiene un saldo consolidado conocido (currentBalance):
    if (preferCache && account.currentBalance !== undefined && account.currentBalance !== null) {
      // Solo aplicamos transacciones locales que aún NO hayan sido sincronizadas con la nube (synced = 0)
      let unsynced: any[] = [];
      try {
        if (typeof (this.transactionRepository as any).getUnsynced === 'function') {
          unsynced = await (this.transactionRepository as any).getUnsynced();
        }
      } catch {
        unsynced = [];
      }

      if (unsynced && unsynced.length > 0) {
        const accountUnsynced = unsynced.filter((t: any) =>
          (t.accountId === account.id || t.transferToAccountId === account.id) && t.status === 'confirmed'
        );
        return this.applyTransactions(account, Number(account.currentBalance), accountUnsynced);
      }

      return Number(account.currentBalance);
    }

    const transactions = await (this.transactionRepository as any).getAll({
      accountId: account.id,
      status: 'confirmed',
    }, preferCache);

    return this.applyTransactions(account, Number(account.initialBalance), transactions);
  }

  private applyTransactions(account: Account, baseBalance: number, transactions: any[]): number {
    let balance = baseBalance;
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
