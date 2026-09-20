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

    await db.runAsync(
      `INSERT INTO accounts (id, family_group_id, owner_user_id, name, type, initial_balance, current_balance, currency, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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

    await db.runAsync(
      `UPDATE accounts SET name = ?, type = ?, initial_balance = ?, currency = ? WHERE id = ?;`,
      [name, type, initialBalance, currency, id]
    );

    return {
      ...existing,
      name,
      type,
      initialBalance,
      currency
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

  async bulkSave(accounts: Account[]): Promise<void> {
    const db = this.getDb();
    const nowIso = new Date().toISOString();
    for (const acc of accounts) {
      try {
        await db.runAsync(
          `INSERT INTO accounts (id, family_group_id, owner_user_id, name, type, initial_balance, current_balance, currency, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             type = excluded.type,
             initial_balance = excluded.initial_balance,
             current_balance = COALESCE(excluded.current_balance, accounts.current_balance),
             currency = excluded.currency,
             is_active = excluded.is_active;`,
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
            acc.createdAt || nowIso
          ]
        );
      } catch (err) {
        console.warn(`[SqliteAccRepo] Error in bulkSave for account ${acc.id}:`, err);
      }
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
      createdAt: row.created_at
    };
  }
}
