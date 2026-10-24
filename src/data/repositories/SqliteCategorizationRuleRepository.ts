import { CategorizationRuleRepository } from '@domain/repositories/CategorizationRuleRepository';
import { CategorizationRule, CreateCategorizationRuleInput } from '@domain/entities/CategorizationRule';
import { LocalDatabase } from '../local/LocalDatabase';
import { generateUUID } from '../../infrastructure/utils/uuid';

export class SqliteCategorizationRuleRepository implements CategorizationRuleRepository {
  private getDb() {
    return LocalDatabase.getDb();
  }

  async getAll(): Promise<CategorizationRule[]> {
    const db = this.getDb();
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM auto_categorization_rules ORDER BY priority DESC, created_at DESC;'
    );
    return rows.map(this.toDomain);
  }

  async create(input: CreateCategorizationRuleInput): Promise<CategorizationRule> {
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
    const priority = input.priority !== undefined && input.priority !== null ? input.priority : 10;
    const isAiGenerated = input.isAiGenerated ? 1 : 0;

    await db.runAsync(
      `INSERT INTO auto_categorization_rules (
        id, family_group_id, match_pattern, category_id, priority, is_ai_generated, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        familyGroupId,
        input.matchPattern,
        input.categoryId,
        priority,
        isAiGenerated,
        createdAt
      ]
    );

    // Encolar acción de sincronización
    const actionId = generateUUID();
    const payload = JSON.stringify({
      id,
      matchPattern: input.matchPattern,
      categoryId: input.categoryId,
      priority,
      isAiGenerated: Boolean(input.isAiGenerated)
    });

    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, 'INSERT', 'auto_categorization_rules', ?, ?, ?);`,
      [actionId, id, payload, createdAt]
    );

    return {
      id,
      familyGroupId,
      matchPattern: input.matchPattern,
      categoryId: input.categoryId,
      priority,
      isAiGenerated: Boolean(input.isAiGenerated),
      createdAt
    };
  }

  async update(id: string, data: Partial<CreateCategorizationRuleInput>): Promise<CategorizationRule> {
    const db = this.getDb();
    const existing = await db.getFirstAsync<any>('SELECT * FROM auto_categorization_rules WHERE id = ?;', [id]);
    if (!existing) {
      throw new Error(`Regla de categorización no encontrada: ${id}`);
    }

    const matchPattern = data.matchPattern !== undefined ? data.matchPattern : existing.match_pattern;
    const categoryId = data.categoryId !== undefined ? data.categoryId : existing.category_id;
    const priority = data.priority !== undefined ? data.priority : existing.priority;
    const isAiGenerated = data.isAiGenerated !== undefined ? (data.isAiGenerated ? 1 : 0) : existing.is_ai_generated;

    await db.runAsync(
      `UPDATE auto_categorization_rules SET
        match_pattern = ?, category_id = ?, priority = ?, is_ai_generated = ?
       WHERE id = ?;`,
      [matchPattern, categoryId, priority, isAiGenerated, id]
    );

    const actionId = generateUUID();
    const payload = JSON.stringify({
      matchPattern,
      categoryId,
      priority,
      isAiGenerated: Boolean(isAiGenerated)
    });

    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, 'UPDATE', 'auto_categorization_rules', ?, ?, ?);`,
      [actionId, id, payload, new Date().toISOString()]
    );

    return {
      id,
      familyGroupId: existing.family_group_id,
      matchPattern,
      categoryId,
      priority,
      isAiGenerated: Boolean(isAiGenerated),
      createdAt: existing.created_at
    };
  }

  async bulkSave(rules: CategorizationRule[]): Promise<void> {
    if (!rules || rules.length === 0) return;
    const db = this.getDb();

    const runInserts = async () => {
      for (const r of rules) {
        await db.runAsync(
          `INSERT OR REPLACE INTO auto_categorization_rules (
            id, family_group_id, match_pattern, category_id, priority, is_ai_generated, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [
            r.id,
            r.familyGroupId,
            r.matchPattern,
            r.categoryId,
            r.priority,
            r.isAiGenerated ? 1 : 0,
            r.createdAt
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

  public toDomain(row: any): CategorizationRule {
    return {
      id: row.id,
      familyGroupId: row.family_group_id,
      matchPattern: row.match_pattern,
      categoryId: row.category_id,
      priority: Number(row.priority),
      isAiGenerated: row.is_ai_generated === 1 || row.is_ai_generated === true,
      createdAt: row.created_at
    };
  }
}
