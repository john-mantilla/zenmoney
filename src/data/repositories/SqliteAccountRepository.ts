import { AccountRepository } from '@domain/repositories/AccountRepository';
import { Account, CreateAccountInput } from '@domain/entities/Account';
import { LocalDatabase } from '../local/LocalDatabase';

export class SqliteAccountRepository implements AccountRepository {
  private getDb() {
    return LocalDatabase.getDb();
  }

  async getById(id: string): Promise<Account | null> {
    const db = this.getDb();
    const row = await db.getFirstAsync<any>('SELECT * FROM accounts WHERE id = ?;', [id]);
    if (!row) return null;
    return this.toDomain(row);
  }

  async getAll(): Promise<Account[]> {
    const db = this.getDb();
    const rows = await db.getAllAsync<any>('SELECT * FROM accounts WHERE is_active = 1 ORDER BY name ASC;');
    return rows.map(this.toDomain);
  }

  async create(input: CreateAccountInput): Promise<Account> {
    const db = this.getDb();
    const id = (input as any).id || Math.random().toString(36).substring(2, 15);
    const familyGroupId = (input as any).familyGroupId || 'offline-family';
    const ownerUserId = (input as any).ownerUserId || 'offline-user';
    const createdAt = new Date().toISOString();
    const isPrivate = input.isPrivate ? 1 : 0;
    const closingDay = input.closingDay !== undefined && input.closingDay !== null ? input.closingDay : null;
    const paymentDay = input.paymentDay !== undefined && input.paymentDay !== null ? input.paymentDay : null;
    const color = input.color || null;
    const icon = input.icon || null;

    await db.runAsync(
      `INSERT INTO accounts (
        id, family_group_id, owner_user_id, name, type,
        initial_balance, current_balance, currency, is_active, is_private,
        closing_day, payment_day, color, icon, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        familyGroupId,
        ownerUserId,
        input.name,
        input.type,
        input.initialBalance,
        input.initialBalance,
        input.currency || 'COP',
        1,
        isPrivate,
        closingDay,
        paymentDay,
        color,
        icon,
        createdAt
      ]
    );

    return {
      id,
      familyGroupId,
      ownerUserId,
      name: input.name,
      type: input.type,
      initialBalance: input.initialBalance,
      currentBalance: input.initialBalance,
      currency: input.currency || 'COP',
      isActive: true,
      isPrivate: Boolean(input.isPrivate),
      closingDay: input.closingDay || null,
      paymentDay: input.paymentDay || null,
      color: input.color || undefined,
      icon: input.icon || undefined,
      createdAt
    };
  }

  async update(id: string, data: Partial<CreateAccountInput>): Promise<Account> {
    const db = this.getDb();
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Cuenta no encontrada: ${id}`);
    }

    const name = data.name !== undefined ? data.name : existing.name;
    const type = data.type !== undefined ? data.type : existing.type;
    const initialBalance = data.initialBalance !== undefined ? data.initialBalance : existing.initialBalance;
    const currency = data.currency !== undefined ? data.currency : existing.currency;
    const isPrivate = data.isPrivate !== undefined ? (data.isPrivate ? 1 : 0) : (existing.isPrivate ? 1 : 0);
    const closingDay = data.closingDay !== undefined ? data.closingDay : (existing.closingDay ?? null);
    const paymentDay = data.paymentDay !== undefined ? data.paymentDay : (existing.paymentDay ?? null);
    const color = data.color !== undefined ? data.color : (existing.color ?? null);
    const icon = data.icon !== undefined ? data.icon : (existing.icon ?? null);

    await db.runAsync(
      `UPDATE accounts SET
        name = ?, type = ?, initial_balance = ?, currency = ?, is_private = ?,
        closing_day = ?, payment_day = ?, color = ?, icon = ?
       WHERE id = ?;`,
      [name, type, initialBalance, currency, isPrivate, closingDay, paymentDay, color, icon, id]
    );

    return {
      ...existing,
      name,
      type,
      initialBalance,
      currency,
      isPrivate: Boolean(isPrivate),
      closingDay,
      paymentDay,
      color: color || undefined,
      icon: icon || undefined
    };
  }

  async delete(id: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync('UPDATE accounts SET is_active = 0 WHERE id = ?;', [id]);
  }

  async updateBalance(id: string, balance: number): Promise<void> {
    const db = this.getDb();
    await db.runAsync('UPDATE accounts SET current_balance = ? WHERE id = ?;', [balance, id]);
  }

  /**
   * Recalcula y actualiza de forma atómica y determinista el `current_balance`
   * de una cuenta en SQLite a partir de su saldo inicial y sus transacciones confirmadas.
   */
  async recalculateBalance(accountId: string): Promise<number> {
    const db = this.getDb();
    const acc = await db.getFirstAsync<any>('SELECT id, type, initial_balance FROM accounts WHERE id = ?;', [accountId]);
    if (!acc) return 0;

    const isDebt = ['credit_card', 'loan', 'mortgage'].includes(acc.type);
    let balance = Number(acc.initial_balance || 0);

    const txs = await db.getAllAsync<any>(
      `SELECT type, amount, account_id, transfer_to_account_id
       FROM transactions
       WHERE status = 'confirmed' AND (account_id = ? OR transfer_to_account_id = ?);`,
      [accountId, accountId]
    );

    for (const tx of txs) {
      const amount = Number(tx.amount || 0);
      if (isDebt) {
        if (tx.type === 'expense') {
          balance += amount;
        } else if (tx.type === 'income') {
          balance -= amount;
        } else if (tx.type === 'transfer') {
          if (tx.transfer_to_account_id === accountId) {
            balance -= amount;
          } else if (tx.account_id === accountId) {
            balance += amount;
          }
        }
      } else {
        if (tx.type === 'income') {
          balance += amount;
        } else if (tx.type === 'expense') {
          balance -= amount;
        } else if (tx.type === 'transfer') {
          if (tx.account_id === accountId) {
            balance -= amount;
          } else if (tx.transfer_to_account_id === accountId) {
            balance += amount;
          }
        }
      }
    }

    balance = Math.round(balance * 100) / 100;
    await db.runAsync('UPDATE accounts SET current_balance = ? WHERE id = ?;', [balance, accountId]);
    return balance;
  }

  /**
   * Recalcula el saldo para un listado de cuentas (útil tras crear/editar transferencias o transacciones).
   */
  async recalculateBalances(accountIds: string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(accountIds.filter(Boolean)));
    for (const id of uniqueIds) {
      await this.recalculateBalance(id);
    }
  }


  async bulkSave(accounts: Account[]): Promise<void> {
    if (!accounts || accounts.length === 0) return;
    const db = this.getDb();
    const nowIso = new Date().toISOString();

    const runInserts = async () => {
      for (const acc of accounts) {
        try {
          await db.runAsync(
            `INSERT INTO accounts (
               id, family_group_id, owner_user_id, name, type,
               initial_balance, current_balance, currency, is_active, is_private,
               closing_day, payment_day, color, icon, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               type = excluded.type,
               initial_balance = excluded.initial_balance,
               current_balance = COALESCE(excluded.current_balance, accounts.current_balance),
               currency = excluded.currency,
               is_active = excluded.is_active,
               is_private = excluded.is_private,
               closing_day = excluded.closing_day,
               payment_day = excluded.payment_day,
               color = excluded.color,
               icon = excluded.icon;`,
            [
              acc.id,
              acc.familyGroupId || 'offline-family',
              acc.ownerUserId || 'offline-user',
              acc.name,
              acc.type,
              acc.initialBalance,
              acc.currentBalance ?? null,
              acc.currency || 'COP',
              acc.isActive ? 1 : 0,
              acc.isPrivate ? 1 : 0,
              acc.closingDay !== undefined && acc.closingDay !== null ? acc.closingDay : null,
              acc.paymentDay !== undefined && acc.paymentDay !== null ? acc.paymentDay : null,
              acc.color || null,
              acc.icon || null,
              acc.createdAt || nowIso
            ]
          );
        } catch (err) {
          console.warn(`[SqliteAccRepo] Error in bulkSave for account ${acc.id}:`, err);
        }
      }
    };

    if (typeof (db as any).withTransactionAsync === 'function') {
      await (db as any).withTransactionAsync(runInserts);
    } else {
      await runInserts();
    }
  }

  async syncWithRemote(remoteAccounts: Account[]): Promise<void> {
    const db = this.getDb();
    await this.bulkSave(remoteAccounts);

    const remoteIds = remoteAccounts.map(a => a.id);
    if (remoteIds.length > 0) {
      const placeholders = remoteIds.map(() => '?').join(',');
      await db.runAsync(
        `DELETE FROM accounts WHERE id NOT IN (${placeholders});`,
        remoteIds
      );
    }
  }

  async getUnsynced(): Promise<Account[]> {
    const db = this.getDb();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM accounts WHERE id IN (SELECT record_id FROM sync_actions_queue WHERE table_name = 'accounts' AND action_type = 'INSERT');`
    );
    return rows.map(row => this.toDomain(row));
  }

  public toDomain(row: any): Account {
    return {
      id: row.id,
      familyGroupId: row.family_group_id,
      ownerUserId: row.owner_user_id,
      name: row.name,
      type: row.type,
      initialBalance: row.initial_balance,
      currentBalance: row.current_balance !== null && row.current_balance !== undefined ? Number(row.current_balance) : undefined,
      currency: row.currency,
      isActive: row.is_active === 1,
      isPrivate: row.is_private === 1 || row.is_private === true,
      closingDay: row.closing_day !== null && row.closing_day !== undefined ? Number(row.closing_day) : null,
      paymentDay: row.payment_day !== null && row.payment_day !== undefined ? Number(row.payment_day) : null,
      color: row.color || undefined,
      icon: row.icon || undefined,
      createdAt: row.created_at
    };
  }
}
