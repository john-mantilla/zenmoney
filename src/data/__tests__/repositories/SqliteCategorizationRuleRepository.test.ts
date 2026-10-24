import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SqliteCategorizationRuleRepository } from '../../repositories/SqliteCategorizationRuleRepository';
import { HybridCategorizationRuleRepository } from '../../repositories/HybridCategorizationRuleRepository';
import { LocalDatabase } from '../../local/LocalDatabase';

const { mockPlatform } = vi.hoisted(() => ({
  mockPlatform: { OS: 'android' },
}));

vi.mock('react-native', () => ({
  Platform: mockPlatform,
}));

vi.mock('../../local/LocalDatabase', () => ({
  LocalDatabase: {
    getDb: vi.fn(),
  },
}));

vi.mock('../../../infrastructure/services/SyncService', () => ({
  SyncService: {
    syncPendingActions: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../repositories/SupabaseCategorizationRuleRepository', () => {
  return {
    SupabaseCategorizationRuleRepository: class {
      getAll = vi.fn().mockResolvedValue([{ id: 'rule-remote', matchPattern: 'remote' }]);
      create = vi.fn().mockResolvedValue({ id: 'rule-remote-created', matchPattern: 'remote-created' });
      update = vi.fn().mockResolvedValue({ id: 'rule-remote-updated', matchPattern: 'remote-updated' });
    },
  };
});

describe('SqliteCategorizationRuleRepository & HybridCategorizationRuleRepository', () => {
  let mockDb: any;

  beforeEach(() => {
    mockPlatform.OS = 'android';
    mockDb = {
      runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
      getFirstAsync: vi.fn(),
      getAllAsync: vi.fn().mockResolvedValue([]),
    };
    (LocalDatabase.getDb as any).mockReturnValue(mockDb);
  });

  it('SqliteCategorizationRuleRepository.getAll devuelve reglas mapeadas ordenadas', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'rule-1',
        family_group_id: 'fam-1',
        match_pattern: 'uber',
        category_id: 'cat-transporte',
        priority: 15,
        is_ai_generated: 1,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);

    const repo = new SqliteCategorizationRuleRepository();
    const rules = await repo.getAll();

    expect(rules).toHaveLength(1);
    expect(rules[0]).toEqual({
      id: 'rule-1',
      familyGroupId: 'fam-1',
      matchPattern: 'uber',
      categoryId: 'cat-transporte',
      priority: 15,
      isAiGenerated: true,
      createdAt: '2026-01-01T00:00:00Z',
    });
  });

  it('SqliteCategorizationRuleRepository.create inserta en BD y encola sincronización', async () => {
    const repo = new SqliteCategorizationRuleRepository();
    const result = await repo.create({
      matchPattern: 'netflix',
      categoryId: 'cat-entretenimiento',
      priority: 10,
      isAiGenerated: false,
    });

    expect(result.matchPattern).toBe('netflix');
    expect(result.categoryId).toBe('cat-entretenimiento');
    expect(result.priority).toBe(10);
    expect(result.isAiGenerated).toBe(false);

    // 1 insert en auto_categorization_rules, 1 insert en sync_actions_queue
    expect(mockDb.runAsync).toHaveBeenCalledTimes(2);
    expect(mockDb.runAsync.mock.calls[0][0]).toContain('INSERT INTO auto_categorization_rules');
    expect(mockDb.runAsync.mock.calls[1][0]).toContain('INSERT INTO sync_actions_queue');
  });

  it('SqliteCategorizationRuleRepository.update actualiza en BD y encola actualización', async () => {
    mockDb.getFirstAsync.mockResolvedValue({
      id: 'rule-update-1',
      family_group_id: 'fam-1',
      match_pattern: 'starbucks',
      category_id: 'cat-cafe',
      priority: 10,
      is_ai_generated: 0,
      created_at: '2026-01-01T00:00:00Z',
    });

    const repo = new SqliteCategorizationRuleRepository();
    const result = await repo.update('rule-update-1', {
      matchPattern: 'starbucks coffee',
      priority: 20,
    });

    expect(result.matchPattern).toBe('starbucks coffee');
    expect(result.priority).toBe(20);
    expect(mockDb.runAsync).toHaveBeenCalledTimes(2);
    expect(mockDb.runAsync.mock.calls[0][0]).toContain('UPDATE auto_categorization_rules');
    expect(mockDb.runAsync.mock.calls[1][0]).toContain('INSERT INTO sync_actions_queue');
  });

  it('HybridCategorizationRuleRepository bifurca correctamente entre Web y Móvil', async () => {
    // Móvil -> SQLite
    mockPlatform.OS = 'android';
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'rule-local',
        family_group_id: 'fam-1',
        match_pattern: 'local-pat',
        category_id: 'cat-1',
        priority: 5,
        is_ai_generated: 0,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);

    const hybridRepo = new HybridCategorizationRuleRepository();
    const mobileRules = await hybridRepo.getAll();
    expect(mobileRules[0].id).toBe('rule-local');

    // Web -> Supabase
    mockPlatform.OS = 'web';
    const webRules = await hybridRepo.getAll();
    expect(webRules[0].id).toBe('rule-remote');
  });
});
