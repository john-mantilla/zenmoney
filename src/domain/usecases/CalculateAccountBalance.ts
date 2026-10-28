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
   * Reglas de rendimiento y escalabilidad:
   * - En modo preferCache = true: Si la cuenta ya cuenta con un `currentBalance` consolidado (desde SQLite o Postgres),
   *   se retorna de inmediato en tiempo constante O(1), aplicando únicamente transacciones locales
   *   que aún no hayan sido sincronizadas con la nube (synced = 0).
   * - En modo preferCache = false: Se realiza el cálculo dinámico completo a partir de sus transacciones confirmadas.
   */
  async execute(account: Account, preferCache = false): Promise<number> {
    // Si estamos en modo caché y la cuenta ya tiene un saldo consolidado numérico conocido (currentBalance)
    if (preferCache && account.currentBalance !== undefined && account.currentBalance !== null && !isNaN(Number(account.currentBalance))) {
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
        if (accountUnsynced.length > 0) {
          return this.applyTransactions(account, Number(account.currentBalance), accountUnsynced);
        }
      }

      return Number(account.currentBalance);
    }

    try {
      const transactions = await (this.transactionRepository as any).getAll({
        accountId: account.id,
        status: 'confirmed',
      }, preferCache);

      // Si la consulta no trajo transacciones pero initialBalance es 0 y tenemos currentBalance, preservarlo
      if (transactions.length === 0 && account.currentBalance !== undefined && account.currentBalance !== null && Number(account.initialBalance) === 0) {
        return Number(account.currentBalance);
      }

      return this.applyTransactions(account, Number(account.initialBalance || 0), transactions);
    } catch (err) {
      console.warn('[CalculateAccountBalance] Fallback during dynamic calculation:', err);
      if (account.currentBalance !== undefined && account.currentBalance !== null) {
        return Number(account.currentBalance);
      }
      return Number(account.initialBalance || 0);
    }
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
