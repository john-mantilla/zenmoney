/**
 * ZenMoney — Pruebas: CalculateAccountBalance
 */
import { describe, it, expect } from 'vitest';
import { CalculateAccountBalance } from '../../usecases/CalculateAccountBalance';
import { Account } from '../../entities/Account';
import { Transaction } from '../../entities/Transaction';
import { TransactionRepository, TransactionFilters } from '../../repositories/TransactionRepository';

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-1',
    familyGroupId: 'fam-1',
    ownerUserId: 'user-1',
    name: 'Cuenta de prueba',
    type: 'bank',
    initialBalance: 100000,
    currency: 'COP',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    familyGroupId: 'fam-1',
    accountId: 'acc-1',
    categoryId: null,
    createdByUserId: 'user-1',
    type: 'expense',
    amount: 20000,
    currency: 'COP',
    description: null,
    merchantName: null,
    transactionDate: '2026-01-05',
    transferToAccountId: null,
    isRecurringInstance: false,
    recurringRuleId: null,
    status: 'confirmed',
    inputMethod: 'manual',
    aiMetadata: null,
    isPrivate: false,
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
    syncedAt: null,
    ...overrides,
  };
}

class FakeTransactionRepository implements TransactionRepository {
  constructor(private all: Transaction[]) {}

  async getAll(filters?: TransactionFilters): Promise<Transaction[]> {
    let result = this.all;
    if (filters?.accountId) {
      result = result.filter(
        (t) => t.accountId === filters.accountId || t.transferToAccountId === filters.accountId
      );
    }
    if (filters?.status) {
      result = result.filter((t) => t.status === filters.status);
    }
    return result;
  }

  async getById(): Promise<Transaction | null> {
    throw new Error('not used in these tests');
  }
  async create(): Promise<Transaction> {
    throw new Error('not used in these tests');
  }
  async update(): Promise<Transaction> {
    throw new Error('not used in these tests');
  }
  async delete(): Promise<void> {
    throw new Error('not used in these tests');
  }
  async getByDateRange(): Promise<Transaction[]> {
    throw new Error('not used in these tests');
  }
  async getTotalByType(): Promise<number> {
    throw new Error('not used in these tests');
  }
}

describe('CalculateAccountBalance — cuentas estándar (efectivo/banco/inversión)', () => {
  it('un gasto DISMINUYE el disponible', async () => {
    const account = makeAccount({ type: 'bank', initialBalance: 100000 });
    const repo = new FakeTransactionRepository([
      makeTx({ type: 'expense', amount: 20000, accountId: account.id }),
    ]);
    const balance = await new CalculateAccountBalance(repo).execute(account);
    expect(balance).toBe(80000);
  });

  it('un ingreso AUMENTA el disponible', async () => {
    const account = makeAccount({ type: 'cash', initialBalance: 100000 });
    const repo = new FakeTransactionRepository([
      makeTx({ type: 'income', amount: 50000, accountId: account.id }),
    ]);
    const balance = await new CalculateAccountBalance(repo).execute(account);
    expect(balance).toBe(150000);
  });

  it('una transferencia saliente DISMINUYE el disponible de la cuenta origen', async () => {
    const account = makeAccount({ type: 'bank', initialBalance: 100000 });
    const repo = new FakeTransactionRepository([
      makeTx({ type: 'transfer', amount: 30000, accountId: account.id, transferToAccountId: 'acc-2' }),
    ]);
    const balance = await new CalculateAccountBalance(repo).execute(account);
    expect(balance).toBe(70000);
  });

  it('una transferencia entrante AUMENTA el disponible de la cuenta destino', async () => {
    const account = makeAccount({ id: 'acc-2', type: 'bank', initialBalance: 100000 });
    const repo = new FakeTransactionRepository([
      makeTx({ type: 'transfer', amount: 30000, accountId: 'acc-1', transferToAccountId: 'acc-2' }),
    ]);
    const balance = await new CalculateAccountBalance(repo).execute(account);
    expect(balance).toBe(130000);
  });

  it('las transacciones "pending" NO afectan el saldo, solo las "confirmed"', async () => {
    const account = makeAccount({ type: 'bank', initialBalance: 100000 });
    const repo = new FakeTransactionRepository([
      makeTx({ type: 'expense', amount: 20000, accountId: account.id, status: 'pending' }),
    ]);
    const balance = await new CalculateAccountBalance(repo).execute(account);
    expect(balance).toBe(100000);
  });

  it('gastos consecutivos siguen disminuyendo el disponible', async () => {
    const account = makeAccount({ type: 'cash', initialBalance: 50000 });
    const repo = new FakeTransactionRepository([
      makeTx({ id: 'tx-a', type: 'expense', amount: 20000, accountId: account.id }),
      makeTx({ id: 'tx-b', type: 'expense', amount: 15000, accountId: account.id }),
    ]);
    const balance = await new CalculateAccountBalance(repo).execute(account);
    expect(balance).toBe(15000);
  });
});

describe('CalculateAccountBalance — cuentas de deuda (tarjeta de crédito/crédito/hipoteca)', () => {
  it('un gasto con la tarjeta AUMENTA la deuda', async () => {
    const account = makeAccount({ type: 'credit_card', initialBalance: 0 });
    const repo = new FakeTransactionRepository([
      makeTx({ type: 'expense', amount: 20000, accountId: account.id }),
    ]);
    const balance = await new CalculateAccountBalance(repo).execute(account);
    expect(balance).toBe(20000);
  });

  it('un pago a la tarjeta (income) DISMINUYE la deuda', async () => {
    const account = makeAccount({ type: 'credit_card', initialBalance: 50000 });
    const repo = new FakeTransactionRepository([
      makeTx({ type: 'income', amount: 20000, accountId: account.id }),
    ]);
    const balance = await new CalculateAccountBalance(repo).execute(account);
    expect(balance).toBe(30000);
  });

  it('un abono transferido a la tarjeta DISMINUYE la deuda', async () => {
    const card = makeAccount({ id: 'card-1', type: 'credit_card', initialBalance: 50000 });
    const repo = new FakeTransactionRepository([
      makeTx({ type: 'transfer', amount: 20000, accountId: 'acc-1', transferToAccountId: 'card-1' }),
    ]);
    const balance = await new CalculateAccountBalance(repo).execute(card);
    expect(balance).toBe(30000);
  });

  it('un avance de efectivo desde la tarjeta AUMENTA la deuda', async () => {
    const card = makeAccount({ id: 'card-1', type: 'credit_card', initialBalance: 50000 });
    const repo = new FakeTransactionRepository([
      makeTx({ type: 'transfer', amount: 10000, accountId: 'card-1', transferToAccountId: 'acc-2' }),
    ]);
    const balance = await new CalculateAccountBalance(repo).execute(card);
    expect(balance).toBe(60000);
  });
});
