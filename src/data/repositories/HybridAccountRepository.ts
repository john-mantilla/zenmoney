import { AccountRepository } from '@domain/repositories/AccountRepository';
import { Account, CreateAccountInput } from '@domain/entities/Account';
import { SupabaseAccountRepository } from './SupabaseAccountRepository';
import { SqliteAccountRepository } from './SqliteAccountRepository';
import NetInfo from '@react-native-community/netinfo';
import { LocalDatabase } from '../local/LocalDatabase';

export class HybridAccountRepository implements AccountRepository {
  private remoteRepo = new SupabaseAccountRepository();
  private localRepo = new SqliteAccountRepository();

  private async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return !!state.isConnected;
  }

  async getById(id: string): Promise<Account | null> {
    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.getById(id);
        if (remote) {
          await this.localRepo.bulkSave([remote]);
          return remote;
        }
      } catch (err) {
        // Fallback silently
      }
    }
    return this.localRepo.getById(id);
  }

  async getAll(): Promise<Account[]> {
    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.getAll();
        await this.localRepo.bulkSave(remote);
        return remote;
      } catch (err) {
        // Fallback silently
      }
    }
    return this.localRepo.getAll();
  }

  async create(input: CreateAccountInput): Promise<Account> {
    const tempId = (input as any).id || 'acc_' + Math.random().toString(36).substring(2, 15);
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

    if (await this.isOnline()) {
      try {
        // 1. Intentar crear en la nube
        const remote = await this.remoteRepo.create(input);
        // 2. Guardar en SQLite local marcado como sincronizado
        await this.localRepo.bulkSave([remote]);
        return remote;
      } catch (err) {
        // Fallback a encolar localmente
      }
    }

    // 3. Crear localmente y marcar como pendiente de sincronización
    const local = await this.localRepo.create(localInput);
    
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
    if (await this.isOnline()) {
      try {
        const remote = await this.remoteRepo.update(id, data);
        await this.localRepo.bulkSave([remote]);
        return remote;
      } catch (err) {
        // Fallback a encolar localmente
      }
    }

    const local = await this.localRepo.update(id, data);
    
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
    if (await this.isOnline()) {
      try {
        await this.remoteRepo.delete(id);
        await this.localRepo.delete(id);
        return;
      } catch (err) {
        // Fallback a encolar localmente
      }
    }

    await this.localRepo.delete(id);

    const db = LocalDatabase.getDb();
    const actionId = 'act_' + Math.random().toString(36).substring(2, 15);
    await db.runAsync(
      `INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [actionId, 'DELETE', 'accounts', id, '{}', new Date().toISOString()]
    );
  }
}
