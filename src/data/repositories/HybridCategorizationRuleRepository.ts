import { Platform } from 'react-native';
import { CategorizationRuleRepository } from '@domain/repositories/CategorizationRuleRepository';
import { CategorizationRule, CreateCategorizationRuleInput } from '@domain/entities/CategorizationRule';
import { SupabaseCategorizationRuleRepository } from './SupabaseCategorizationRuleRepository';
import { SqliteCategorizationRuleRepository } from './SqliteCategorizationRuleRepository';
import { SyncService } from '../../infrastructure/services/SyncService';

export class HybridCategorizationRuleRepository implements CategorizationRuleRepository {
  private remoteRepo = new SupabaseCategorizationRuleRepository();
  private localRepo = Platform.OS === 'web' ? null : new SqliteCategorizationRuleRepository();

  async getAll(): Promise<CategorizationRule[]> {
    if (Platform.OS === 'web') {
      return this.remoteRepo.getAll();
    }
    const local = await this.localRepo!.getAll();
    if (local.length === 0) {
      try {
        const remote = await this.remoteRepo.getAll();
        if (remote && remote.length > 0) {
          await this.localRepo!.bulkSave(remote);
          return this.localRepo!.getAll();
        }
      } catch {
        // Fallback
      }
    }
    return local;
  }

  async create(input: CreateCategorizationRuleInput): Promise<CategorizationRule> {
    if (Platform.OS === 'web') {
      return this.remoteRepo.create(input);
    }
    const created = await this.localRepo!.create(input);
    SyncService.syncPendingActions().catch(() => {});
    return created;
  }

  async update(id: string, data: Partial<CreateCategorizationRuleInput>): Promise<CategorizationRule> {
    if (Platform.OS === 'web') {
      return this.remoteRepo.update(id, data);
    }
    const updated = await this.localRepo!.update(id, data);
    SyncService.syncPendingActions().catch(() => {});
    return updated;
  }
}
