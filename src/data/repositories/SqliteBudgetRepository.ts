import { BudgetRepository } from '@domain/repositories/BudgetRepository';
import { Budget, CreateBudgetInput } from '@domain/entities/Budget';
import { LocalDatabase } from '../local/LocalDatabase';

export class SqliteBudgetRepository implements BudgetRepository {
  private getDb() {
    return LocalDatabase.getDb();
  }

  async getById(id: string): Promise<Budget | null> {
    const db = this.getDb();
    const row = await db.getFirstAsync<any>('SELECT * FROM budgets WHERE id = ?;', [id]);
    if (!row) return null;
    return this.toDomain(row);
  }

  async getByMonth(year: number, month: number): Promise<Budget[]> {
    const db = this.getDb();
    const rows = await db.getAllAsync<any>('SELECT * FROM budgets WHERE year = ? AND month = ?;', [year, month]);
    return rows.map(this.toDomain);
  }

  async create(input: CreateBudgetInput): Promise<Budget> {
    const db = this.getDb();
    const id = (input as any).id || Math.random().toString(36).substring(2, 15);
    const familyGroupId = (input as any).familyGroupId || 'offline-family';
    const ownerUserId = input.scope === 'individual' ? ((input as any).ownerUserId || 'offline-user') : null;
    const createdAt = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO budgets (id, family_group_id, category_id, amount_limit, year, month, scope, owner_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        familyGroupId,
        input.categoryId,
        input.amountLimit,
        input.year,
        input.month,
        input.scope || 'family',
        ownerUserId,
        createdAt
      ]
    );

    return {
      id,
      familyGroupId,
      categoryId: input.categoryId,
      amountLimit: input.amountLimit,
      year: input.year,
      month: input.month,
      scope: input.scope || 'family',
      ownerUserId,
      createdAt
    };
  }

  async update(id: string, data: Partial<CreateBudgetInput>): Promise<Budget> {
    const db = this.getDb();
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Presupuesto no encontrado: ${id}`);
    }

    const amountLimit = data.amountLimit !== undefined ? data.amountLimit : existing.amountLimit;
    const year = data.year !== undefined ? data.year : existing.year;
    const month = data.month !== undefined ? data.month : existing.month;
    const scope = data.scope !== undefined ? data.scope : existing.scope;

    await db.runAsync(
      `UPDATE budgets SET amount_limit = ?, year = ?, month = ?, scope = ? WHERE id = ?;`,
      [amountLimit, year, month, scope, id]
    );

    return {
      ...existing,
      amountLimit,
      year,
      month,
      scope
    };
  }

  async delete(id: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync('DELETE FROM budgets WHERE id = ?;', [id]);
  }

  async bulkSave(budgets: Budget[]): Promise<void> {
    const db = this.getDb();
    for (const b of budgets) {
      await db.runAsync(
        `INSERT OR REPLACE INTO budgets (id, family_group_id, category_id, amount_limit, year, month, scope, owner_user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          b.id,
          b.familyGroupId,
          b.categoryId,
          b.amountLimit,
          b.year,
          b.month,
          b.scope,
          b.ownerUserId,
          b.createdAt
        ]
      );
    }
  }

  private toDomain(row: any): Budget {
    return {
      id: row.id,
      familyGroupId: row.family_group_id,
      categoryId: row.category_id,
      amountLimit: row.amount_limit,
      year: row.year,
      month: row.month,
      scope: row.scope,
      ownerUserId: row.owner_user_id,
      createdAt: row.created_at
    };
  }
}
