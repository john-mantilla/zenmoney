import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseTransactionRepository } from '../../repositories/SupabaseTransactionRepository';
import { supabase } from '../../../infrastructure/supabase/client';

// Mock de Supabase client
vi.mock('../../../infrastructure/supabase/client', () => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  };
  return { supabase: mockSupabase };
});

describe('SupabaseTransactionRepository — Pruebas de Integración con Mock de Supabase', () => {
  let repository: SupabaseTransactionRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new SupabaseTransactionRepository();
  });

  it('obtiene una transacción por ID a través de Supabase y el Mapper', async () => {
    const mockDbRow = {
      id: 'tx-123',
      family_group_id: 'fam-1',
      account_id: 'acc-1',
      category_id: 'cat-1',
      created_by_user_id: 'usr-1',
      type: 'expense',
      amount: '75.00',
      currency: 'USD',
      description: 'Cena',
      merchant_name: 'Restaurante',
      transaction_date: '2026-07-28',
      transfer_to_account_id: null,
      is_recurring_instance: false,
      recurring_rule_id: null,
      status: 'confirmed',
      input_method: 'manual',
      is_private: false,
      created_at: '2026-07-28T10:00:00Z',
    };

    const mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockDbRow, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQueryBuilder);

    const tx = await repository.getById('tx-123');

    expect(supabase.from).toHaveBeenCalledWith('transactions');
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'tx-123');
    expect(tx).not.toBeNull();
    expect(tx?.id).toBe('tx-123');
    expect(tx?.amount).toBe(75);
  });

  it('consulta transacciones aplicando filtros (accountId, status, startDate, endDate)', async () => {
    const mockRows = [
      {
        id: 'tx-1',
        family_group_id: 'fam-1',
        account_id: 'acc-1',
        type: 'expense',
        amount: '50.00',
        currency: 'USD',
        transaction_date: '2026-07-20',
        status: 'confirmed',
        input_method: 'manual',
      },
    ];

    const mockQueryBuilder: any = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (resolve: any) => resolve({ data: mockRows, error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQueryBuilder);

    const result = await repository.getAll({
      accountId: 'acc-1',
      status: 'confirmed',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    });

    expect(supabase.from).toHaveBeenCalledWith('transactions');
    expect(mockQueryBuilder.or).toHaveBeenCalledWith('account_id.eq.acc-1,transfer_to_account_id.eq.acc-1');
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('status', 'confirmed');
    expect(mockQueryBuilder.gte).toHaveBeenCalledWith('transaction_date', '2026-07-01');
    expect(mockQueryBuilder.lte).toHaveBeenCalledWith('transaction_date', '2026-07-31');
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(50);
  });

  it('crea una transacción adjuntando el perfil familiar del usuario autenticado', async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: 'auth-user-99' } },
    });

    const mockProfileBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { family_group_id: 'fam-group-7', id: 'profile-usr-7' },
        error: null,
      }),
    };

    const mockInsertedRow = {
      id: 'tx-new-99',
      family_group_id: 'fam-group-7',
      account_id: 'acc-1',
      category_id: 'cat-1',
      created_by_user_id: 'profile-usr-7',
      type: 'expense',
      amount: '120.00',
      currency: 'USD',
      transaction_date: '2026-07-28',
      status: 'confirmed',
      input_method: 'manual',
    };

    const mockInsertBuilder = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockInsertedRow, error: null }),
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'user_profiles') return mockProfileBuilder;
      if (table === 'transactions') return mockInsertBuilder;
      return {};
    });

    const created = await repository.create({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: 'expense',
      amount: 120,
    });

    expect(supabase.auth.getUser).toHaveBeenCalled();
    expect(created.id).toBe('tx-new-99');
    expect(created.familyGroupId).toBe('fam-group-7');
    expect(created.createdByUserId).toBe('profile-usr-7');
    expect(created.amount).toBe(120);
  });
});
