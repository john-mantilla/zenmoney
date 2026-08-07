import { CategoryRepository } from '@domain/repositories/CategoryRepository';
import { Category, CreateCategoryInput } from '@domain/entities/Category';
import { SupabaseCategoryRepository } from './SupabaseCategoryRepository';
import { SqliteCategoryRepository } from './SqliteCategoryRepository';
import NetInfo from '@react-native-community/netinfo';
import { LocalDatabase } from '../local/LocalDatabase';
import { generateUUID } from '../../infrastructure/utils/uuid';

import { Platform } from 'react-native';

export class HybridCategoryRepository implements CategoryRepository {
  private remoteRepo = new SupabaseCategoryRepository();
  private localRepo = Platform.OS === 'web' ? null : new SqliteCategoryRepository();

  private async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return !!state.isConnected;
  }

  async getById(id: string): Promise<Category | null> {
    if (Platform.OS === 'web') return this.remoteRepo.getById(id);

    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.getById(id);
        if (remote) {
          await this.localRepo!.bulkSave([remote]);
          return remote;
        }
      } catch (err) {
        // Fallback
      }
    }
    return this.localRepo!.getById(id);
  }

  async getAll(includeSystem = true, preferCache = false): Promise<Category[]> {
    if (Platform.OS === 'web') return this.remoteRepo.getAll(includeSystem);

    if (preferCache && this.localRepo) {
      const local = await this.localRepo.getAll(includeSystem);
      if (local.length > 0) {
        return local;
      }
    }
      try {
        const remote = await this.remoteRepo.getAll(includeSystem);
        await this.localRepo!.bulkSave(remote);

        // Mezclar con categorías locales no sincronizadas
        const unsynced = await this.localRepo!.getUnsynced();
        let filteredUnsynced = unsynced;
        if (!includeSystem) {
          filteredUnsynced = filteredUnsynced.filter(c => !c.isSystem);
        }

        const combinedMap = new Map<string, Category>();
        remote.forEach(cat => combinedMap.set(cat.id, cat));
        filteredUnsynced.forEach(cat => combinedMap.set(cat.id, cat));

        return Array.from(combinedMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      } catch (err) {
        // Fallback
      }
    }
    return this.localRepo!.getAll(includeSystem);
  }

  async getByParentId(parentId: string | null): Promise<Category[]> {
    if (Platform.OS === 'web') return this.remoteRepo.getByParentId(parentId);

    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.getByParentId(parentId);
        await this.localRepo!.bulkSave(remote);

        // Mezclar con categorías locales no sincronizadas que tengan el mismo parentId
        const unsynced = await this.localRepo!.getUnsynced();
        const filteredUnsynced = unsynced.filter(c => c.parentCategoryId === parentId);

        const combinedMap = new Map<string, Category>();
        remote.forEach(cat => combinedMap.set(cat.id, cat));
        filteredUnsynced.forEach(cat => combinedMap.set(cat.id, cat));

        return Array.from(combinedMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      } catch (err) {
        // Fallback
      }
    }
    return this.localRepo!.getByParentId(parentId);
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    const tempId = input.id || generateUUID();
    const familyGroupId = 'offline-family';
    const createdAt = new Date().toISOString();

    const localInput = {
      ...input,
      id: tempId,
      familyGroupId,
      createdAt
    };

    if (Platform.OS === 'web') return this.remoteRepo.create({ ...input, id: tempId });

    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.create({ ...input, id: tempId });
        await this.localRepo!.bulkSave([remote]);
        return remote;
      } catch (err) {
        // Fallback
      }
    }

    const local = await this.localRepo!.create(localInput);

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
    if (Platform.OS === 'web') return this.remoteRepo.update(id, data);

    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.update(id, data);
        await this.localRepo!.bulkSave([remote]);
        return remote;
      } catch (err) {
        // Fallback
      }
    }

    const local = await this.localRepo!.update(id, data);

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
    if (Platform.OS === 'web') return this.remoteRepo.delete(id);

    if (await this.isOnline()) {
      try {
        await this.remoteRepo.delete(id);
        await this.localRepo!.delete(id);
        return;
      } catch (err) {
        // Fallback
      }
    }

    await this.localRepo!.delete(id);

    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'DELETE', 'categories', id, '{}', new Date().toISOString()]
    );
  }

  async searchByName(query: string): Promise<Category[]> {
    if (Platform.OS === 'web') return this.remoteRepo.searchByName(query);

    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.searchByName(query);
        await this.localRepo!.bulkSave(remote);
        return remote;
      } catch (err) {
        // Fallback
      }
    }
    return this.localRepo!.searchByName(query);
  }
}
