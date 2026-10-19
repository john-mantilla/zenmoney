import { describe, it, expect } from 'vitest';
import { ValidateTransaction } from '../../usecases/ValidateTransaction';
import { CreateTransactionInput } from '../../entities/Transaction';
import { Account } from '../../entities/Account';

const activeAccounts: Account[] = [
  {
    id: 'acc-1',
    familyGroupId: 'fam-1',
    ownerUserId: 'usr-1',
    name: 'Banco',
    type: 'bank',
    initialBalance: 1000,
    currency: 'USD',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'acc-2',
    familyGroupId: 'fam-1',
    ownerUserId: 'usr-1',
    name: 'Efectivo',
    type: 'cash',
    initialBalance: 500,
    currency: 'USD',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'acc-inactive',
    familyGroupId: 'fam-1',
    ownerUserId: 'usr-1',
    name: 'Cuenta Inactiva',
    type: 'bank',
    initialBalance: 0,
    currency: 'USD',
    isActive: false,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

describe('ValidateTransaction', () => {
  const validator = new ValidateTransaction();

  it('valida exitosamente una transacción válida', () => {
    const input: CreateTransactionInput = {
      accountId: 'acc-1',
      categoryId: 'cat-groceries',
      type: 'expense',
      amount: 50,
      transactionDate: '2026-07-28',
    };

    const result = validator.execute(input, activeAccounts);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rechaza montos menores o iguales a cero', () => {
    const input: CreateTransactionInput = {
      accountId: 'acc-1',
      categoryId: 'cat-food',
      type: 'expense',
      amount: -10,
      transactionDate: '2026-07-28',
    };

    const result = validator.execute(input, activeAccounts);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('El monto de la transacción debe ser mayor a cero.');
  });

  it('rechaza cuentas inactivas o inexistentes', () => {
    const input: CreateTransactionInput = {
      accountId: 'acc-inactive',
      categoryId: 'cat-food',
      type: 'expense',
      amount: 100,
    };

    const result = validator.execute(input, activeAccounts);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('La cuenta seleccionada no existe o no está activa.');
  });

  it('exige categoría para ingresos o gastos', () => {
    const input: CreateTransactionInput = {
      accountId: 'acc-1',
      categoryId: null,
      type: 'expense',
      amount: 50,
    };

    const result = validator.execute(input, activeAccounts);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Las transacciones de ingreso o gasto requieren una categoría.');
  });

  it('valida reglas específicas de transferencias', () => {
    // 1. Misma cuenta origen y destino
    const resultSame = validator.execute(
      { accountId: 'acc-1', categoryId: null, type: 'transfer', amount: 50, transferToAccountId: 'acc-1' },
      activeAccounts
    );
    expect(resultSame.isValid).toBe(false);
    expect(resultSame.errors).toContain('La cuenta de destino no puede ser la misma cuenta de origen.');

    // 2. Destino inactivo
    const resultInactive = validator.execute(
      { accountId: 'acc-1', categoryId: null, type: 'transfer', amount: 50, transferToAccountId: 'acc-inactive' },
      activeAccounts
    );
    expect(resultInactive.isValid).toBe(false);
    expect(resultInactive.errors).toContain('La cuenta de destino no existe o no está activa.');
  });

  describe('Category Split (Desglose Multicategoría)', () => {
    it('valida exitosamente una transacción con desglose de categorías exacto', () => {
      const input: CreateTransactionInput = {
        accountId: 'acc-1',
        categoryId: 'cat-groceries',
        type: 'expense',
        amount: 300000,
        transactionDate: '2026-10-19',
        splits: [
          { id: 's1', categoryId: 'cat-market', amount: 200000 },
          { id: 's2', categoryId: 'cat-home', amount: 60000 },
          { id: 's3', categoryId: 'cat-pets', amount: 40000 },
        ],
      };

      const result = validator.execute(input, activeAccounts);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rechaza cuando la suma de los desgloses es menor al monto total (falta dinero)', () => {
      const input: CreateTransactionInput = {
        accountId: 'acc-1',
        categoryId: 'cat-groceries',
        type: 'expense',
        amount: 150000,
        splits: [
          { id: 's1', categoryId: 'cat-market', amount: 100000 },
          { id: 's2', categoryId: 'cat-home', amount: 40000 },
        ],
      };

      const result = validator.execute(input, activeAccounts);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(err => err.includes('Faltan $10000 por asignar') || err.includes('La suma de las categorías'))).toBe(true);
    });

    it('rechaza cuando la suma de los desgloses supera el monto total (excedente)', () => {
      const input: CreateTransactionInput = {
        accountId: 'acc-1',
        categoryId: 'cat-groceries',
        type: 'expense',
        amount: 100000,
        splits: [
          { id: 's1', categoryId: 'cat-market', amount: 70000 },
          { id: 's2', categoryId: 'cat-home', amount: 50000 },
        ],
      };

      const result = validator.execute(input, activeAccounts);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(err => err.includes('supera el total') || err.includes('La suma de las categorías'))).toBe(true);
    });

    it('rechaza cuando un desglose tiene monto menor o igual a cero', () => {
      const input: CreateTransactionInput = {
        accountId: 'acc-1',
        categoryId: 'cat-groceries',
        type: 'expense',
        amount: 100,
        splits: [
          { id: 's1', categoryId: 'cat-market', amount: 100 },
          { id: 's2', categoryId: 'cat-home', amount: 0 },
        ],
      };

      const result = validator.execute(input, activeAccounts);
      expect(result.isValid).toBe(false);
    });

    it('permite omitir categoryId raíz si se proporcionan splits válidos', () => {
      const input: CreateTransactionInput = {
        accountId: 'acc-1',
        categoryId: null,
        type: 'expense',
        amount: 100,
        splits: [
          { id: 's1', categoryId: 'cat-market', amount: 60 },
          { id: 's2', categoryId: 'cat-home', amount: 40 },
        ],
      };

      const result = validator.execute(input, activeAccounts);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Period Split (Prorrateo Temporal)', () => {
    it('valida exitosamente prorrateos válidos entre 2 y 36 meses', () => {
      const input: CreateTransactionInput = {
        accountId: 'acc-1',
        categoryId: 'cat-insurance',
        type: 'expense',
        amount: 1200000,
        transactionDate: '2026-01-15',
        periodSplit: {
          totalMonths: 12,
          monthlyAmount: 100000,
          startMonth: '2026-01',
          endMonth: '2026-12',
          accountFlowDate: '2026-01-15',
        },
      };

      const result = validator.execute(input, activeAccounts);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rechaza prorrateo con menos de 2 meses o más de 36 meses', () => {
      const inputLess: CreateTransactionInput = {
        accountId: 'acc-1',
        categoryId: 'cat-insurance',
        type: 'expense',
        amount: 100000,
        periodSplit: {
          totalMonths: 1,
          monthlyAmount: 100000,
          startMonth: '2026-01',
          endMonth: '2026-01',
          accountFlowDate: '2026-01-15',
        },
      };

      const resultLess = validator.execute(inputLess, activeAccounts);
      expect(resultLess.isValid).toBe(false);
      expect(resultLess.errors.some(e => e.includes('2 y 36 meses') || e.includes('mínimo 2 meses'))).toBe(true);

      const inputMore: CreateTransactionInput = {
        accountId: 'acc-1',
        categoryId: 'cat-insurance',
        type: 'expense',
        amount: 3700000,
        periodSplit: {
          totalMonths: 37,
          monthlyAmount: 100000,
          startMonth: '2026-01',
          endMonth: '2029-01',
          accountFlowDate: '2026-01-15',
        },
      };

      const resultMore = validator.execute(inputMore, activeAccounts);
      expect(resultMore.isValid).toBe(false);
      expect(resultMore.errors.some(e => e.includes('2 y 36 meses') || e.includes('exceder 36 meses'))).toBe(true);
    });
  });
});
