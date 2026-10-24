import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPlatform } = vi.hoisted(() => ({
  mockPlatform: { OS: 'android' },
}));

vi.mock('react-native', () => ({
  Platform: mockPlatform,
}));

// Mock dependencies
vi.mock('../../local/LocalDatabase', () => ({
  LocalDatabase: {
    getDb: vi.fn(() => ({
      runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
      getFirstAsync: vi.fn(),
      getAllAsync: vi.fn().mockResolvedValue([]),
    })),
  },
}));

vi.mock('../../../infrastructure/services/SyncService', () => ({
  SyncService: {
    syncPendingActions: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../repositories/SupabaseTransactionRepository', () => {
  return {
    SupabaseTransactionRepository: class {
      getAll = vi.fn().mockResolvedValue([{ id: 'tx-remote' }]);
      getById = vi.fn().mockResolvedValue({ id: 'tx-remote' });
      create = vi.fn().mockResolvedValue({ id: 'tx-remote-created' });
      update = vi.fn().mockResolvedValue({ id: 'tx-remote-updated' });
      delete = vi.fn().mockResolvedValue(undefined);
      getTotalByType = vi.fn().mockResolvedValue(999);
    },
  };
});

vi.mock('../../repositories/SqliteTransactionRepository', () => {
  return {
    SqliteTransactionRepository: class {
      getAll = vi.fn().mockResolvedValue([{ id: 'tx-local' }]);
      getById = vi.fn().mockResolvedValue({ id: 'tx-local' });
      create = vi.fn().mockResolvedValue({ id: 'tx-local-created' });
      update = vi.fn().mockResolvedValue({ id: 'tx-local-updated' });
      delete = vi.fn().mockResolvedValue(undefined);
      getTotalByType = vi.fn().mockResolvedValue(111);
    },
  };
});

vi.mock('../../repositories/SupabaseAccountRepository', () => {
  return {
    SupabaseAccountRepository: class {
      getAll = vi.fn().mockResolvedValue([{ id: 'acc-remote', initialBalance: 100 }]);
      getById = vi.fn().mockResolvedValue({ id: 'acc-remote', initialBalance: 100 });
      create = vi.fn().mockResolvedValue({ id: 'acc-remote-created' });
    },
  };
});

vi.mock('../../repositories/SqliteAccountRepository', () => {
  return {
    SqliteAccountRepository: class {
      getAll = vi.fn().mockResolvedValue([{ id: 'acc-local' }]);
      getById = vi.fn().mockResolvedValue({ id: 'acc-local' });
      create = vi.fn().mockResolvedValue({ id: 'acc-local-created' });
    },
  };
});

import { HybridTransactionRepository } from '../../repositories/HybridTransactionRepository';
import { HybridAccountRepository } from '../../repositories/HybridAccountRepository';

describe('Bifurcación de Repositorios Híbridos (Web vs Móvil)', () => {
  describe('Modo Móvil (Platform.OS = android / ios)', () => {
    beforeEach(() => {
      mockPlatform.OS = 'android';
    });

    it('HybridTransactionRepository lee exclusivamente de SQLite en móvil', async () => {
      const repo = new HybridTransactionRepository();
      const results = await repo.getAll();
      expect(results).toEqual([{ id: 'tx-local' }]);
      
      const single = await repo.getById('tx-local');
      expect(single).toEqual({ id: 'tx-local' });
    });

    it('HybridAccountRepository lee exclusivamente de SQLite en móvil cuando hay datos', async () => {
      const repo = new HybridAccountRepository();
      const accounts = await repo.getAll();
      expect(accounts).toEqual([{ id: 'acc-local' }]);
    });
  });

  describe('Modo Web (Platform.OS = web)', () => {
    beforeEach(() => {
      mockPlatform.OS = 'web';
    });

    it('HybridTransactionRepository delega directamente a Supabase en Web', async () => {
      const repo = new HybridTransactionRepository();
      const results = await repo.getAll();
      expect(results).toEqual([{ id: 'tx-remote' }]);
      
      const single = await repo.getById('tx-remote');
      expect(single).toEqual({ id: 'tx-remote' });
    });

    it('HybridAccountRepository delega directamente a Supabase en Web', async () => {
      const repo = new HybridAccountRepository();
      const accounts = await repo.getAll();
      expect(accounts).toEqual([{ id: 'acc-remote', initialBalance: 100, currentBalance: 100 }]);
    });
  });
});
