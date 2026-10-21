import { BudgetRepository } from '@domain/repositories/BudgetRepository';
import { Budget, CreateBudgetInput } from '@domain/entities/Budget';
import { SupabaseBudgetRepository } from './SupabaseBudgetRepository';
import { SqliteBudgetRepository } from './SqliteBudgetRepository';
import { isOnlineFast, withTimeout } from '../../infrastructure/utils/network';
import { LocalDatabase } from '../local/LocalDatabase';
import { generateUUID } from '../../infrastructure/utils/uuid';
import { SyncService } from '../../infrastructure/services/SyncService';

import { Platform } from 'react-native';

export class HybridBudgetRepository implements BudgetRepository {
  private remoteRepo = new SupabaseBudgetRepository();
  private localRepo = Platform.OS === 'web' ? null : new SqliteBudgetRepository();

  private async isOnline(): Promise<boolean> {
    return isOnlineFast();
  }

  async getById(id: string): Promise<Budget | null> {
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

  async getAll(preferCache = false): Promise<Budget[]> {
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
          await this.localRepo!.bulkSave(remote);

          const unsynced = await this.localRepo!.getUnsynced();
          const combinedMap = new Map<string, Budget>();
          remote.forEach(b => combinedMap.set(b.id, b));
          unsynced.forEach(b => combinedMap.set(b.id, b));

          return Array.from(combinedMap.values());
        }
      } catch (err) {
        // Fallback
      }
    }
    return this.localRepo!.getAll();
  }

  async getByMonth(year: number, month: number, preferCache = false): Promise<Budget[]> {
    if (Platform.OS === 'web') return this.remoteRepo.getByMonth(year, month);

    if (preferCache && this.localRepo) {
      const local = await this.localRepo.getByMonth(year, month);
      if (local.length > 0) {
        return local;
      }
    }

    if (await this.isOnline()) {
      try {
        const remote = await withTimeout(this.remoteRepo.getByMonth(year, month), 2500);
        if (remote) {
          await this.localRepo!.bulkSave(remote);

          // Mezclar con presupuestos locales no sincronizados
          const unsynced = await this.localRepo!.getUnsynced();
          const filteredUnsynced = unsynced.filter(b => b.year === year && b.month === month);

          const combinedMap = new Map<string, Budget>();
          remote.forEach(b => combinedMap.set(b.id, b));
          filteredUnsynced.forEach(b => combinedMap.set(b.id, b));

          return Array.from(combinedMap.values());
        }
      } catch (err) {
        // Fallback
      }
    }
    return this.localRepo!.getByMonth(year, month);
  }

  async create(input: CreateBudgetInput): Promise<Budget> {
    const tempId = input.id || generateUUID();
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

    if (Platform.OS === 'web') return this.remoteRepo.create({ ...input, id: tempId });

    // Guardado Optimista Local-First (< 5ms)
    const local = await this.localRepo!.create(localInput);

    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'INSERT', 'budgets', tempId, JSON.stringify(localInput), createdAt]
    );

    // Replicación asíncrona transparente en segundo plano
    SyncService.syncPendingActions().catch(() => {});

    return local;
  }

  async update(id: string, data: Partial<CreateBudgetInput>): Promise<Budget> {
    if (Platform.OS === 'web') return this.remoteRepo.update(id, data);

    // Actualización Optimista Local-First (< 5ms)
    const local = await this.localRepo!.update(id, data);

    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'UPDATE', 'budgets', id, JSON.stringify(data), new Date().toISOString()]
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
      [actionId, 'DELETE', 'budgets', id, '{}', new Date().toISOString()]
    );

    // Replicación asíncrona transparente en segundo plano
    SyncService.syncPendingActions().catch(() => {});
  }
}
