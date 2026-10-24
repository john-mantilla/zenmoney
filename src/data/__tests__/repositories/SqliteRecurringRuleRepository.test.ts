import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SqliteRecurringRuleRepository } from '../../repositories/SqliteRecurringRuleRepository';
import { LocalDatabase } from '../../local/LocalDatabase';

// Mock de LocalDatabase
vi.mock('../../local/LocalDatabase', () => ({
  LocalDatabase: {
    getDb: vi.fn(),
  },
}));

// Mock de authStore
vi.mock('../../../infrastructure/auth/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      userProfile: { familyGroupId: 'fam-test-123' },
    })),
  },
}));

describe('SqliteRecurringRuleRepository', () => {
  let repository: SqliteRecurringRuleRepository;
  let mockDb: {
    getFirstAsync: ReturnType<typeof vi.fn>;
    getAllAsync: ReturnType<typeof vi.fn>;
    runAsync: ReturnType<typeof vi.fn>;
  };

  const sampleDbRow = {
    id: 'rule-1',
    family_group_id: 'fam-test-123',
    account_id: 'acc-1',
    category_id: 'cat-1',
    type: 'expense',
    amount: 15.99,
    description: 'Netflix',
    frequency: 'monthly',
    day_of_month: 5,
    start_date: '2026-01-01',
    end_date: null,
    is_active: 1,
    created_at: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      getFirstAsync: vi.fn(),
      getAllAsync: vi.fn(),
      runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
    };
    (LocalDatabase.getDb as any).mockReturnValue(mockDb);
    repository = new SqliteRecurringRuleRepository();
  });

  it('obtiene una regla recurrente por id correctamente mapeada al dominio', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(sampleDbRow);

    const result = await repository.getById('rule-1');

    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      'SELECT * FROM recurring_rules WHERE id = ?;',
      ['rule-1']
    );
    expect(result).not.toBeNull();
    expect(result?.id).toBe('rule-1');
    expect(result?.description).toBe('Netflix');
    expect(result?.amount).toBe(15.99);
    expect(result?.frequency).toBe('monthly');
    expect(result?.dayOfMonth).toBe(5);
    expect(result?.isActive).toBe(true);
    expect(result?.type).toBe('expense');
  });

  it('retorna null cuando no se encuentra la regla por id', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null);

    const result = await repository.getById('rule-inexistente');

    expect(result).toBeNull();
  });

  it('obtiene todas las reglas recurrentes activas', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([sampleDbRow]);

    const results = await repository.getAllActive();

    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      'SELECT * FROM recurring_rules WHERE is_active = 1 ORDER BY created_at DESC;'
    );
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('rule-1');
    expect(results[0].isActive).toBe(true);
  });

  it('crea una nueva regla recurrente en SQLite y encola sync action', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      ...sampleDbRow,
      id: 'rule-new-1',
      description: 'Spotify',
      amount: 9.99,
    });

    const input = {
      accountId: 'acc-1',
      categoryId: 'cat-1',
      description: 'Spotify',
      amount: 9.99,
      frequency: 'monthly' as const,
      dayOfMonth: 10,
      startDate: '2026-02-01',
      type: 'expense' as const,
    };

    const created = await repository.create(input);

    expect(mockDb.runAsync).toHaveBeenCalledTimes(2); // 1. INSERT recurring_rules, 2. INSERT sync_actions_queue
    const insertRuleCall = mockDb.runAsync.mock.calls[0];
    expect(insertRuleCall[0]).toContain('INSERT INTO recurring_rules');
    expect(insertRuleCall[1]).toContain('Spotify');

    const queueCall = mockDb.runAsync.mock.calls[1];
    expect(queueCall[0]).toContain("INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)");
    expect(queueCall[0]).toContain("'INSERT', 'recurring_rules'");

    expect(created.description).toBe('Spotify');
  });

  it('actualiza una regla recurrente existente y encola sync action', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce(sampleDbRow) // first call in update() to get existing row
      .mockResolvedValueOnce({ ...sampleDbRow, description: 'Netflix Premium', amount: 19.99 }); // second call in getById

    const updated = await repository.update('rule-1', {
      description: 'Netflix Premium',
      amount: 19.99,
    });

    expect(mockDb.runAsync).toHaveBeenCalledTimes(2); // 1. UPDATE recurring_rules, 2. INSERT sync_actions_queue
    const updateCall = mockDb.runAsync.mock.calls[0];
    expect(updateCall[0]).toContain('UPDATE recurring_rules SET');
    expect(updateCall[1]).toContain('Netflix Premium');

    const queueCall = mockDb.runAsync.mock.calls[1];
    expect(queueCall[0]).toContain("INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)");
    expect(queueCall[0]).toContain("'UPDATE', 'recurring_rules'");

    expect(updated.description).toBe('Netflix Premium');
  });

  it('elimina (soft delete) una regla recurrente y encola acción de eliminación', async () => {
    await repository.delete('rule-1');

    expect(mockDb.runAsync).toHaveBeenCalledTimes(2); // 1. UPDATE is_active=0, 2. INSERT into sync_actions_queue
    const deleteCall = mockDb.runAsync.mock.calls[0];
    expect(deleteCall[0]).toContain('UPDATE recurring_rules SET is_active = 0 WHERE id = ?;');
    expect(deleteCall[1]).toEqual(['rule-1']);

    const queueCall = mockDb.runAsync.mock.calls[1];
    expect(queueCall[0]).toContain("INSERT INTO sync_actions_queue (id, action_type, table_name, record_id, payload, created_at)");
    expect(queueCall[0]).toContain("'DELETE', 'recurring_rules'");
    expect(queueCall[1]).toContain('rule-1');
  });
});
