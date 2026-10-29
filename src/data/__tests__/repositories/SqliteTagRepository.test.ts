import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SqliteTagRepository } from '../../repositories/SqliteTagRepository';
import { LocalDatabase } from '../../local/LocalDatabase';

vi.mock('../../local/LocalDatabase', () => ({
  LocalDatabase: {
    getDb: vi.fn(),
  },
}));

describe('SqliteTagRepository — Deduplicación y Prevención de Duplicados', () => {
  let tagRepo: SqliteTagRepository;
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
    tagRepo = new SqliteTagRepository();
  });

  it('no crea una etiqueta duplicada si ya existe una con el mismo nombre (insensible a mayúsculas)', async () => {
    // Simular que ya existe la etiqueta 'Trabajo'
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 'tag-trabajo-1',
      family_group_id: 'fam-1',
      name: 'Trabajo',
      color: '#2196F3',
      created_at: '2026-10-01T10:00:00Z',
    });

    const result = await tagRepo.create({
      name: '  trabajo  ',
      color: '#FF9800',
    });

    // Debe devolver la existente sin insertar una nueva
    expect(result.id).toBe('tag-trabajo-1');
    expect(result.name).toBe('Trabajo');
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('crea una nueva etiqueta si no existe previamente', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null);

    const result = await tagRepo.create({
      name: 'Vacaciones',
      color: '#4CAF50',
    });

    expect(result.name).toBe('Vacaciones');
    expect(result.color).toBe('#4CAF50');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO tags'),
      expect.arrayContaining(['Vacaciones', '#4CAF50'])
    );
  });

  it('deduplicateTags consolida tags duplicados existentes y reasigna transaction_tags', async () => {
    // Simular dos tags llamadas 'Trabajo'
    mockDb.getAllAsync.mockResolvedValueOnce([
      {
        id: 'canonical-tag',
        family_group_id: 'fam-1',
        name: 'Trabajo',
        color: '#2196F3',
        created_at: '2026-10-01T10:00:00Z',
      },
      {
        id: 'duplicate-tag',
        family_group_id: 'fam-1',
        name: 'trabajo',
        color: '#808080',
        created_at: '2026-10-15T12:00:00Z',
      },
    ]);

    await tagRepo.deduplicateTags();

    // 1. Reasigna las transacciones de duplicate-tag al canonical-tag
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO transaction_tags'),
      ['canonical-tag', 'duplicate-tag']
    );

    // 2. Elimina las relaciones viejas del duplicate-tag
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM transaction_tags WHERE tag_id = ?;',
      ['duplicate-tag']
    );

    // 3. Elimina el tag duplicado de tags
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM tags WHERE id = ?;',
      ['duplicate-tag']
    );
  });

  it('delete elimina la etiqueta y sus asociaciones en transaction_tags', async () => {
    await tagRepo.delete('tag-to-delete');

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM tags WHERE id = ?;',
      ['tag-to-delete']
    );
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM transaction_tags WHERE tag_id = ?;',
      ['tag-to-delete']
    );
  });
});
