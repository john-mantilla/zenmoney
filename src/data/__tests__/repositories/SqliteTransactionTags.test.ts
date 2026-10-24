import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SqliteTransactionRepository } from '../../repositories/SqliteTransactionRepository';
import { LocalDatabase } from '../../local/LocalDatabase';

vi.mock('../../local/LocalDatabase', () => ({
  LocalDatabase: {
    getDb: vi.fn(),
  },
}));

describe('SqliteTransactionRepository — Soporte de Etiquetas (Tags)', () => {
  let transactionRepo: SqliteTransactionRepository;
  let mockDb: {
    getFirstAsync: ReturnType<typeof vi.fn>;
    getAllAsync: ReturnType<typeof vi.fn>;
    runAsync: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      getFirstAsync: vi.fn(),
      getAllAsync: vi.fn().mockResolvedValue([]),
      runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
    };
    (LocalDatabase.getDb as any).mockReturnValue(mockDb);
    transactionRepo = new SqliteTransactionRepository();
  });

  it('al crear una transacción con tags, inserta en transaction_tags y vincula los tags al resultado', async () => {
    // 1. getAllAsync para attachTags: simula que el tag existe en la base de datos
    mockDb.getAllAsync.mockResolvedValueOnce([
      {
        transaction_id: 'tx-100',
        id: 'tag-1',
        family_group_id: 'fam-1',
        name: 'Supermercado',
        color: '#4CAF50',
        created_at: '2026-10-24T00:00:00Z',
      },
    ]);

    const created = await transactionRepo.create({
      id: 'tx-100',
      accountId: 'acc-1',
      amount: 150,
      type: 'expense',
      status: 'confirmed',
      currency: 'COP',
      tags: ['tag-1'],
    });

    // Verifica que se insertó la relación en transaction_tags
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?);',
      ['tx-100', 'tag-1']
    );

    // Verifica que la transacción creada devuelva los tags poblados
    expect(created.tags).toBeDefined();
    expect(created.tags).toHaveLength(1);
    expect(created.tags![0].id).toBe('tag-1');
    expect(created.tags![0].name).toBe('Supermercado');
  });

  it('getAll puebla los tags asociados a cada transacción', async () => {
    // 1. Query principal de transacciones
    mockDb.getAllAsync
      .mockResolvedValueOnce([
        {
          id: 'tx-1',
          family_group_id: 'fam-1',
          account_id: 'acc-1',
          category_id: 'cat-1',
          created_by_user_id: 'usr-1',
          type: 'expense',
          amount: 50,
          currency: 'COP',
          transaction_date: '2026-10-24',
          status: 'confirmed',
          input_method: 'manual',
          is_private: 0,
          created_at: '2026-10-24T10:00:00Z',
          updated_at: '2026-10-24T10:00:00Z',
        },
      ])
      // 2. Query de attachTags
      .mockResolvedValueOnce([
        {
          transaction_id: 'tx-1',
          id: 'tag-vacaciones',
          family_group_id: 'fam-1',
          name: 'Vacaciones',
          color: '#2196F3',
          created_at: '2026-10-24T00:00:00Z',
        },
      ]);

    const results = await transactionRepo.getAll();

    expect(results).toHaveLength(1);
    expect(results[0].tags).toBeDefined();
    expect(results[0].tags).toHaveLength(1);
    expect(results[0].tags![0].id).toBe('tag-vacaciones');
    expect(results[0].tags![0].name).toBe('Vacaciones');
  });

  it('getAll con filtro tagId genera la cláusula SQL de filtrado por etiqueta', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([]);

    await transactionRepo.getAll({ tagId: 'tag-salidas' });

    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('id IN (SELECT transaction_id FROM transaction_tags WHERE tag_id = ?)'),
      ['tag-salidas']
    );
  });

  it('al eliminar una transacción, limpia los registros correspondientes de transaction_tags', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null);

    await transactionRepo.delete('tx-para-borrar');

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM transactions WHERE id = ?;',
      ['tx-para-borrar']
    );
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM transaction_tags WHERE transaction_id = ?;',
      ['tx-para-borrar']
    );
  });
});
