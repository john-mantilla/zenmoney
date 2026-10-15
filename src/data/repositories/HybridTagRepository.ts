import { TagRepository } from '@domain/repositories/TagRepository';
import { Tag, CreateTagInput } from '@domain/entities/Tag';
import { SupabaseTagRepository } from './SupabaseTagRepository';
import { SqliteTagRepository } from './SqliteTagRepository';
import { isOnlineFast, withTimeout } from '../../infrastructure/utils/network';
import { LocalDatabase } from '../local/LocalDatabase';
import { generateUUID } from '../../infrastructure/utils/uuid';
import { SyncService } from '../../infrastructure/services/SyncService';
import { Platform } from 'react-native';

export class HybridTagRepository implements TagRepository {
  private remoteRepo = new SupabaseTagRepository();
  private localRepo = Platform.OS === 'web' ? null : new SqliteTagRepository();

  async getById(id: string): Promise<Tag | null> {
    if (Platform.OS === 'web') return this.remoteRepo.getById(id);

    if (await isOnlineFast()) {
      try {
        const remote = await withTimeout(this.remoteRepo.getById(id), 2500);
        if (remote) {
          await this.localRepo!.bulkSave([remote]);
          return remote;
        }
      } catch (err) {
        // Fallback silencioso
      }
    }
    return this.localRepo!.getById(id);
  }

  async getAll(preferCache = false): Promise<Tag[]> {
    if (Platform.OS === 'web') return this.remoteRepo.getAll();

    if (preferCache && this.localRepo) {
      const local = await this.localRepo.getAll();
      if (local.length > 0) {
        return local;
      }
    }

    if (await isOnlineFast()) {
      try {
        const remote = await withTimeout(this.remoteRepo.getAll(), 2500);
        if (this.localRepo && remote) {
          await this.localRepo.syncWithRemote(remote);
        }
        return remote;
      } catch (err) {
        // Fallback silencioso
      }
    }

    return this.localRepo ? this.localRepo.getAll() : [];
  }

  async create(input: CreateTagInput): Promise<Tag> {
    const tempId = (input as any).id || generateUUID();
    let familyGroupId = 'offline-family';
    try {
      const { useAuthStore } = require('../../infrastructure/auth/authStore');
      const profile = useAuthStore.getState().userProfile;
      if (profile?.familyGroupId) familyGroupId = profile.familyGroupId;
    } catch {
      // Fallback
    }

    const localInput = { ...input, id: tempId, familyGroupId };

    if (Platform.OS === 'web') return this.remoteRepo.create(input);

    if (this.localRepo) {
      // Guardado Optimista Local-First (< 5ms)
      const local = await this.localRepo.create(localInput);
      try {
        const db = LocalDatabase.getDb();
        const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
        await db.runAsync(
          `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
           VALUES (?, ?, ?, ?, ?, ?);`,
          [actionId, 'INSERT', 'tags', tempId, JSON.stringify(localInput), new Date().toISOString()]
        );
        // Replicación asíncrona transparente en segundo plano
        SyncService.syncPendingActions().catch(() => {});
      } catch (queueErr) {
        console.warn('[HybridTagRepository] Error encolando acción de sincronización:', queueErr);
      }
      return local;
    }

    return this.remoteRepo.create(input);
  }

  async delete(id: string): Promise<void> {
    if (Platform.OS === 'web') return this.remoteRepo.delete(id);

    if (this.localRepo) {
      // Borrado Optimista Local-First (< 5ms)
      await this.localRepo.delete(id);
      try {
        const db = LocalDatabase.getDb();
        const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
        await db.runAsync(
          `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
           VALUES (?, ?, ?, ?, ?, ?);`,
          [actionId, 'DELETE', 'tags', id, JSON.stringify({ id }), new Date().toISOString()]
        );
        // Replicación asíncrona transparente en segundo plano
        SyncService.syncPendingActions().catch(() => {});
      } catch (queueErr) {
        console.warn('[HybridTagRepository] Error encolando acción de eliminación:', queueErr);
      }
    }
  }
}
