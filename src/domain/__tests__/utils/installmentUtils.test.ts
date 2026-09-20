/**
 * ZenMoney — Pruebas: installmentUtils
 */
import { describe, it, expect } from 'vitest';
import { calculateInstallmentDate, generateInstallmentTransactions } from '../../utils/installmentUtils';
import { CreateTransactionInput } from '../../entities/Transaction';

describe('installmentUtils — calculateInstallmentDate', () => {
  it('desplaza meses estándar correctamente', () => {
    expect(calculateInstallmentDate('2026-09-20', 0)).toBe('2026-09-20');
    expect(calculateInstallmentDate('2026-09-20', 1)).toBe('2026-10-20');
    expect(calculateInstallmentDate('2026-09-20', 2)).toBe('2026-11-20');
    expect(calculateInstallmentDate('2026-09-20', 3)).toBe('2026-12-20');
    expect(calculateInstallmentDate('2026-09-20', 4)).toBe('2027-01-20');
  });

  it('ajusta adecuadamente días de fin de mes cuando el mes destino tiene menos días', () => {
    // 31 de Enero -> Febrero (28 días en 2026)
    expect(calculateInstallmentDate('2026-01-31', 1)).toBe('2026-02-28');
    // 31 de Enero -> Abril (30 días)
    expect(calculateInstallmentDate('2026-01-31', 3)).toBe('2026-04-30');
    // 31 de Marzo -> Abril (30 días)
    expect(calculateInstallmentDate('2026-03-31', 1)).toBe('2026-04-30');
  });

  it('maneja cambios de año correctamente', () => {
    expect(calculateInstallmentDate('2026-11-15', 2)).toBe('2027-01-15');
    expect(calculateInstallmentDate('2026-12-10', 1)).toBe('2027-01-10');
    expect(calculateInstallmentDate('2026-12-10', 12)).toBe('2027-12-10');
    expect(calculateInstallmentDate('2026-12-10', 14)).toBe('2028-02-10');
  });
});

describe('installmentUtils — generateInstallmentTransactions', () => {
  const baseInput: CreateTransactionInput = {
    accountId: 'acc-credit-1',
    categoryId: 'cat-home',
    type: 'expense',
    amount: 120000,
    description: 'Compra Falabella',
    transactionDate: '2026-09-20',
  };

  it('si count es 1 o menor, devuelve la transacción base sin cambios', () => {
    const res = generateInstallmentTransactions(baseInput, 1);
    expect(res).toHaveLength(1);
    expect(res[0].amount).toBe(120000);
    expect(res[0].description).toBe('Compra Falabella');
  });

  it('divide $120.000 a 3 cuotas exactas de $40.000 en Sep, Oct, Nov', () => {
    const cuotas = generateInstallmentTransactions(baseInput, 3, 'test-group-id');
    expect(cuotas).toHaveLength(3);

    expect(cuotas[0].amount).toBe(40000);
    expect(cuotas[0].transactionDate).toBe('2026-09-20');
    expect(cuotas[0].description).toBe('Compra Falabella (Cuota 1/3)');
    expect(cuotas[0].aiMetadata?.installments?.groupId).toBe('test-group-id');
    expect(cuotas[0].aiMetadata?.installments?.currentNumber).toBe(1);
    expect(cuotas[0].aiMetadata?.installments?.count).toBe(3);

    expect(cuotas[1].amount).toBe(40000);
    expect(cuotas[1].transactionDate).toBe('2026-10-20');
    expect(cuotas[1].description).toBe('Compra Falabella (Cuota 2/3)');
    expect(cuotas[1].aiMetadata?.installments?.currentNumber).toBe(2);

    expect(cuotas[2].amount).toBe(40000);
    expect(cuotas[2].transactionDate).toBe('2026-11-20');
    expect(cuotas[2].description).toBe('Compra Falabella (Cuota 3/3)');
    expect(cuotas[2].aiMetadata?.installments?.currentNumber).toBe(3);

    // Sumatoria total exacta
    const sum = cuotas.reduce((acc, c) => acc + c.amount, 0);
    expect(sum).toBe(120000);
  });

  it('maneja divisiones con residuo asignándolo a la primera cuota', () => {
    // 100.000 / 3 = 33.333 residuo 1 -> Cuota 1: 33.334, Cuota 2: 33.333, Cuota 3: 33.333
    const inputWithRemainder: CreateTransactionInput = {
      ...baseInput,
      amount: 100000,
    };
    const cuotas = generateInstallmentTransactions(inputWithRemainder, 3);
    expect(cuotas).toHaveLength(3);
    expect(cuotas[0].amount).toBe(33334);
    expect(cuotas[1].amount).toBe(33333);
    expect(cuotas[2].amount).toBe(33333);

    const sum = cuotas.reduce((acc, c) => acc + c.amount, 0);
    expect(sum).toBe(100000);
  });
});
