import { BudgetRepository } from '@domain/repositories/BudgetRepository';
import { Budget, CreateBudgetInput } from '@domain/entities/Budget';
import { SupabaseBudgetRepository } from './SupabaseBudgetRepository';
import { SqliteBudgetRepository } from './SqliteBudgetRepository';
import NetInfo from '@react-native-community/netinfo';
import { LocalDatabase } from '../local/LocalDatabase';
import { generateUUID } from '../../infrastructure/utils/uuid';

import { Platform } from 'react-native';

export class HybridBudgetRepository implements BudgetRepository {
  private remoteRepo = new SupabaseBudgetRepository();
  private localRepo = Platform.OS === 'web' ? null : new SqliteBudgetRepository();

  private async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return !!state.isConnected;
  }

  async getById(id: string): Promise<Budget | null> {
    if (Platform.OS === 'web') return this.remoteRepo.getById(id);

    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.getById(id);
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

  async getByMonth(year: number, month: number): Promise<Budget[]> {
    if (Platform.OS === 'web') return this.remoteRepo.getByMonth(year, month);

    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.getByMonth(year, month);
        await this.localRepo!.bulkSave(remote);

        // Mezclar con presupuestos locales no sincronizados
        const unsynced = await this.localRepo!.getUnsynced();
        const filteredUnsynced = unsynced.filter(b => b.year === year && b.month === month);

        const combinedMap = new Map<string, Budget>();
        remote.forEach(b => combinedMap.set(b.id, b));
        filteredUnsynced.forEach(b => combinedMap.set(b.id, b));

        return Array.from(combinedMap.values());
      } catch (err) {
        // Fallback
      }
    }
    return this.localRepo!.getByMonth(year, month);
  }

  async create(input: CreateBudgetInput): Promise<Budget> {
    const tempId = input.id || generateUUID();
    const familyGroupId = 'offline-family';
    const createdAt = new Date().toISOString();

    const localInput = {
      ...input,
      id: tempId,
      familyGroupId,
      createdAt
    };

    if (Platform.OS === 'web') return this.remoteRepo.create({ ...input, id: tempId });

    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.create({ ...input, id: tempId });
        await this.localRepo!.bulkSave([remote]);
        return remote;
      } catch (err) {
        // Fallback
      }
    }

    const local = await this.localRepo!.create(localInput);

    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'INSERT', 'budgets', tempId, JSON.stringify(localInput), createdAt]
    );

    return local;
  }

  async update(id: string, data: Partial<CreateBudgetInput>): Promise<Budget> {
    if (Platform.OS === 'web') return this.remoteRepo.update(id, data);

    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.update(id, data);
        await this.localRepo!.bulkSave([remote]);
        return remote;
      } catch (err) {
        // Fallback
      }
    }

    const local = await this.localRepo!.update(id, data);

    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'UPDATE', 'budgets', id, JSON.stringify(data), new Date().toISOString()]
    );

    return local;
  }

  async delete(id: string): Promise<void> {
    if (Platform.OS === 'web') return this.remoteRepo.delete(id);

    if (await this.isOnline()) {
      try {
        await this.remoteRepo.delete(id);
        await this.localRepo!.delete(id);
        return;
      } catch (err) {
        // Fallback
      }
    }

    await this.localRepo!.delete(id);

    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'DELETE', 'budgets', id, '{}', new Date().toISOString()]
    );
  }
}
