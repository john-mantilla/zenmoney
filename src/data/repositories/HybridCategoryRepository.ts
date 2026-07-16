import { CategoryRepository } from '@domain/repositories/CategoryRepository';
import { Category, CreateCategoryInput } from '@domain/entities/Category';
import { SupabaseCategoryRepository } from './SupabaseCategoryRepository';
import { SqliteCategoryRepository } from './SqliteCategoryRepository';
import NetInfo from '@react-native-community/netinfo';
import { LocalDatabase } from '../local/LocalDatabase';

export class HybridCategoryRepository implements CategoryRepository {
  private remoteRepo = new SupabaseCategoryRepository();
  private localRepo = new SqliteCategoryRepository();

  private async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return !!state.isConnected;
  }

  async getById(id: string): Promise<Category | null> {
    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.getById(id);
        if (remote) {
          await this.localRepo.bulkSave([remote]);
          return remote;
        }
      } catch (err) {
        // Fallback
      }
    }
    return this.localRepo.getById(id);
  }

  async getAll(includeSystem = true): Promise<Category[]> {
    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.getAll(includeSystem);
        await this.localRepo.bulkSave(remote);
        return remote;
      } catch (err) {
        // Fallback
      }
    }
    return this.localRepo.getAll(includeSystem);
  }

  async getByParentId(parentId: string | null): Promise<Category[]> {
    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.getByParentId(parentId);
        await this.localRepo.bulkSave(remote);
        return remote;
      } catch (err) {
        // Fallback
      }
    }
    return this.localRepo.getByParentId(parentId);
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    const tempId = (input as any).id || 'cat_' + Math.random().toString(36).substring(2, 15);
    const familyGroupId = 'offline-family';
    const createdAt = new Date().toISOString();

    const localInput = {
      ...input,
      id: tempId,
      familyGroupId,
      createdAt
    };

    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.create(input);
        await this.localRepo.bulkSave([remote]);
        return remote;
      } catch (err) {
        // Fallback
      }
    }

    const local = await this.localRepo.create(localInput);

    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'INSERT', 'categories', tempId, JSON.stringify(localInput), createdAt]
    );

    return local;
  }

  async update(id: string, data: Partial<CreateCategoryInput>): Promise<Category> {
    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.update(id, data);
        await this.localRepo.bulkSave([remote]);
        return remote;
      } catch (err) {
        // Fallback
      }
    }

    const local = await this.localRepo.update(id, data);

    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'UPDATE', 'categories', id, JSON.stringify(data), new Date().toISOString()]
    );

    return local;
  }

  async delete(id: string): Promise<void> {
    if (await this.isOnline()) {
      try {
        await this.remoteRepo.delete(id);
        await this.localRepo.delete(id);
        return;
      } catch (err) {
        // Fallback
      }
    }

    await this.localRepo.delete(id);

    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'DELETE', 'categories', id, '{}', new Date().toISOString()]
    );
  }

  async searchByName(query: string): Promise<Category[]> {
    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.searchByName(query);
        await this.localRepo.bulkSave(remote);
        return remote;
      } catch (err) {
        // Fallback
      }
    }
    return this.localRepo.searchByName(query);
  }
}
