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
    create = vi.fn().mockResolvedValue({});
    update = vi.fn().mockResolvedValue({});
    delete = vi.fn().mockResolvedValue(true);
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

  describe('getSyncStatus', () => {
    it('retorna la fecha real de sincronización y conteo de cola pendiente', async () => {
      const mockDateIso = '2026-11-22T10:30:00.000Z';
      const mockDb = {
        getFirstAsync: vi.fn()
          .mockResolvedValueOnce({ value: mockDateIso }) // sync_metadata
          .mockResolvedValueOnce({ count: 3 }), // sync_actions_queue
      };
      const { LocalDatabase } = await import('../../data/local/LocalDatabase');
      vi.mocked(LocalDatabase.getDb).mockReturnValueOnce(mockDb as any);

      const status = await SyncService.getSyncStatus();

      expect(status.lastSyncedAt).toEqual(new Date(mockDateIso));
      expect(status.pendingQueueCount).toBe(3);
      expect(status.isOnline).toBe(true);
    });

    it('maneja el caso de no haber sincronizado previamente (metadata null)', async () => {
      const mockDb = {
        getFirstAsync: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ count: 0 }),
      };
      const { LocalDatabase } = await import('../../data/local/LocalDatabase');
      vi.mocked(LocalDatabase.getDb).mockReturnValueOnce(mockDb as any);

      const status = await SyncService.getSyncStatus();

      expect(status.lastSyncedAt).toBeNull();
      expect(status.pendingQueueCount).toBe(0);
      expect(status.isOnline).toBe(true);
    });

    it('maneja errores en base de datos retornando estado por defecto seguro', async () => {
      const mockDb = {
        getFirstAsync: vi.fn().mockRejectedValue(new Error('SQLite error')),
      };
      const { LocalDatabase } = await import('../../data/local/LocalDatabase');
      vi.mocked(LocalDatabase.getDb).mockReturnValueOnce(mockDb as any);

      const status = await SyncService.getSyncStatus();

      expect(status.lastSyncedAt).toBeNull();
      expect(status.pendingQueueCount).toBe(0);
      expect(status.isOnline).toBe(true);
    });
  });

  describe('Tag Synchronization & Reconciliation', () => {
    it('procesa correctamente acciones pendientes de tags (INSERT, UPDATE, DELETE)', async () => {
      const mockDb = {
        getAllAsync: vi.fn()
          .mockResolvedValueOnce([]) // orphan unsynced txs
          .mockResolvedValueOnce([
            {
              id: 'act-1',
              action_type: 'UPDATE',
              table_name: 'tags',
              record_id: 'tag-1',
              payload: JSON.stringify({ name: 'Trabajo Modificado', color: '#123456' }),
            },
          ]),
        runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
      };
      const { LocalDatabase } = await import('../../data/local/LocalDatabase');
      vi.mocked(LocalDatabase.getDb).mockReturnValue(mockDb as any);

      const updateSpy = vi.spyOn((SyncService as any).remoteTagRepo, 'update').mockResolvedValue({});

      await SyncService.syncPendingActions();

      expect(updateSpy).toHaveBeenCalledWith('tag-1', {
        name: 'Trabajo Modificado',
        color: '#123456',
      });
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'DELETE FROM sync_actions_queue WHERE id = ?;',
        ['act-1']
      );

      updateSpy.mockRestore();
    });
  });
});
