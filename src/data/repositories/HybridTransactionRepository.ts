import { TransactionRepository, TransactionFilters } from '@domain/repositories/TransactionRepository';
import { Transaction, CreateTransactionInput } from '@domain/entities/Transaction';
import { SupabaseTransactionRepository } from './SupabaseTransactionRepository';
import { SqliteTransactionRepository } from './SqliteTransactionRepository';
import { isOnlineFast, withTimeout } from '../../infrastructure/utils/network';
import { LocalDatabase } from '../local/LocalDatabase';
import { generateUUID } from '../../infrastructure/utils/uuid';
import { SyncService } from '../../infrastructure/services/SyncService';

import { Platform } from 'react-native';

export class HybridTransactionRepository implements TransactionRepository {
  private remoteRepo = new SupabaseTransactionRepository();
  private localRepo = Platform.OS === 'web' ? null : new SqliteTransactionRepository();

  private async isOnline(): Promise<boolean> {
    return isOnlineFast();
  }

  async getById(id: string): Promise<Transaction | null> {
    if (Platform.OS === 'web') return this.remoteRepo.getById(id);

    if (await this.isOnline()) {
      try {
        const remote = await withTimeout(this.remoteRepo.getById(id), 2500);
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

  async getAll(filters?: TransactionFilters, preferCache = false): Promise<Transaction[]> {
    if (Platform.OS === 'web') return this.remoteRepo.getAll(filters);

    if (preferCache && this.localRepo) {
      return this.localRepo.getAll(filters);
    }

    if (await this.isOnline()) {
      try {
        const remote = await withTimeout(this.remoteRepo.getAll(filters), 2500);
        if (this.localRepo && remote) {
          await (this.localRepo as any).syncWithRemote(remote, filters);
        }

        if (filters?.inputMethod === 'email' && filters?.status === 'pending' && this.localRepo) {
          await this.localRepo.syncPendingEmailInvoices(remote);
        }

        // Obtener acciones pendientes de borrado en cola para no resucitar registros
        const db = LocalDatabase.getDb();
        const pendingDeletes = await db.getAllAsync<any>(
          "SELECT record_id FROM sync_actions_queue WHERE table_name = 'transactions' AND action_type = 'DELETE';"
        );
        const deletedIds = new Set(pendingDeletes.map(d => d.record_id));

        // Mezclar con transacciones locales no sincronizadas (synced = 0)
        const unsynced = await this.localRepo!.getUnsynced();
        const unsyncedMap = new Map<string, Transaction>(unsynced.map(t => [t.id, t]));

        const combinedMap = new Map<string, Transaction>();
        remote.forEach(tx => {
          if (deletedIds.has(tx.id)) return;
          if (unsyncedMap.has(tx.id)) {
            const localVersion = unsyncedMap.get(tx.id)!;
            if (this.matchesFilters(localVersion, filters)) {
              combinedMap.set(tx.id, localVersion);
            }
          } else {
            combinedMap.set(tx.id, tx);
          }
        });

        // Agregar transacciones creadas localmente no presentes en remoto
        unsynced.forEach(tx => {
          if (!deletedIds.has(tx.id) && !combinedMap.has(tx.id) && this.matchesFilters(tx, filters)) {
            combinedMap.set(tx.id, tx);
          }
        });

        return Array.from(combinedMap.values()).sort((a, b) => {
          const dateDiff = b.transactionDate.localeCompare(a.transactionDate);
          if (dateDiff !== 0) return dateDiff;
          return b.createdAt.localeCompare(a.createdAt);
        });
      } catch (err) {
        // Fallback
      }
    }
    return this.localRepo!.getAll(filters);
  }

  private matchesFilters(tx: Transaction, filters?: TransactionFilters): boolean {
    if (!filters) return true;
    if (filters.accountId && tx.accountId !== filters.accountId && tx.transferToAccountId !== filters.accountId) {
      return false;
    }
    if (filters.categoryId && tx.categoryId !== filters.categoryId) {
      return false;
    }
    if (filters.type && tx.type !== filters.type) {
      return false;
    }
    if (filters.status && tx.status !== filters.status) {
      return false;
    }
    if (filters.startDate || filters.endDate) {
      if (tx.periodSplit) {
        const txStartMonth = tx.periodSplit.startMonth;
        const txEndMonth = tx.periodSplit.endMonth;
        const fStartMonth = filters.startDate ? filters.startDate.substring(0, 7) : txStartMonth;
        const fEndMonth = filters.endDate ? filters.endDate.substring(0, 7) : txEndMonth;
        if (txStartMonth > fEndMonth || txEndMonth < fStartMonth) {
          return false;
        }
      } else {
        if (filters.startDate && tx.transactionDate < filters.startDate) {
          return false;
        }
        if (filters.endDate && tx.transactionDate > filters.endDate) {
          return false;
        }
      }
    }
    if (filters.inputMethod && tx.inputMethod !== filters.inputMethod) {
      return false;
    }
    if (filters.recurringRuleId && tx.recurringRuleId !== filters.recurringRuleId) {
      return false;
    }
    return true;
  }

  async create(input: CreateTransactionInput): Promise<Transaction> {
    const tempId = input.id || generateUUID();
    let familyGroupId = 'offline-family';
    let createdByUserId = 'offline-user';
    try {
      const { useAuthStore } = require('../../infrastructure/auth/authStore');
      const profile = useAuthStore.getState().userProfile;
      if (profile) {
        if (profile.familyGroupId) familyGroupId = profile.familyGroupId;
        if (profile.id) createdByUserId = profile.id;
      }
    } catch {
      // Fallback
    }
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;

    const localInput = {
      ...input,
      id: tempId,
      familyGroupId,
      createdByUserId,
      createdAt,
      updatedAt,
      synced: false
    };

    if (Platform.OS === 'web') return this.remoteRepo.create({ ...input, id: tempId });

    // Guardado Optimista Local-First: Persistir inmediatamente en SQLite (< 5ms)
    const local = await this.localRepo!.create(localInput);

    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'INSERT', 'transactions', tempId, JSON.stringify(localInput), createdAt]
    );

    // Replicación asíncrona transparente en segundo plano (Zero Blocking UI)
    SyncService.syncPendingActions().catch(() => {});

    return local;
  }

  async update(id: string, data: Partial<CreateTransactionInput>): Promise<Transaction> {
    if (Platform.OS === 'web') return this.remoteRepo.update(id, data);

    let local: Transaction;
    try {
      // 1. Si no existe en SQLite, intentar traer de la nube para tener la copia local completa
      const existing = await this.localRepo!.getById(id);
      if (!existing && (await this.isOnline())) {
        try {
          const remote = await withTimeout(this.remoteRepo.getById(id), 2500);
          if (remote) {
            await this.localRepo!.bulkSave([remote]);
          }
        } catch {
          // Ignorar fallo de red temporal
        }
      }

      local = await this.localRepo!.update(id, { ...data, synced: false } as any);
    } catch (localErr: any) {
      // 2. Si falló la actualización local pero tenemos conexión, actualizar directamente en Supabase y persistir local
      if (await this.isOnline()) {
        try {
          const remoteUpdated = await this.remoteRepo.update(id, data);
          if (remoteUpdated) {
            await this.localRepo!.bulkSave([remoteUpdated]);
            return remoteUpdated;
          }
        } catch (remoteErr) {
          throw remoteErr;
        }
      }
      throw localErr;
    }

    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'UPDATE', 'transactions', id, JSON.stringify(data), new Date().toISOString()]
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
      [actionId, 'DELETE', 'transactions', id, '{}', new Date().toISOString()]
    );

    // Replicación asíncrona transparente en segundo plano
    SyncService.syncPendingActions().catch(() => {});
  }

  async getByDateRange(startDate: string, endDate: string): Promise<Transaction[]> {
    return this.getAll({ startDate, endDate });
  }

  async getTotalByType(type: Transaction['type'], startDate: string, endDate: string): Promise<number> {
    if (Platform.OS === 'web') return this.remoteRepo.getTotalByType(type, startDate, endDate);

    if (await this.isOnline()) {
      try {
        const total = await this.remoteRepo.getTotalByType(type, startDate, endDate);
        return total;
      } catch (err) {
        // Fallback
      }
    }
    return this.localRepo!.getTotalByType(type, startDate, endDate);
  }
}
