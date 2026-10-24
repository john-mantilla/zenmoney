import { BudgetRepository } from '@domain/repositories/BudgetRepository';
import { Budget, CreateBudgetInput } from '@domain/entities/Budget';
import { SupabaseBudgetRepository } from './SupabaseBudgetRepository';
import { SqliteBudgetRepository } from './SqliteBudgetRepository';
import { LocalDatabase } from '../local/LocalDatabase';
import { generateUUID } from '../../infrastructure/utils/uuid';
import { SyncService } from '../../infrastructure/services/SyncService';

import { Platform } from 'react-native';

export class HybridBudgetRepository implements BudgetRepository {
  private remoteRepo = new SupabaseBudgetRepository();
  private localRepo = Platform.OS === 'web' ? null : new SqliteBudgetRepository();

  async getById(id: string): Promise<Budget | null> {
    if (Platform.OS === 'web') return this.remoteRepo.getById(id);
    return this.localRepo!.getById(id);
  }

  async getAll(_preferCache = true): Promise<Budget[]> {
    if (Platform.OS === 'web') return this.remoteRepo.getAll();

    const local = await this.localRepo!.getAll();
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

  async getByMonth(year: number, month: number, _preferCache = true): Promise<Budget[]> {
    if (Platform.OS === 'web') return this.remoteRepo.getByMonth(year, month);
    return this.localRepo!.getByMonth(year, month);
  }

  async create(input: CreateBudgetInput): Promise<Budget> {
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
