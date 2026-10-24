import { CategoryRepository } from '@domain/repositories/CategoryRepository';
import { Category, CreateCategoryInput } from '@domain/entities/Category';
import { SupabaseCategoryRepository } from './SupabaseCategoryRepository';
import { SqliteCategoryRepository } from './SqliteCategoryRepository';
import { LocalDatabase } from '../local/LocalDatabase';
import { generateUUID } from '../../infrastructure/utils/uuid';
import { SyncService } from '../../infrastructure/services/SyncService';

import { Platform } from 'react-native';

export class HybridCategoryRepository implements CategoryRepository {
  private remoteRepo = new SupabaseCategoryRepository();
  private localRepo = Platform.OS === 'web' ? null : new SqliteCategoryRepository();

  async getById(id: string): Promise<Category | null> {
    if (Platform.OS === 'web') return this.remoteRepo.getById(id);
    return this.localRepo!.getById(id);
  }

  async getAll(includeSystem = true, _preferCache = true): Promise<Category[]> {
    if (Platform.OS === 'web') return this.remoteRepo.getAll(includeSystem);

    const local = await this.localRepo!.getAll(includeSystem);
    if (local.length === 0) {
      try {
        const remote = await this.remoteRepo.getAll(includeSystem);
        if (remote && remote.length > 0) {
          await this.localRepo!.bulkSave(remote);
          return this.localRepo!.getAll(includeSystem);
        }
      } catch {
        // Fallback silencioso
      }
    }
    return local;
  }

  async getByParentId(parentId: string | null): Promise<Category[]> {
    if (Platform.OS === 'web') return this.remoteRepo.getByParentId(parentId);
    return this.localRepo!.getByParentId(parentId);
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    const tempId = input.id || generateUUID();

    if (Platform.OS === 'web') return this.remoteRepo.create({ ...input, id: tempId });

    let familyGroupId = 'offline-family';
    try {
      const { useAuthStore } = require('../../infrastructure/auth/authStore');
      const profile = useAuthStore.getState().userProfile;
      if (profile?.familyGroupId) familyGroupId = profile.familyGroupId;
    } catch {
      // Fallback
    }
    const createdAt = new Date().toISOString();

    const localInput = {
      ...input,
      id: tempId,
      familyGroupId,
      createdAt
    };

    // Guardado Optimista Local-First (< 5ms)
    const local = await this.localRepo!.create(localInput);

    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'INSERT', 'categories', tempId, JSON.stringify(localInput), createdAt]
    );

    // Replicación asíncrona transparente en segundo plano
    SyncService.syncPendingActions().catch(() => {});

    return local;
  }

  async update(id: string, data: Partial<CreateCategoryInput>): Promise<Category> {
    if (Platform.OS === 'web') return this.remoteRepo.update(id, data);

    // Actualización Optimista Local-First (< 5ms)
    const local = await this.localRepo!.update(id, data);

    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'UPDATE', 'categories', id, JSON.stringify(data), new Date().toISOString()]
    );

    // Replicación asíncrona transparente en segundo plano
    SyncService.syncPendingActions().catch(() => {});

    return local;
  }

  async delete(id: string): Promise<void> {
    if (Platform.OS === 'web') return this.remoteRepo.delete(id);

    // Borrado Optimista Local-First (< 5ms)
    await this.localRepo!.delete(id);

    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'DELETE', 'categories', id, '{}', new Date().toISOString()]
    );

    // Replicación asíncrona transparente en segundo plano
    SyncService.syncPendingActions().catch(() => {});
  }

  async searchByName(query: string): Promise<Category[]> {
    if (Platform.OS === 'web') return this.remoteRepo.searchByName(query);
    return this.localRepo!.searchByName(query);
  }
}
