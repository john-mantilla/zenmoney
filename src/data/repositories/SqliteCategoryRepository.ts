import { CategoryRepository } from '@domain/repositories/CategoryRepository';
import { Category, CreateCategoryInput } from '@domain/entities/Category';
import { LocalDatabase } from '../local/LocalDatabase';

export class SqliteCategoryRepository implements CategoryRepository {
  private getDb() {
    return LocalDatabase.getDb();
  }

  async getById(id: string): Promise<Category | null> {
    const db = this.getDb();
    const row = await db.getFirstAsync<any>('SELECT * FROM categories WHERE id = ?;', [id]);
    if (!row) return null;
    return this.toDomain(row);
  }

  async getAll(includeSystem = true): Promise<Category[]> {
    const db = this.getDb();
    let query = 'SELECT * FROM categories';
    const params: any[] = [];

    if (!includeSystem) {
      query += ' WHERE is_system = 0';
    }

    query += ' ORDER BY name ASC;';

    const rows = await db.getAllAsync<any>(query, params);
    return rows.map(this.toDomain);
  }

  async getByParentId(parentId: string | null): Promise<Category[]> {
    const db = this.getDb();
    const rows = parentId === null
      ? await db.getAllAsync<any>('SELECT * FROM categories WHERE parent_category_id IS NULL ORDER BY name ASC;')
      : await db.getAllAsync<any>('SELECT * FROM categories WHERE parent_category_id = ? ORDER BY name ASC;', [parentId]);
    return rows.map(this.toDomain);
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    const db = this.getDb();
    const id = (input as any).id || Math.random().toString(36).substring(2, 15);
    const familyGroupId = (input as any).familyGroupId || 'offline-family';
    const createdAt = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO categories (id, family_group_id, name, icon, color, parent_category_id, is_system, is_private, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        familyGroupId,
        input.name,
        input.icon || 'tag',
        input.color || '#808080',
        input.parentCategoryId || null,
        0, // is_system = false
        input.isPrivate ? 1 : 0,
        createdAt
      ]
    );

    return {
      id,
      familyGroupId,
      name: input.name,
      icon: input.icon || 'tag',
      color: input.color || '#808080',
      parentCategoryId: input.parentCategoryId || null,
      isSystem: false,
      isPrivate: input.isPrivate || false,
      createdAt
    };
  }

  async update(id: string, data: Partial<CreateCategoryInput>): Promise<Category> {
    const db = this.getDb();
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Categoría no encontrada: ${id}`);
    }

    const name = data.name !== undefined ? data.name : existing.name;
    const icon = data.icon !== undefined ? data.icon : existing.icon;
    const color = data.color !== undefined ? data.color : existing.color;
    const parentCategoryId = data.parentCategoryId !== undefined ? data.parentCategoryId : existing.parentCategoryId;
    const isPrivate = data.isPrivate !== undefined ? data.isPrivate : existing.isPrivate;

    await db.runAsync(
      `UPDATE categories SET name = ?, icon = ?, color = ?, parent_category_id = ?, is_private = ? WHERE id = ?;`,
      [name, icon, color, parentCategoryId || null, isPrivate ? 1 : 0, id]
    );

    return {
      ...existing,
      name,
      icon,
      color,
      parentCategoryId: parentCategoryId || null,
      isPrivate
    };
  }

  async delete(id: string): Promise<void> {
    const db = this.getDb();
    // PostgreSQL pone a NULL en cascada. Localmente simulamos esto poniendo a NULL las subcategorías y transacciones
    await db.runAsync('UPDATE categories SET parent_category_id = NULL WHERE parent_category_id = ?;', [id]);
    await db.runAsync('UPDATE transactions SET category_id = NULL WHERE category_id = ?;', [id]);
    await db.runAsync('DELETE FROM categories WHERE id = ?;', [id]);
  }

  async searchByName(query: string): Promise<Category[]> {
    const db = this.getDb();
    const rows = await db.getAllAsync<any>('SELECT * FROM categories WHERE name LIKE ? ORDER BY name ASC;', [`%${query}%`]);
    return rows.map(this.toDomain);
  }

  async bulkSave(categories: Category[]): Promise<void> {
    const db = this.getDb();
    for (const cat of categories) {
      await db.runAsync(
        `INSERT OR REPLACE INTO categories (id, family_group_id, name, icon, color, parent_category_id, is_system, is_private, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          cat.id,
          cat.familyGroupId,
          cat.name,
          cat.icon,
          cat.color,
          cat.parentCategoryId,
          cat.isSystem ? 1 : 0,
          cat.isPrivate ? 1 : 0,
          cat.createdAt
        ]
      );
    }
  }

  private toDomain(row: any): Category {
    return {
      id: row.id,
      familyGroupId: row.family_group_id,
      name: row.name,
      icon: row.icon,
      color: row.color,
      parentCategoryId: row.parent_category_id,
      isSystem: row.is_system === 1,
      isPrivate: row.is_private === 1,
      createdAt: row.created_at
    };
  }
}
