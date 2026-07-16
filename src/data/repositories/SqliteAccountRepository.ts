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
      `INSERT INTO accounts (id, family_group_id, owner_user_id, name, type, initial_balance, currency, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        familyGroupId,
        ownerUserId,
        input.name,
        input.type,
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

  async bulkSave(accounts: Account[]): Promise<void> {
    const db = this.getDb();
    for (const acc of accounts) {
      await db.runAsync(
        `INSERT OR REPLACE INTO accounts (id, family_group_id, owner_user_id, name, type, initial_balance, currency, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          acc.id,
          acc.familyGroupId,
          acc.ownerUserId,
          acc.name,
          acc.type,
          acc.initialBalance,
          acc.currency,
          acc.isActive ? 1 : 0,
          acc.createdAt
        ]
      );
    }
  }

  private toDomain(row: any): Account {
    return {
      id: row.id,
      familyGroupId: row.family_group_id,
      ownerUserId: row.owner_user_id,
      name: row.name,
      type: row.type,
      initialBalance: row.initial_balance,
      currency: row.currency,
      isActive: row.is_active === 1,
      createdAt: row.created_at
    };
  }
}
