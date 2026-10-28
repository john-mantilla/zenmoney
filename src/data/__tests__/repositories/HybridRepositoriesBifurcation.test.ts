import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPlatform } = vi.hoisted(() => ({
  mockPlatform: { OS: 'android' },
}));

vi.mock('react-native', () => ({
  Platform: mockPlatform,
}));

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    fetch: vi.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
    addEventListener: vi.fn(() => vi.fn()),
  },
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

vi.mock('../../repositories/SupabaseBudgetRepository', () => {
  return {
    SupabaseBudgetRepository: class {
      getAll = vi.fn().mockResolvedValue([{ id: 'budget-remote' }]);
      getByMonth = vi.fn().mockResolvedValue([{ id: 'budget-remote-month' }]);
      getById = vi.fn().mockResolvedValue({ id: 'budget-remote' });
    },
  };
});

vi.mock('../../repositories/SqliteBudgetRepository', () => {
  return {
    SqliteBudgetRepository: class {
      getAll = vi.fn().mockResolvedValue([{ id: 'budget-local' }]);
      getByMonth = vi.fn().mockResolvedValue([{ id: 'budget-local-month' }]);
      getById = vi.fn().mockResolvedValue({ id: 'budget-local' });
      bulkSave = vi.fn().mockResolvedValue(undefined);
    },
  };
});

vi.mock('../../repositories/SupabaseRecurringRuleRepository', () => {
  return {
    SupabaseRecurringRuleRepository: class {
      getAll = vi.fn().mockResolvedValue([{ id: 'rule-remote' }]);
      getAllActive = vi.fn().mockResolvedValue([{ id: 'rule-remote-active' }]);
      getById = vi.fn().mockResolvedValue({ id: 'rule-remote' });
    },
  };
});

vi.mock('../../repositories/SqliteRecurringRuleRepository', () => {
  return {
    SqliteRecurringRuleRepository: class {
      getAll = vi.fn().mockResolvedValue([{ id: 'rule-local' }]);
      getAllActive = vi.fn().mockResolvedValue([{ id: 'rule-local-active' }]);
      getById = vi.fn().mockResolvedValue({ id: 'rule-local' });
      bulkSave = vi.fn().mockResolvedValue(undefined);
    },
  };
});

import { HybridTransactionRepository } from '../../repositories/HybridTransactionRepository';
import { HybridAccountRepository } from '../../repositories/HybridAccountRepository';
import { HybridBudgetRepository } from '../../repositories/HybridBudgetRepository';
import { HybridRecurringRuleRepository } from '../../repositories/HybridRecurringRuleRepository';

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

    it('HybridBudgetRepository lee de SQLite en móvil', async () => {
      const repo = new HybridBudgetRepository();
      const budgets = await repo.getAll();
      expect(budgets).toEqual([{ id: 'budget-local' }]);
      const byMonth = await repo.getByMonth(2026, 10);
      expect(byMonth).toEqual([{ id: 'budget-local-month' }]);
    });

    it('HybridRecurringRuleRepository lee de SQLite en móvil', async () => {
      const repo = new HybridRecurringRuleRepository();
      const rules = await repo.getAll();
      expect(rules).toEqual([{ id: 'rule-local' }]);
      const active = await repo.getAllActive();
      expect(active).toEqual([{ id: 'rule-local-active' }]);
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

    it('HybridBudgetRepository delega directamente a Supabase en Web', async () => {
      const repo = new HybridBudgetRepository();
      const budgets = await repo.getAll();
      expect(budgets).toEqual([{ id: 'budget-remote' }]);
      const byMonth = await repo.getByMonth(2026, 10);
      expect(byMonth).toEqual([{ id: 'budget-remote-month' }]);
    });

    it('HybridRecurringRuleRepository delega directamente a Supabase en Web', async () => {
      const repo = new HybridRecurringRuleRepository();
      const rules = await repo.getAll();
      expect(rules).toEqual([{ id: 'rule-remote' }]);
      const active = await repo.getAllActive();
      expect(active).toEqual([{ id: 'rule-remote-active' }]);
    });
  });
});
