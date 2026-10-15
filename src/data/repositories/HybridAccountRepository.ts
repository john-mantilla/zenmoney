import { AccountRepository } from '@domain/repositories/AccountRepository';
import { Account, CreateAccountInput } from '@domain/entities/Account';
import { SupabaseAccountRepository } from './SupabaseAccountRepository';
import { SqliteAccountRepository } from './SqliteAccountRepository';
import { isOnlineFast, withTimeout } from '../../infrastructure/utils/network';
import { LocalDatabase } from '../local/LocalDatabase';
import { generateUUID } from '../../infrastructure/utils/uuid';
import { SyncService } from '../../infrastructure/services/SyncService';

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
        const remote = await withTimeout(this.remoteRepo.getAll(), 3000);
        if (remote) {
          await (this.localRepo as any).syncWithRemote(remote);

          // Obtener las cuentas locales para preservar su currentBalance consolidado
          const localAccounts = await this.localRepo!.getAll();
          const localMap = new Map(localAccounts.map(a => [a.id, a]));

          // Mezclar con cuentas locales no sincronizadas y preservar currentBalance
          const unsynced = await this.localRepo!.getUnsynced();
          const combinedMap = new Map<string, Account>();
          remote.forEach(acc => {
            const localAcc = localMap.get(acc.id);
            combinedMap.set(acc.id, {
              ...acc,
              currentBalance: localAcc?.currentBalance !== undefined ? localAcc.currentBalance : acc.currentBalance,
            });
          });
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
    let familyGroupId = 'offline-family';
    let ownerUserId = 'offline-user';
    try {
      const { useAuthStore } = require('../../infrastructure/auth/authStore');
      const profile = useAuthStore.getState().userProfile;
      if (profile) {
        if (profile.familyGroupId) familyGroupId = profile.familyGroupId;
        if (profile.id) ownerUserId = profile.id;
      }
    } catch {
      // Fallback
    }
    const createdAt = new Date().toISOString();

    const localInput = {
      ...input,
      id: tempId,
      familyGroupId,
      ownerUserId,
      createdAt
    };

    if (Platform.OS === 'web') return this.remoteRepo.create({ ...input, id: tempId });

    // Guardado Optimista Local-First (< 5ms)
    const local = await this.localRepo!.create(localInput);
    
    // Encolar acción de sincronización
    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'INSERT', 'accounts', tempId, JSON.stringify(localInput), createdAt]
    );

    // Replicación asíncrona transparente en segundo plano
    SyncService.syncPendingActions().catch(() => {});

    return local;
  }

  async update(id: string, data: Partial<CreateAccountInput>): Promise<Account> {
    if (Platform.OS === 'web') return this.remoteRepo.update(id, data);

    // Actualización Optimista Local-First (< 5ms)
    const local = await this.localRepo!.update(id, data);
    
    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'UPDATE', 'accounts', id, JSON.stringify(data), new Date().toISOString()]
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
      [actionId, 'DELETE', 'accounts', id, '{}', new Date().toISOString()]
    );

    // Replicación asíncrona transparente en segundo plano
    SyncService.syncPendingActions().catch(() => {});
  }

  async updateBalance(id: string, balance: number): Promise<void> {
    if (this.localRepo) {
      await this.localRepo.updateBalance(id, balance);
    }
  }
}
