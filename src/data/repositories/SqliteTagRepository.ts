import { TagRepository } from '@domain/repositories/TagRepository';
import { Tag, CreateTagInput } from '@domain/entities/Tag';
import { LocalDatabase } from '../local/LocalDatabase';
import { generateUUID } from '../../infrastructure/utils/uuid';

export class SqliteTagRepository implements TagRepository {
  private getDb() {
    return LocalDatabase.getDb();
  }

  async getById(id: string): Promise<Tag | null> {
    const db = this.getDb();
    const row = await db.getFirstAsync<any>('SELECT * FROM tags WHERE id = ?;', [id]);
    if (!row) return null;
    return this.toDomain(row);
  }

  async getAll(): Promise<Tag[]> {
    const db = this.getDb();
    await this.deduplicateTags().catch(() => {});
    const rows = await db.getAllAsync<any>('SELECT * FROM tags ORDER BY name ASC;');
    return rows.map(row => this.toDomain(row));
  }

  async create(input: CreateTagInput): Promise<Tag> {
    const db = this.getDb();
    const cleanName = (input.name || '').trim();
    const familyGroupId = (input as any).familyGroupId || 'offline-family';

    // 1. Prevención estricta de duplicados por nombre insensible a mayúsculas/minúsculas
    const existing = await db.getFirstAsync<any>(
      `SELECT * FROM tags 
       WHERE (family_group_id = ? OR family_group_id = 'offline-family') 
         AND LOWER(TRIM(name)) = LOWER(TRIM(?))
       LIMIT 1;`,
      [familyGroupId, cleanName]
    );

    if (existing) {
      return this.toDomain(existing);
    }

    const id = (input as any).id || generateUUID();
    const createdAt = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO tags (id, family_group_id, name, color, created_at)
       VALUES (?, ?, ?, ?, ?);`,
      [
        id,
        familyGroupId,
        cleanName,
        input.color || '#808080',
        createdAt,
      ]
    );

    return {
      id,
      familyGroupId,
      name: cleanName,
      color: input.color || '#808080',
      createdAt,
    };
  }

  async update(id: string, input: Partial<CreateTagInput>): Promise<Tag> {
    const db = this.getDb();
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Etiqueta no encontrada: ${id}`);
    }

    const newName = input.name !== undefined ? input.name.trim() : existing.name;
    const newColor = input.color !== undefined ? input.color : existing.color;

    await db.runAsync(
      `UPDATE tags SET name = ?, color = ? WHERE id = ?;`,
      [newName, newColor, id]
    );

    return {
      ...existing,
      name: newName,
      color: newColor,
    };
  }

  async delete(id: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync('DELETE FROM tags WHERE id = ?;', [id]);
    await db.runAsync('DELETE FROM transaction_tags WHERE tag_id = ?;', [id]);
  }

  /**
   * Consolida y elimina etiquetas duplicadas existentes en la base de datos local.
   * Reasigna automáticamente las transacciones asociadas al ID canónico (el más antiguo).
   */
  async deduplicateTags(): Promise<void> {
    const db = this.getDb();
    const rows = await db.getAllAsync<any>('SELECT * FROM tags ORDER BY created_at ASC;');
    if (!rows || rows.length <= 1) return;

    const tagsByName = new Map<string, any[]>();
    for (const r of rows) {
      const key = (r.name || '').trim().toLowerCase();
      if (!key) continue;
      const list = tagsByName.get(key) || [];
      list.push(r);
      tagsByName.set(key, list);
    }

    for (const [, group] of tagsByName.entries()) {
      if (group.length > 1) {
        const canonical = group[0];
        const duplicates = group.slice(1);

        for (const dup of duplicates) {
          // Reasignar referencias en transaction_tags al ID canónico
          await db.runAsync(
            `INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id)
             SELECT transaction_id, ? FROM transaction_tags WHERE tag_id = ?;`,
            [canonical.id, dup.id]
          );
          await db.runAsync('DELETE FROM transaction_tags WHERE tag_id = ?;', [dup.id]);

          // Eliminar el tag duplicado
          await db.runAsync('DELETE FROM tags WHERE id = ?;', [dup.id]);
        }
      }
    }
  }

  /**
   * Obtiene la cantidad de movimientos asociados a cada etiqueta.
   */
  async getTagUsageCounts(): Promise<Record<string, number>> {
    const db = this.getDb();
    const rows = await db.getAllAsync<{ tag_id: string; count: number }>(
      `SELECT tag_id, COUNT(*) as count FROM transaction_tags GROUP BY tag_id;`
    );
    const counts: Record<string, number> = {};
    if (Array.isArray(rows)) {
      for (const r of rows) {
        counts[r.tag_id] = Number(r.count || 0);
      }
    }
    return counts;
  }

  async bulkSave(tags: Tag[]): Promise<void> {
    if (!tags || tags.length === 0) return;
    const db = this.getDb();

    const runInserts = async () => {
      for (const tag of tags) {
        await db.runAsync(
          `INSERT OR REPLACE INTO tags (id, family_group_id, name, color, created_at)
           VALUES (?, ?, ?, ?, ?);`,
          [
            tag.id,
            tag.familyGroupId,
            tag.name,
            tag.color,
            tag.createdAt,
          ]
        );
      }
    };

    if (typeof (db as any).withTransactionAsync === 'function') {
      await (db as any).withTransactionAsync(runInserts);
    } else {
      await runInserts();
    }

    await this.deduplicateTags().catch(() => {});
  }

  async syncWithRemote(remoteTags: Tag[]): Promise<void> {
    const db = this.getDb();
    const remoteIds = remoteTags.map(t => `'${t.id}'`).join(',');
    if (remoteIds.length > 0) {
      await db.runAsync(`DELETE FROM tags WHERE id NOT IN (${remoteIds});`);
    } else {
      await db.runAsync('DELETE FROM tags;');
    }
    await this.bulkSave(remoteTags);
  }

  private toDomain(row: any): Tag {
    return {
      id: row.id,
      familyGroupId: row.family_group_id,
      name: row.name,
      color: row.color,
      createdAt: row.created_at,
    };
  }
}
