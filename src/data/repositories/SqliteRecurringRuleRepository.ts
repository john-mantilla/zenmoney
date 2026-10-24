/**
 * ZenMoney — SqliteRecurringRuleRepository
 *
 * Implementa RecurringRuleRepository para SQLite local con soporte offline completo
 * y registro en sync_actions_queue para sincronización asíncrona.
 */

import { RecurringRuleRepository } from '@domain/repositories/RecurringRuleRepository';
import { RecurringRule, CreateRecurringRuleInput } from '@domain/entities/RecurringRule';
import { LocalDatabase } from '../local/LocalDatabase';
import { generateUUID } from '../../infrastructure/utils/uuid';

export class SqliteRecurringRuleRepository implements RecurringRuleRepository {
  private getDb() {
    return LocalDatabase.getDb();
  }

  async getById(id: string): Promise<RecurringRule | null> {
    const db = this.getDb();
    const row = await db.getFirstAsync<any>('SELECT * FROM recurring_rules WHERE id = ?;', [id]);
    if (!row) return null;
    return this.toDomain(row);
  }

  async getAllActive(): Promise<RecurringRule[]> {
    const db = this.getDb();
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM recurring_rules WHERE is_active = 1 ORDER BY created_at DESC;'
    );
    return rows.map(this.toDomain);
  }

  async getAll(): Promise<RecurringRule[]> {
    const db = this.getDb();
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM recurring_rules ORDER BY created_at DESC;'
    );
    return rows.map(this.toDomain);
  }

  async create(input: CreateRecurringRuleInput): Promise<RecurringRule> {
    const db = this.getDb();
    const id = (input as any).id || generateUUID();

    let familyGroupId = (input as any).familyGroupId || 'offline-family';
    try {
      const { useAuthStore } = require('../../infrastructure/auth/authStore');
      const profile = useAuthStore.getState().userProfile;
      if (profile?.familyGroupId) {
        familyGroupId = profile.familyGroupId;
      }
    } catch {
      // Fallback
    }

    const createdAt = new Date().toISOString();
    const isActive = 1;
    const dayOfMonth = input.dayOfMonth !== undefined && input.dayOfMonth !== null ? input.dayOfMonth : null;
    const endDate = input.endDate || null;
    const description = input.description || null;
    const categoryId = input.categoryId || null;

    await db.runAsync(
      `INSERT INTO recurring_rules (
        id, family_group_id, account_id, category_id, type, amount,
        description, frequency, day_of_month, start_date, end_date, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        familyGroupId,
        input.accountId,
        categoryId,
        input.type,
        input.amount,
        description,
        input.frequency,
        dayOfMonth,
        input.startDate,
        endDate,
        isActive,
        createdAt,
      ]
    );

    // Encolar acción de sincronización para cuando haya internet
    const actionId = generateUUID();
    const payload = JSON.stringify({
      id,
      familyGroupId,
      accountId: input.accountId,
      categoryId,
      type: input.type,
      amount: input.amount,
      description,
      frequency: input.frequency,
      dayOfMonth,
      startDate: input.startDate,
      endDate,
      isActive: true,
      createdAt,
    });

    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, 'INSERT', 'recurring_rules', ?, ?, ?);`,
      [actionId, id, payload, createdAt]
    );

    return {
      id,
      familyGroupId,
      accountId: input.accountId,
      categoryId,
      type: input.type,
      amount: input.amount,
      description,
      frequency: input.frequency,
      dayOfMonth,
      startDate: input.startDate,
      endDate,
      isActive: true,
      createdAt,
    };
  }

  async update(id: string, data: Partial<CreateRecurringRuleInput>): Promise<RecurringRule> {
    const db = this.getDb();
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Regla recurrente no encontrada: ${id}`);
    }

    const accountId = data.accountId !== undefined ? data.accountId : existing.accountId;
    const categoryId = data.categoryId !== undefined ? data.categoryId : existing.categoryId;
    const type = data.type !== undefined ? data.type : existing.type;
    const amount = data.amount !== undefined ? data.amount : existing.amount;
    const description = data.description !== undefined ? data.description : existing.description;
    const frequency = data.frequency !== undefined ? data.frequency : existing.frequency;
    const dayOfMonth = data.dayOfMonth !== undefined ? data.dayOfMonth : existing.dayOfMonth;
    const startDate = data.startDate !== undefined ? data.startDate : existing.startDate;
    const endDate = data.endDate !== undefined ? data.endDate : existing.endDate;

    await db.runAsync(
      `UPDATE recurring_rules SET
        account_id = ?, category_id = ?, type = ?, amount = ?, description = ?,
        frequency = ?, day_of_month = ?, start_date = ?, end_date = ?
       WHERE id = ?;`,
      [
        accountId,
        categoryId,
        type,
        amount,
        description,
        frequency,
        dayOfMonth,
        startDate,
        endDate,
        id,
      ]
    );

    // Encolar acción de actualización
    const actionId = generateUUID();
    const payload = JSON.stringify({
      id,
      accountId,
      categoryId,
      type,
      amount,
      description,
      frequency,
      dayOfMonth,
      startDate,
      endDate,
    });

    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, 'UPDATE', 'recurring_rules', ?, ?, ?);`,
      [actionId, id, payload, new Date().toISOString()]
    );

    return {
      ...existing,
      accountId,
      categoryId,
      type,
      amount,
      description,
      frequency,
      dayOfMonth,
      startDate,
      endDate,
    };
  }

  async delete(id: string): Promise<void> {
    const db = this.getDb();
    // Eliminación lógica (desactivar)
    await db.runAsync('UPDATE recurring_rules SET is_active = 0 WHERE id = ?;', [id]);

    const actionId = generateUUID();
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, 'DELETE', 'recurring_rules', ?, '{}', ?);`,
      [actionId, id, new Date().toISOString()]
    );
  }

  async bulkSave(rules: RecurringRule[]): Promise<void> {
    if (!rules || rules.length === 0) return;
    const db = this.getDb();

    const runInserts = async () => {
      for (const r of rules) {
        await db.runAsync(
          `INSERT OR REPLACE INTO recurring_rules (
            id, family_group_id, account_id, category_id, type, amount,
            description, frequency, day_of_month, start_date, end_date, is_active, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            r.id,
            r.familyGroupId,
            r.accountId,
            r.categoryId || null,
            r.type,
            r.amount,
            r.description || null,
            r.frequency,
            r.dayOfMonth !== null && r.dayOfMonth !== undefined ? r.dayOfMonth : null,
            r.startDate,
            r.endDate || null,
            r.isActive ? 1 : 0,
            r.createdAt,
          ]
        );
      }
    };

    if (typeof (db as any).withTransactionAsync === 'function') {
      await (db as any).withTransactionAsync(runInserts);
    } else {
      await runInserts();
    }
  }

  async getUnsynced(): Promise<RecurringRule[]> {
    const db = this.getDb();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM recurring_rules WHERE id IN (SELECT record_id FROM sync_actions_queue WHERE table_name = 'recurring_rules' AND action_type = 'INSERT');`
    );
    return rows.map(this.toDomain);
  }

  public toDomain(row: any): RecurringRule {
    return {
      id: row.id,
      familyGroupId: row.family_group_id,
      accountId: row.account_id,
      categoryId: row.category_id || null,
      type: row.type,
      amount: Number(row.amount),
      description: row.description || null,
      frequency: row.frequency,
      dayOfMonth: row.day_of_month !== null && row.day_of_month !== undefined ? Number(row.day_of_month) : null,
      startDate: row.start_date,
      endDate: row.end_date || null,
      isActive: row.is_active === 1 || row.is_active === true || row.is_active === '1',
      createdAt: row.created_at,
    };
  }
}
