import { AccountRepository } from '@domain/repositories/AccountRepository';
import { Account, CreateAccountInput } from '@domain/entities/Account';
import { SupabaseAccountRepository } from './SupabaseAccountRepository';
import { SqliteAccountRepository } from './SqliteAccountRepository';
import { isOnlineFast, withTimeout } from '../../infrastructure/utils/network';
import { LocalDatabase } from '../local/LocalDatabase';
import { generateUUID } from '../../infrastructure/utils/uuid';

import { Platform } from 'react-native';

export class HybridAccountRepository implements AccountRepository {
  private remoteRepo = new SupabaseAccountRepository();
  private localRepo = Platform.OS === 'web' ? null : new SqliteAccountRepository();

  private async isOnline(): Promise<boolean> {
    return isOnlineFast();
  }

  async getById(id: string): Promise<Account | null> {
    if (Platform.OS === 'web') return this.remoteRepo.getById(id);
    
    if (await this.isOnline()) {
      try {
        const remote = await withTimeout(this.remoteRepo.getById(id), 2500);
        if (remote) {
          await this.localRepo!.bulkSave([remote]);
          return remote;
        }
      } catch (err) {
        // Fallback silently
      }
    }
    return this.localRepo!.getById(id);
  }

  async getAll(preferCache = false): Promise<Account[]> {
    if (Platform.OS === 'web') return this.remoteRepo.getAll();

    if (preferCache && this.localRepo) {
      const local = await this.localRepo.getAll();
      if (local.length > 0) {
        return local;
      }
    }

    if (await this.isOnline()) {
      try {
        const remote = await withTimeout(this.remoteRepo.getAll(), 2500);
        if (remote) {
          await (this.localRepo as any).syncWithRemote(remote);

          // Mezclar con cuentas locales no sincronizadas
          const unsynced = await this.localRepo!.getUnsynced();
          const combinedMap = new Map<string, Account>();
          remote.forEach(acc => combinedMap.set(acc.id, acc));
          unsynced.forEach(acc => combinedMap.set(acc.id, acc));

          return Array.from(combinedMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        }
      } catch (err) {
        // Fallback silencioso
      }
    }
    return this.localRepo!.getAll();
  }

  async create(input: CreateAccountInput): Promise<Account> {
    const tempId = input.id || generateUUID();
    const familyGroupId = 'offline-family';
    const ownerUserId = 'offline-user';
    const createdAt = new Date().toISOString();

    const localInput = {
      ...input,
      id: tempId,
      familyGroupId,
      ownerUserId,
      createdAt
    };

    if (Platform.OS === 'web') return this.remoteRepo.create({ ...input, id: tempId });

    if (await this.isOnline()) {
      try {
        // 1. Intentar crear en la nube con timeout
        const remote = await withTimeout(this.remoteRepo.create({ ...input, id: tempId }), 2500);
        // 2. Guardar en SQLite local marcado como sincronizado
        await this.localRepo!.bulkSave([remote]);
        return remote;
      } catch (err) {
        // Fallback a encolar localmente
      }
    }

    // 3. Crear localmente y marcar como pendiente de sincronización
    const local = await this.localRepo!.create(localInput);
    
    // Encolar acción de sincronización
    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'INSERT', 'accounts', tempId, JSON.stringify(localInput), createdAt]
    );

    return local;
  }

  async update(id: string, data: Partial<CreateAccountInput>): Promise<Account> {
    if (Platform.OS === 'web') return this.remoteRepo.update(id, data);

    if (await this.isOnline()) {
      try {
        const remote = await withTimeout(this.remoteRepo.update(id, data), 2500);
        await this.localRepo!.bulkSave([remote]);
        return remote;
      } catch (err) {
        // Fallback a encolar localmente
      }
    }

    const local = await this.localRepo!.update(id, data);
    
    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'UPDATE', 'accounts', id, JSON.stringify(data), new Date().toISOString()]
    );

    return local;
  }

  async delete(id: string): Promise<void> {
    if (Platform.OS === 'web') return this.remoteRepo.delete(id);

    if (await this.isOnline()) {
      try {
        await withTimeout(this.remoteRepo.delete(id), 2500);
        await this.localRepo!.delete(id);
        return;
      } catch (err) {
        // Fallback a encolar localmente
      }
    }

    await this.localRepo!.delete(id);

    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'DELETE', 'accounts', id, '{}', new Date().toISOString()]
    );
  }
}
