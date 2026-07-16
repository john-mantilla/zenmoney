import { TransactionRepository, TransactionFilters } from '@domain/repositories/TransactionRepository';
import { Transaction, CreateTransactionInput } from '@domain/entities/Transaction';
import { SupabaseTransactionRepository } from './SupabaseTransactionRepository';
import { SqliteTransactionRepository } from './SqliteTransactionRepository';
import NetInfo from '@react-native-community/netinfo';
import { LocalDatabase } from '../local/LocalDatabase';

export class HybridTransactionRepository implements TransactionRepository {
  private remoteRepo = new SupabaseTransactionRepository();
  private localRepo = new SqliteTransactionRepository();

  private async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return !!state.isConnected;
  }

  async getById(id: string): Promise<Transaction | null> {
    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.getById(id);
        if (remote) {
          await this.localRepo.bulkSave([remote]);
          return remote;
        }
      } catch (err) {
        // Fallback
      }
    }
    return this.localRepo.getById(id);
  }

  async getAll(filters?: TransactionFilters): Promise<Transaction[]> {
    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.getAll(filters);
        await this.localRepo.bulkSave(remote);
        return remote;
      } catch (err) {
        // Fallback
      }
    }
    return this.localRepo.getAll(filters);
  }

  async create(input: CreateTransactionInput): Promise<Transaction> {
    const tempId = (input as any).id || 'tx_' + Math.random().toString(36).substring(2, 15);
    const familyGroupId = 'offline-family';
    const createdByUserId = 'offline-user';
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

    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.create(input);
        await this.localRepo.bulkSave([remote]);
        return remote;
      } catch (err) {
        // Fallback
      }
    }

    const local = await this.localRepo.create(localInput);

    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'INSERT', 'transactions', tempId, JSON.stringify(localInput), createdAt]
    );

    return local;
  }

  async update(id: string, data: Partial<CreateTransactionInput>): Promise<Transaction> {
    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.update(id, data);
        await this.localRepo.bulkSave([remote]);
        return remote;
      } catch (err) {
        // Fallback
      }
    }

    const local = await this.localRepo.update(id, { ...data, synced: false } as any);

    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'UPDATE', 'transactions', id, JSON.stringify(data), new Date().toISOString()]
    );

    return local;
  }

  async delete(id: string): Promise<void> {
    if (await this.isOnline()) {
      try {
        await this.remoteRepo.delete(id);
        await this.localRepo.delete(id);
        return;
      } catch (err) {
        // Fallback
      }
    }

    await this.localRepo.delete(id);

    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'DELETE', 'transactions', id, '{}', new Date().toISOString()]
    );
  }

  async getByDateRange(startDate: string, endDate: string): Promise<Transaction[]> {
    return this.getAll({ startDate, endDate });
  }

  async getTotalByType(type: Transaction['type'], startDate: string, endDate: string): Promise<number> {
    if (await this.isOnline()) {
      try {
        const total = await this.remoteRepo.getTotalByType(type, startDate, endDate);
        return total;
      } catch (err) {
        // Fallback
      }
    }
    return this.localRepo.getTotalByType(type, startDate, endDate);
  }
}
