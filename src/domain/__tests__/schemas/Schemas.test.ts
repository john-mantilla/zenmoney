import { describe, it, expect } from 'vitest';
import {
  CreateTransactionSchema,
  CreateAccountSchema,
  CreateBudgetSchema,
  CreateRecurringRuleSchema,
  CreateSavingsGoalSchema,
} from '../../schemas';

describe('Zod Domain Schemas — Runtime Validation & Sanitization', () => {

  describe('CreateTransactionSchema', () => {
    it('valida exitosamente un payload de transacción correcto', () => {
      const validPayload = {
        accountId: 'acc-1',
        categoryId: 'cat-groceries',
        type: 'expense',
        amount: 150.75,
        transactionDate: '2026-07-28',
      };

      const result = CreateTransactionSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(150.75);
        expect(result.data.status).toBe('confirmed'); // default
      }
    });

    it('rechaza montos menores o iguales a cero (amount <= 0)', () => {
      const result = CreateTransactionSchema.safeParse({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: 'expense',
        amount: -50,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.issues.map((e) => e.message);
        expect(errorMessages).toContain('El monto de la transacción debe ser mayor a cero.');
      }
    });

    it('rechaza gastos o ingresos sin categoría', () => {
      const result = CreateTransactionSchema.safeParse({
        accountId: 'acc-1',
        categoryId: null,
        type: 'expense',
        amount: 100,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.issues.map((e) => e.message);
        expect(errorMessages).toContain('Las transacciones de ingreso o gasto requieren una categoría.');
      }
    });

    it('rechaza transferencias sin cuenta de destino o hacia la misma cuenta de origen', () => {
      const missingTarget = CreateTransactionSchema.safeParse({
        accountId: 'acc-1',
        type: 'transfer',
        amount: 100,
        transferToAccountId: null,
      });
      expect(missingTarget.success).toBe(false);

      const sameAccount = CreateTransactionSchema.safeParse({
        accountId: 'acc-1',
        type: 'transfer',
        amount: 100,
        transferToAccountId: 'acc-1',
      });
      expect(sameAccount.success).toBe(false);
      if (!sameAccount.success) {
        const msgs = sameAccount.error.issues.map((e) => e.message);
        expect(msgs).toContain('La cuenta de destino no puede ser la misma cuenta de origen.');
      }
    });
  });

  describe('CreateAccountSchema', () => {
    it('valida exitosamente cuentas de banco o tarjetas de crédito con días válidos (1-31)', () => {
      const result = CreateAccountSchema.safeParse({
        name: 'Tarjeta Visa Gold',
        type: 'credit_card',
        initialBalance: 0,
        closingDay: 15,
        paymentDay: 5,
      });

      expect(result.success).toBe(true);
    });

    it('rechaza días de pago o cierre fuera del rango 1-31', () => {
      const invalidClosing = CreateAccountSchema.safeParse({
        name: 'Tarjeta Visa',
        type: 'credit_card',
        initialBalance: 0,
        closingDay: 35, // Inválido
      });

      expect(invalidClosing.success).toBe(false);
    });
  });

  describe('CreateBudgetSchema', () => {
    it('valida presupuestos con límite positivo y meses entre 1 y 12', () => {
      const valid = CreateBudgetSchema.safeParse({
        categoryId: 'cat-food',
        amountLimit: 500,
        year: 2026,
        month: 7,
      });
      expect(valid.success).toBe(true);

      const invalidMonth = CreateBudgetSchema.safeParse({
        categoryId: 'cat-food',
        amountLimit: 500,
        year: 2026,
        month: 13, // Inválido
      });
      expect(invalidMonth.success).toBe(false);
    });
  });

  describe('CreateRecurringRuleSchema', () => {
    it('valida frecuencias permitidas y rechaza frecuencias no soportadas', () => {
      const valid = CreateRecurringRuleSchema.safeParse({
        accountId: 'acc-1',
        type: 'expense',
        amount: 100,
        frequency: 'monthly',
        dayOfMonth: 10,
        startDate: '2026-01-10',
      });
      expect(valid.success).toBe(true);

      const invalidFreq = CreateRecurringRuleSchema.safeParse({
        accountId: 'acc-1',
        type: 'expense',
        amount: 100,
        frequency: 'unknown_freq',
        startDate: '2026-01-10',
      });
      expect(invalidFreq.success).toBe(false);
    });
  });

  describe('CreateSavingsGoalSchema', () => {
    it('valida metas de ahorro con montos objetivos positivos', () => {
      const valid = CreateSavingsGoalSchema.safeParse({
        name: 'Fondo Emergencia',
        targetAmount: 5000,
        currentAmount: 1000,
        targetDate: '2026-12-31',
      });
      expect(valid.success).toBe(true);

      const negativeTarget = CreateSavingsGoalSchema.safeParse({
        name: 'Fondo Emergencia',
        targetAmount: -100,
        targetDate: '2026-12-31',
      });
      expect(negativeTarget.success).toBe(false);
    });
  });

});
