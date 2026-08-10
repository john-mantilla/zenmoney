import { TransactionRepository, TransactionFilters } from '@domain/repositories/TransactionRepository';
import { Transaction, CreateTransactionInput } from '@domain/entities/Transaction';
import { SupabaseTransactionRepository } from './SupabaseTransactionRepository';
import { SqliteTransactionRepository } from './SqliteTransactionRepository';
import NetInfo from '@react-native-community/netinfo';
import { LocalDatabase } from '../local/LocalDatabase';
import { generateUUID } from '../../infrastructure/utils/uuid';

import { Platform } from 'react-native';

export class HybridTransactionRepository implements TransactionRepository {
  private remoteRepo = new SupabaseTransactionRepository();
  private localRepo = Platform.OS === 'web' ? null : new SqliteTransactionRepository();

  private async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return !!state.isConnected;
  }

  async getById(id: string): Promise<Transaction | null> {
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

  async getAll(filters?: TransactionFilters, preferCache = false): Promise<Transaction[]> {
    if (Platform.OS === 'web') return this.remoteRepo.getAll(filters);

    if (preferCache && this.localRepo) {
      const local = await this.localRepo.getAll(filters);
      if (local.length > 0) {
        return local;
      }
    }

    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.getAll(filters);
        if (this.localRepo) {
          await (this.localRepo as any).syncWithRemote(remote, filters);
        }

        if (filters?.inputMethod === 'email' && filters?.status === 'pending' && this.localRepo) {
          await this.localRepo.syncPendingEmailInvoices(remote);
        }

        // Mezclar con transacciones locales no sincronizadas
        const unsynced = await this.localRepo!.getUnsynced();
        let filteredUnsynced = unsynced;
        if (filters) {
          if (filters.accountId) {
            filteredUnsynced = filteredUnsynced.filter(tx => tx.accountId === filters.accountId || tx.transferToAccountId === filters.accountId);
          }
          if (filters.categoryId) {
            filteredUnsynced = filteredUnsynced.filter(tx => tx.categoryId === filters.categoryId);
          }
          if (filters.type) {
            filteredUnsynced = filteredUnsynced.filter(tx => tx.type === filters.type);
          }
          if (filters.status) {
            filteredUnsynced = filteredUnsynced.filter(tx => tx.status === filters.status);
          }
          if (filters.startDate) {
            filteredUnsynced = filteredUnsynced.filter(tx => tx.transactionDate >= filters.startDate!);
          }
          if (filters.endDate) {
            filteredUnsynced = filteredUnsynced.filter(tx => tx.transactionDate <= filters.endDate!);
          }
        }

        const combinedMap = new Map<string, Transaction>();
        remote.forEach(tx => combinedMap.set(tx.id, tx));
        filteredUnsynced.forEach(tx => combinedMap.set(tx.id, tx));

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

  async create(input: CreateTransactionInput): Promise<Transaction> {
    const tempId = input.id || generateUUID();
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
      [actionId, 'INSERT', 'transactions', tempId, JSON.stringify(localInput), createdAt]
    );

    return local;
  }

  async update(id: string, data: Partial<CreateTransactionInput>): Promise<Transaction> {
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

    const local = await this.localRepo!.update(id, { ...data, synced: false } as any);

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
      [actionId, 'DELETE', 'transactions', id, '{}', new Date().toISOString()]
    );
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
