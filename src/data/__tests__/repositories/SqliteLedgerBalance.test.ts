import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SqliteAccountRepository } from '../../repositories/SqliteAccountRepository';
import { SqliteTransactionRepository } from '../../repositories/SqliteTransactionRepository';
import { LocalDatabase } from '../../local/LocalDatabase';

// Mock de LocalDatabase
vi.mock('../../local/LocalDatabase', () => ({
  LocalDatabase: {
    getDb: vi.fn(),
  },
}));

describe('Ledger Atómico de Saldo (current_balance) en SQLite', () => {
  let accountRepo: SqliteAccountRepository;
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
      getAllAsync: vi.fn(),
      runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
    };
    (LocalDatabase.getDb as any).mockReturnValue(mockDb);
    accountRepo = new SqliteAccountRepository();
    transactionRepo = new SqliteTransactionRepository();
  });

  describe('SqliteAccountRepository.recalculateBalance', () => {
    it('calcula y actualiza el saldo de una cuenta estándar (banco/efectivo) mediante agregación nativa SQL', async () => {
      // 1. Lectura de cuenta bancaria con saldo inicial de $1000
      mockDb.getFirstAsync.mockResolvedValueOnce({
        id: 'acc-bank',
        type: 'bank',
        initial_balance: 1000,
      });

      // 2. Resultado de la agregación nativa SQL en SQLite (+500 -200 -150 +50 = +200 delta)
      mockDb.getFirstAsync.mockResolvedValueOnce({
        delta: 200,
      });

      const newBalance = await accountRepo.recalculateBalance('acc-bank');

      // 1000 + 200 = 1200
      expect(newBalance).toBe(1200);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'UPDATE accounts SET current_balance = ? WHERE id = ?;',
        [1200, 'acc-bank']
      );
    });

    it('calcula y actualiza el saldo para una tarjeta de crédito (deuda acumulada) mediante agregación nativa SQL', async () => {
      // 1. Tarjeta de crédito con deuda inicial de $0
      mockDb.getFirstAsync.mockResolvedValueOnce({
        id: 'acc-card',
        type: 'credit_card',
        initial_balance: 0,
      });

      // 2. Agregación nativa: gasto 300, abono 50, pago transfer 100 -> delta de deuda = +150
      mockDb.getFirstAsync.mockResolvedValueOnce({
        delta: 150,
      });

      const newBalance = await accountRepo.recalculateBalance('acc-card');

      // 0 + 150 = 150
      expect(newBalance).toBe(150);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'UPDATE accounts SET current_balance = ? WHERE id = ?;',
        [150, 'acc-card']
      );
    });
  });

  describe('SqliteAccountRepository.adjustBalance O(1)', () => {
    it('ajusta el saldo consolidado aritméticamente en O(1) sin consultar historial', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({
        id: 'acc-1',
        current_balance: 500_000,
        initial_balance: 100_000,
      });

      const adjusted = await accountRepo.adjustBalance('acc-1', -50_000);

      expect(adjusted).toBe(450_000);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'UPDATE accounts SET current_balance = ? WHERE id = ?;',
        [450_000, 'acc-1']
      );
    });
  });

  describe('SqliteTransactionRepository y reconciliación automática', () => {
    it('al crear una transacción confirmada, recalcula el saldo de la cuenta automáticamente', async () => {
      const recalculateSpy = vi.spyOn(SqliteAccountRepository.prototype, 'recalculateBalances').mockResolvedValue();

      await transactionRepo.create({
        accountId: 'acc-1',
        amount: 80,
        type: 'expense',
        status: 'confirmed',
        currency: 'COP',
      });

      expect(recalculateSpy).toHaveBeenCalledWith(['acc-1']);
      recalculateSpy.mockRestore();
    });

    it('al crear una transferencia confirmada, recalcula el saldo tanto del origen como del destino', async () => {
      const recalculateSpy = vi.spyOn(SqliteAccountRepository.prototype, 'recalculateBalances').mockResolvedValue();

      await transactionRepo.create({
        accountId: 'acc-source',
        transferToAccountId: 'acc-dest',
        amount: 250,
        type: 'transfer',
        status: 'confirmed',
        currency: 'COP',
      });

      expect(recalculateSpy).toHaveBeenCalledWith(['acc-source', 'acc-dest']);
      recalculateSpy.mockRestore();
    });

    it('no recalcula saldos si la transacción creada está en estado pending', async () => {
      const recalculateSpy = vi.spyOn(SqliteAccountRepository.prototype, 'recalculateBalances').mockResolvedValue();

      await transactionRepo.create({
        accountId: 'acc-1',
        amount: 80,
        type: 'expense',
        status: 'pending',
        currency: 'COP',
      });

      expect(recalculateSpy).not.toHaveBeenCalled();
      recalculateSpy.mockRestore();
    });

    it('al eliminar una transacción confirmada, recalcula el saldo de las cuentas afectadas', async () => {
      const recalculateSpy = vi.spyOn(SqliteAccountRepository.prototype, 'recalculateBalances').mockResolvedValue();

      mockDb.getFirstAsync.mockResolvedValueOnce({
        id: 'tx-delete',
        family_group_id: 'fam-1',
        account_id: 'acc-1',
        category_id: null,
        created_by_user_id: 'usr-1',
        type: 'expense',
        amount: 50,
        currency: 'COP',
        description: null,
        merchant_name: null,
        transaction_date: '2026-10-24',
        transfer_to_account_id: null,
        is_recurring_instance: 0,
        recurring_rule_id: null,
        status: 'confirmed',
        input_method: 'manual',
        ai_metadata: null,
        is_private: 0,
        created_at: '2026-10-24T00:00:00Z',
        updated_at: '2026-10-24T00:00:00Z',
        synced: 1,
      });

      await transactionRepo.delete('tx-delete');

      expect(recalculateSpy).toHaveBeenCalledWith(['acc-1']);
      recalculateSpy.mockRestore();
    });
  });
});
