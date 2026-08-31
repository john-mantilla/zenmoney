import { TagRepository } from '@domain/repositories/TagRepository';
import { Tag, CreateTagInput } from '@domain/entities/Tag';
import { SupabaseTagRepository } from './SupabaseTagRepository';
import { SqliteTagRepository } from './SqliteTagRepository';
import { isOnlineFast, withTimeout } from '../../infrastructure/utils/network';
import { LocalDatabase } from '../local/LocalDatabase';
import { generateUUID } from '../../infrastructure/utils/uuid';
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
    const localInput = { ...input, id: tempId };

    if (Platform.OS === 'web') return this.remoteRepo.create(input);

    if (await isOnlineFast()) {
      try {
        const remote = await withTimeout(this.remoteRepo.create(input), 2500);
        if (this.localRepo) {
          await this.localRepo.bulkSave([remote]);
        }
        return remote;
      } catch (err) {
        // Fallback offline
      }
    }

    if (this.localRepo) {
      const local = await this.localRepo.create(localInput);
      try {
        const db = LocalDatabase.getDb();
        const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
        await db.runAsync(
          `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
           VALUES (?, ?, ?, ?, ?, ?);`,
          [actionId, 'INSERT', 'tags', tempId, JSON.stringify(localInput), new Date().toISOString()]
        );
      } catch (queueErr) {
        console.warn('[HybridTagRepository] Error encolando acción de sincronización:', queueErr);
      }
      return local;
    }

    return this.remoteRepo.create(input);
  }

  async delete(id: string): Promise<void> {
    if (Platform.OS === 'web') return this.remoteRepo.delete(id);

    if (await isOnlineFast()) {
      try {
        await withTimeout(this.remoteRepo.delete(id), 2500);
      } catch (err) {
        // Fallback silencioso
      }
    }

    if (this.localRepo) {
      await this.localRepo.delete(id);
      try {
        const db = LocalDatabase.getDb();
        const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
        await db.runAsync(
          `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
           VALUES (?, ?, ?, ?, ?, ?);`,
          [actionId, 'DELETE', 'tags', id, JSON.stringify({ id }), new Date().toISOString()]
        );
      } catch (queueErr) {
        console.warn('[HybridTagRepository] Error encolando acción de eliminación:', queueErr);
      }
    }
  }
}
