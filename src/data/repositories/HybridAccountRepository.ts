import { AccountRepository } from '@domain/repositories/AccountRepository';
import { Account, CreateAccountInput } from '@domain/entities/Account';
import { SupabaseAccountRepository } from './SupabaseAccountRepository';
import { SqliteAccountRepository } from './SqliteAccountRepository';
import { SupabaseTransactionRepository } from './SupabaseTransactionRepository';
import { CalculateAccountBalance } from '../../domain/usecases/CalculateAccountBalance';
import { LocalDatabase } from '../local/LocalDatabase';
import { generateUUID } from '../../infrastructure/utils/uuid';
import { SyncService } from '../../infrastructure/services/SyncService';

import { Platform } from 'react-native';

export class HybridAccountRepository implements AccountRepository {
  private remoteRepo = new SupabaseAccountRepository();
  private localRepo = Platform.OS === 'web' ? null : new SqliteAccountRepository();

  async getById(id: string): Promise<Account | null> {
    if (Platform.OS === 'web') {
      const acc = await this.remoteRepo.getById(id);
      if (!acc) return null;
      try {
        const txRepo = new SupabaseTransactionRepository();
        const balanceUseCase = new CalculateAccountBalance(txRepo);
        const realBalance = await balanceUseCase.execute(acc, false);
        return {
          ...acc,
          currentBalance: isNaN(realBalance) ? Number(acc.initialBalance || 0) : realBalance,
        };
      } catch {
        return {
          ...acc,
          currentBalance: Number(acc.initialBalance || 0),
        };
      }
    }
    return this.localRepo!.getById(id);
  }

  async getAll(_preferCache = true): Promise<Account[]> {
    if (Platform.OS === 'web') {
      const remoteAccounts = await this.remoteRepo.getAll();
      const txRepo = new SupabaseTransactionRepository();
      const balanceUseCase = new CalculateAccountBalance(txRepo);
      return Promise.all(
        remoteAccounts.map(async (acc) => {
          try {
            const realBalance = await balanceUseCase.execute(acc, false);
            return {
              ...acc,
              currentBalance: isNaN(realBalance) ? Number(acc.initialBalance || 0) : realBalance,
            };
          } catch {
            return {
              ...acc,
              currentBalance: Number(acc.initialBalance || 0),
            };
          }
        })
      );
    }
    
    const local = await this.localRepo!.getAll();
    // Si la base local está vacía (primer inicio antes de sync), intentar un bootstrap silencioso
    if (local.length === 0) {
      try {
        const remote = await this.remoteRepo.getAll();
        if (remote && remote.length > 0) {
          await this.localRepo!.bulkSave(remote);
          return this.localRepo!.getAll();
        }
      } catch {
        // Fallback silencioso
      }
    }
    return local;
  }

  async create(input: CreateAccountInput): Promise<Account> {
    const tempId = input.id || generateUUID();

    if (Platform.OS === 'web') {
      return this.remoteRepo.create({ ...input, id: tempId });
    }

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
    if (Platform.OS === 'web') {
      return this.remoteRepo.update(id, data);
    }

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
    if (Platform.OS === 'web') {
      return this.remoteRepo.delete(id);
    }

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
    if (Platform.OS === 'web') {
      // En Web las cuentas no guardan current_balance en base de datos remota
      return;
    }
    return this.localRepo!.updateBalance(id, balance);
  }

  async recalculateBalance(id: string): Promise<number> {
    if (Platform.OS === 'web') {
      return 0;
    }
    return this.localRepo!.recalculateBalance(id);
  }
}
