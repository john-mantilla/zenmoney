/**
 * ZenMoney — HybridRecurringRuleRepository
 *
 * Bifurca limpiamente por plataforma:
 * - Web (Platform.OS === 'web'): Cloud-Direct hacia SupabaseRecurringRuleRepository.
 * - Móvil (Platform.OS !== 'web'): 100% Local-First hacia SqliteRecurringRuleRepository.
 */

import { Platform } from 'react-native';
import { RecurringRuleRepository } from '@domain/repositories/RecurringRuleRepository';
import { RecurringRule, CreateRecurringRuleInput } from '@domain/entities/RecurringRule';
import { SupabaseRecurringRuleRepository } from './SupabaseRecurringRuleRepository';
import { SqliteRecurringRuleRepository } from './SqliteRecurringRuleRepository';
import { SyncService } from '../../infrastructure/services/SyncService';
import { isOnlineFast } from '../../infrastructure/utils/network';

export class HybridRecurringRuleRepository implements RecurringRuleRepository {
  private remoteRepo = new SupabaseRecurringRuleRepository();
  private localRepo = Platform.OS === 'web' ? null : new SqliteRecurringRuleRepository();

  async getById(id: string): Promise<RecurringRule | null> {
    if (Platform.OS === 'web') {
      return this.remoteRepo.getById(id);
    }
    return this.localRepo!.getById(id);
  }

  async getAllActive(preferCache = true): Promise<RecurringRule[]> {
    if (Platform.OS === 'web') {
      return this.remoteRepo.getAllActive();
    }
    const local = await this.localRepo!.getAllActive();
    if ((local.length === 0 || !preferCache) && (await isOnlineFast())) {
      try {
        const remote = await this.remoteRepo.getAllActive();
        if (remote && remote.length > 0) {
          await this.localRepo!.bulkSave(remote);
          return this.localRepo!.getAllActive();
        }
      } catch (err) {
        console.warn('[HybridRecurringRuleRepository] getAllActive remote fallback error:', err);
      }
    }
    return local;
  }

  async getAll(preferCache = true): Promise<RecurringRule[]> {
    if (Platform.OS === 'web') {
      return this.remoteRepo.getAll();
    }
    const local = await this.localRepo!.getAll();
    if ((local.length === 0 || !preferCache) && (await isOnlineFast())) {
      try {
        const remote = await this.remoteRepo.getAll();
        if (remote && remote.length > 0) {
          await this.localRepo!.bulkSave(remote);
          return this.localRepo!.getAll();
        }
      } catch (err) {
        console.warn('[HybridRecurringRuleRepository] getAll remote fallback error:', err);
      }
    }
    return local;
  }

  async create(input: CreateRecurringRuleInput): Promise<RecurringRule> {
    if (Platform.OS === 'web') {
      return this.remoteRepo.create(input);
    }
    const created = await this.localRepo!.create(input);
    // Intentar sincronizar en segundo plano sin bloquear
    SyncService.syncPendingActions().catch(() => {});
    return created;
  }

  async update(id: string, data: Partial<CreateRecurringRuleInput>): Promise<RecurringRule> {
    if (Platform.OS === 'web') {
      return this.remoteRepo.update(id, data);
    }
    const updated = await this.localRepo!.update(id, data);
    SyncService.syncPendingActions().catch(() => {});
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (Platform.OS === 'web') {
      return this.remoteRepo.delete(id);
    }
    await this.localRepo!.delete(id);
    SyncService.syncPendingActions().catch(() => {});
  }
}
