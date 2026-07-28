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
});
