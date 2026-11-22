import { TransactionRepository, TransactionFilters } from '@domain/repositories/TransactionRepository';
import { Transaction, CreateTransactionInput } from '@domain/entities/Transaction';
import { SupabaseTransactionRepository } from './SupabaseTransactionRepository';
import { SqliteTransactionRepository } from './SqliteTransactionRepository';
import { LocalDatabase } from '../local/LocalDatabase';
import { generateUUID } from '../../infrastructure/utils/uuid';
import { SyncService } from '../../infrastructure/services/SyncService';
import { isOnlineFast, withTimeout } from '../../infrastructure/utils/network';

import { Platform } from 'react-native';

export class HybridTransactionRepository implements TransactionRepository {
  private remoteRepo = new SupabaseTransactionRepository();
  private localRepo = Platform.OS === 'web' ? null : new SqliteTransactionRepository();

  async getById(id: string): Promise<Transaction | null> {
    if (Platform.OS === 'web') return this.remoteRepo.getById(id);
    return this.localRepo!.getById(id);
  }

  async getAll(filters?: TransactionFilters, preferCache = true): Promise<Transaction[]> {
    if (Platform.OS === 'web') return this.remoteRepo.getAll(filters);

    const local = await this.localRepo!.getAll(filters);

    // Si la consulta local está vacía o se fuerza revalidación (preferCache = false),
    // y hay conectividad, descargar de la nube y persistir en SQLite
    if ((local.length === 0 || !preferCache) && (await isOnlineFast())) {
      try {
        const remote = await withTimeout(this.remoteRepo.getAll(filters), 8000, null as any);
        if (remote && remote.length > 0) {
          await this.localRepo!.bulkSave(remote);
          return this.localRepo!.getAll(filters);
        }
      } catch (err) {
        // Fallback al resultado local
      }
    }

    return local;
  }

  async create(input: CreateTransactionInput): Promise<Transaction> {
    const tempId = input.id || generateUUID();

    if (Platform.OS === 'web') {
      return this.remoteRepo.create({ ...input, id: tempId });
    }

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

    // Guardado Optimista Local-First: Persistir inmediatamente en SQLite (< 5ms)
    // Nota: SqliteTransactionRepository se encarga de actualizar atómicamente el current_balance si la tx es confirmed
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
    if (Platform.OS === 'web') {
      return this.remoteRepo.update(id, data);
    }

    const local = await this.localRepo!.update(id, { ...data, synced: false } as any);

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
    if (Platform.OS === 'web') {
      return this.remoteRepo.delete(id);
    }

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
    if (Platform.OS === 'web') {
      return this.remoteRepo.getTotalByType(type, startDate, endDate);
    }
    return this.localRepo!.getTotalByType(type, startDate, endDate);
  }
}
