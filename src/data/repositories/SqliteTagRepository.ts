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
    const rows = await db.getAllAsync<any>('SELECT * FROM tags ORDER BY name ASC;');
    return rows.map(row => this.toDomain(row));
  }

  async create(input: CreateTagInput): Promise<Tag> {
    const db = this.getDb();
    const id = (input as any).id || generateUUID();
    const familyGroupId = (input as any).familyGroupId || 'offline-family';
    const createdAt = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO tags (id, family_group_id, name, color, created_at)
       VALUES (?, ?, ?, ?, ?);`,
      [
        id,
        familyGroupId,
        input.name,
        input.color || '#808080',
        createdAt,
      ]
    );

    return {
      id,
      familyGroupId,
      name: input.name,
      color: input.color || '#808080',
      createdAt,
    };
  }

  async delete(id: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync('DELETE FROM tags WHERE id = ?;', [id]);
    await db.runAsync('DELETE FROM transaction_tags WHERE tag_id = ?;', [id]);
  }

  async bulkSave(tags: Tag[]): Promise<void> {
    if (tags.length === 0) return;
    const db = this.getDb();
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
