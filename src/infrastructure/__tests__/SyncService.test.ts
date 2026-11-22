import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncService } from '../services/SyncService';

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

vi.mock('../utils/network', () => ({
  isOnlineFast: vi.fn().mockResolvedValue(true),
  withTimeout: vi.fn((p) => p),
}));

vi.mock('../../data/local/LocalDatabase', () => ({
  LocalDatabase: {
    getDb: vi.fn().mockReturnValue({
      getAllAsync: vi.fn().mockResolvedValue([]),
      getFirstAsync: vi.fn().mockResolvedValue({ count: 0 }),
      runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
    }),
  },
}));

vi.mock('../../data/repositories/SupabaseTransactionRepository', () => ({
  SupabaseTransactionRepository: class {
    getAll = vi.fn().mockResolvedValue([]);
    create = vi.fn().mockResolvedValue({});
    update = vi.fn().mockResolvedValue({});
    delete = vi.fn().mockResolvedValue(true);
  },
}));

vi.mock('../../data/repositories/SupabaseAccountRepository', () => ({
  SupabaseAccountRepository: class {
    getAll = vi.fn().mockResolvedValue([]);
    create = vi.fn().mockResolvedValue({});
    update = vi.fn().mockResolvedValue({});
    delete = vi.fn().mockResolvedValue(true);
  },
}));

vi.mock('../../data/repositories/SupabaseCategoryRepository', () => ({
  SupabaseCategoryRepository: class {
    getAll = vi.fn().mockResolvedValue([]);
  },
}));

vi.mock('../../data/repositories/SupabaseTagRepository', () => ({
  SupabaseTagRepository: class {
    getAll = vi.fn().mockResolvedValue([]);
  },
}));

vi.mock('../../data/repositories/SupabaseBudgetRepository', () => ({
  SupabaseBudgetRepository: class {
    getByMonth = vi.fn().mockResolvedValue([]);
  },
}));

vi.mock('../../data/repositories/SupabaseRecurringRuleRepository', () => ({
  SupabaseRecurringRuleRepository: class {
    getAll = vi.fn().mockResolvedValue([]);
  },
}));

vi.mock('../../data/repositories/SupabaseCategorizationRuleRepository', () => ({
  SupabaseCategorizationRuleRepository: class {
    getAll = vi.fn().mockResolvedValue([]);
  },
}));

describe('SyncService Concurrency & Deduplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deduplica llamadas concurrentes a fullSync() retornando la misma promesa en vuelo', async () => {
    let resolveFirstSync: () => void;
    const slowSyncPromise = new Promise<void>((resolve) => {
      resolveFirstSync = resolve;
    });

    const syncPendingSpy = vi.spyOn(SyncService, 'syncPendingActions').mockImplementation(async () => {
      await slowSyncPromise;
    });
    const syncCloudSpy = vi.spyOn(SyncService, 'syncCloudToLocal').mockResolvedValue(undefined);

    // Disparar dos llamadas concurrentes
    const p1 = SyncService.fullSync();
    const p2 = SyncService.fullSync();

    // Deben ser exactamente la misma instancia de Promesa
    expect(p1).toBe(p2);

    resolveFirstSync!();
    await Promise.all([p1, p2]);

    expect(syncPendingSpy).toHaveBeenCalledTimes(1);
    expect(syncCloudSpy).toHaveBeenCalledTimes(1);

    syncPendingSpy.mockRestore();
    syncCloudSpy.mockRestore();
  });

  it('evita ejecuciones concurrentes de syncCloudToLocal() mientras hay una en curso', async () => {
    let resolveFirst: () => void;
    const slowPromise = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    // Mock remoteAccountRepo getAll to wait
    (SyncService as any).remoteAccountRepo.getAll = vi.fn().mockImplementation(async () => {
      await slowPromise;
      return [];
    });

    const p1 = SyncService.syncCloudToLocal();
    const p2 = SyncService.syncCloudToLocal();

    // p2 debe resolverse inmediatamente sin ejecutar trabajo concurrente
    resolveFirst!();
    await Promise.all([p1, p2]);

    expect((SyncService as any).remoteAccountRepo.getAll).toHaveBeenCalledTimes(1);
  });
});
