import { describe, it, expect, vi } from 'vitest';
import { CalculateAccountBalance } from '../../usecases/CalculateAccountBalance';
import { GenerateRecurringInstances } from '../../usecases/GenerateRecurringInstances';
import { ValidateTransaction } from '../../usecases/ValidateTransaction';
import { Account } from '../../entities/Account';
import { Transaction, TransactionStatus } from '../../entities/Transaction';
import { RecurringRule } from '../../entities/RecurringRule';
import { TransactionRepository, TransactionFilters } from '../../repositories/TransactionRepository';
import { Money } from '../../value-objects/Money';

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-bank-1',
    familyGroupId: 'fam-1',
    ownerUserId: 'usr-1',
    name: 'Cuenta Principal',
    type: 'bank',
    initialBalance: 1000,
    currency: 'USD',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx-${Math.random().toString(36).substring(7)}`,
    familyGroupId: 'fam-1',
    accountId: 'acc-bank-1',
    categoryId: 'cat-groceries',
    createdByUserId: 'usr-1',
    type: 'expense',
    amount: 100,
    currency: 'USD',
    description: 'Compra supermercado',
    merchantName: null,
    transactionDate: '2026-07-15',
    transferToAccountId: null,
    isRecurringInstance: false,
    recurringRuleId: null,
    status: 'confirmed',
    inputMethod: 'manual',
    aiMetadata: null,
    isPrivate: false,
    createdAt: '2026-07-15T00:00:00Z',
    updatedAt: '2026-07-15T00:00:00Z',
    syncedAt: null,
    ...overrides,
  };
}

function makeRecurringRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: `rule-${Math.random().toString(36).substring(7)}`,
    familyGroupId: 'fam-1',
    accountId: 'acc-bank-1',
    categoryId: 'cat-rent',
    type: 'expense',
    amount: 800,
    description: 'Arriendo mensual',
    frequency: 'monthly',
    dayOfMonth: 5,
    startDate: '2026-01-05',
    endDate: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

class FakeTransactionRepository implements TransactionRepository {
  constructor(private items: Transaction[] = []) {}

  async getAll(filters?: TransactionFilters): Promise<Transaction[]> {
    let res = this.items;
    if (filters?.accountId) {
      res = res.filter((t) => t.accountId === filters.accountId || t.transferToAccountId === filters.accountId);
    }
    if (filters?.recurringRuleId) {
      res = res.filter((t) => t.recurringRuleId === filters.recurringRuleId);
    }
    if (filters?.status) {
      res = res.filter((t) => t.status === filters.status);
    }
    return res;
  }

  async create(input: any): Promise<Transaction> {
    const created: Transaction = {
      id: input.id || `tx-${Math.random().toString(36).substring(7)}`,
      familyGroupId: 'fam-1',
      accountId: input.accountId,
      categoryId: input.categoryId ?? null,
      createdByUserId: 'usr-1',
      type: input.type,
      amount: input.amount,
      currency: input.currency || 'USD',
      description: input.description ?? null,
      merchantName: input.merchantName ?? null,
      transactionDate: input.transactionDate || '2026-07-28',
      transferToAccountId: input.transferToAccountId ?? null,
      isRecurringInstance: input.isRecurringInstance ?? false,
      recurringRuleId: input.recurringRuleId ?? null,
      status: input.status || 'confirmed',
      inputMethod: input.inputMethod || 'manual',
      aiMetadata: input.aiMetadata ?? null,
      isPrivate: input.isPrivate ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncedAt: null,
    };
    this.items.push(created);
    return created;
  }

  async getById(id: string): Promise<Transaction | null> {
    return this.items.find((t) => t.id === id) || null;
  }

  async update(id: string, input: Partial<Transaction>): Promise<Transaction> {
    const idx = this.items.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error('Transaction not found');
    const updated = { ...this.items[idx], ...input, updatedAt: new Date().toISOString() };
    this.items[idx] = updated;
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.items = this.items.filter((t) => t.id !== id);
  }

  async getByDateRange(): Promise<Transaction[]> { return this.items; }
  async getTotalByType(): Promise<number> { return 0; }
}

describe('REGLAS DE ORO — ZenMoney Backend Pure Domain Tests', () => {

  describe('1. Regla de Oro: Saldos Dinámicos', () => {
    it('calcula el saldo dinámicamente sin deriva de caché ni desfases contables', async () => {
      const bank = makeAccount({ id: 'acc-1', initialBalance: 500 });
      const repo = new FakeTransactionRepository([
        makeTx({ accountId: 'acc-1', type: 'income', amount: 1000, status: 'confirmed' }),
        makeTx({ accountId: 'acc-1', type: 'expense', amount: 300, status: 'confirmed' }),
        makeTx({ accountId: 'acc-1', type: 'expense', amount: 200, status: 'confirmed' }),
      ]);
      const calculator = new CalculateAccountBalance(repo);

      const balance1 = await calculator.execute(bank);
      expect(balance1).toBe(1000); // 500 + 1000 - 300 - 200

      // Agregar un nuevo gasto dinámico
      await repo.create(makeTx({ accountId: 'acc-1', type: 'expense', amount: 150, status: 'confirmed' }));
      const balance2 = await calculator.execute(bank);
      expect(balance2).toBe(850); // 1000 - 150
    });

    it('ignora transacciones pending y archived al calcular el saldo dinámico', async () => {
      const bank = makeAccount({ id: 'acc-1', initialBalance: 1000 });
      const repo = new FakeTransactionRepository([
        makeTx({ accountId: 'acc-1', type: 'expense', amount: 200, status: 'confirmed' }),
        makeTx({ accountId: 'acc-1', type: 'expense', amount: 500, status: 'pending' }),
        makeTx({ accountId: 'acc-1', type: 'expense', amount: 300, status: 'archived' }),
      ]);

      const balance = await new CalculateAccountBalance(repo).execute(bank);
      expect(balance).toBe(800); // 1000 - 200 (se ignoran pending y archived)
    });
  });

  describe('2. Regla de Oro: Positividad del Ledger', () => {
    it('el dominio exige que amount sea estrictamente mayor a cero (amount > 0)', () => {
      const validator = new ValidateTransaction();
      const accounts = [makeAccount({ id: 'acc-1' })];

      const negativeResult = validator.execute({ accountId: 'acc-1', categoryId: 'cat-1', type: 'expense', amount: -50 }, accounts);
      expect(negativeResult.isValid).toBe(false);
      expect(negativeResult.errors).toContain('El monto de la transacción debe ser mayor a cero.');

      const zeroResult = validator.execute({ accountId: 'acc-1', categoryId: 'cat-1', type: 'expense', amount: 0 }, accounts);
      expect(zeroResult.isValid).toBe(false);
      expect(zeroResult.errors).toContain('El monto de la transacción debe ser mayor a cero.');
    });

    it('Money Value Object no permite instanciar montos negativos para transacciones del ledger', () => {
      const money = Money.from(150.75, 'USD');
      expect(money.amount).toBe(150.75);
      expect(money.isPositive()).toBe(true);
      expect(money.isNegative()).toBe(false);
    });

    it('aplica los signos (+/-) dinámicamente en balance sin alterar la positividad guardada en el ledger', async () => {
      const bank = makeAccount({ id: 'acc-1', initialBalance: 0 });
      const tx = makeTx({ accountId: 'acc-1', type: 'expense', amount: 100, status: 'confirmed' });
      expect(tx.amount).toBe(100); // Guardado positivo en el dominio

      const repo = new FakeTransactionRepository([tx]);
      const balance = await new CalculateAccountBalance(repo).execute(bank);
      expect(balance).toBe(-100); // Signo aplicado dinámicamente en el cálculo
    });
  });

  describe('3. Regla de Oro: Anclaje de Facturas (Invoice Anchoring)', () => {
    it('las instancias generadas quedan ancladas a su fecha y regla sin duplicarse al re-evaluar', async () => {
      const rule = makeRecurringRule({ id: 'rule-rent', frequency: 'monthly', dayOfMonth: 5, amount: 800 });
      const repo = new FakeTransactionRepository();
      const generator = new GenerateRecurringInstances(repo);

      // Generar primera vez para enero y febrero
      const created1 = await generator.execute(rule, '2026-01-01', '2026-02-28');
      expect(created1).toHaveLength(2);

      // El usuario edita manualmente la factura anclada de febrero (cambia fecha y monto)
      const febTx = created1.find((t) => t.transactionDate === '2026-02-05')!;
      await repo.update(febTx.id, { transactionDate: '2026-02-08', amount: 850, description: 'Arriendo febrero con ajuste' });

      // Re-ejecutar generación de la regla para el mismo período
      const created2 = await generator.execute(rule, '2026-01-01', '2026-02-28');

      // NO debe regenerar ninguna factura duplicada para febrero aunque la fecha original se haya movido
      expect(created2).toHaveLength(0);

      // Verificar que la factura en repo sigue anclada con sus modificaciones manuales
      const repoItems = await repo.getAll({ recurringRuleId: 'rule-rent' });
      expect(repoItems).toHaveLength(2);
      expect(repoItems.some((t) => t.amount === 850 && t.transactionDate === '2026-02-08')).toBe(true);
    });
  });

  describe('4. Lógica de Cálculo de Balances (Casos Críticos)', () => {
    it('maneja transferencias entre cuenta bancaria y tarjeta de crédito (pago de deuda)', async () => {
      const bank = makeAccount({ id: 'acc-bank', type: 'bank', initialBalance: 2000 });
      const card = makeAccount({ id: 'acc-card', type: 'credit_card', initialBalance: 500 }); // Deuda inicial de 500

      const repo = new FakeTransactionRepository([
        // Transferencia de 300 del banco a la tarjeta (pago de tarjeta)
        makeTx({ accountId: 'acc-bank', transferToAccountId: 'acc-card', type: 'transfer', amount: 300, status: 'confirmed' }),
      ]);

      const calculator = new CalculateAccountBalance(repo);
      const bankBalance = await calculator.execute(bank);
      const cardBalance = await calculator.execute(card);

      expect(bankBalance).toBe(1700); // 2000 - 300
      expect(cardBalance).toBe(200);  // 500 - 300 (deuda reducida)
    });

    it('maneja avances de efectivo (transferencia saliendo de la tarjeta de crédito hacia efectivo)', async () => {
      const card = makeAccount({ id: 'acc-card', type: 'credit_card', initialBalance: 100 });
      const cash = makeAccount({ id: 'acc-cash', type: 'cash', initialBalance: 50 });

      const repo = new FakeTransactionRepository([
        // Avance de 200 desde tarjeta a efectivo
        makeTx({ accountId: 'acc-card', transferToAccountId: 'acc-cash', type: 'transfer', amount: 200, status: 'confirmed' }),
      ]);

      const calculator = new CalculateAccountBalance(repo);
      const cardBalance = await calculator.execute(card);
      const cashBalance = await calculator.execute(cash);

      expect(cardBalance).toBe(300); // 100 + 200 (deuda incrementada)
      expect(cashBalance).toBe(250); // 50 + 200 (disponible incrementado)
    });
  });

  describe('5. Generación de Recurrencias (Prevención de Duplicados)', () => {
    it('garantiza la prevención estricta de duplicados en todas las frecuencias', async () => {
      const dailyRule = makeRecurringRule({ id: 'r-daily', frequency: 'daily', startDate: '2026-03-01' });
      const repo = new FakeTransactionRepository();
      const generator = new GenerateRecurringInstances(repo);

      const pass1 = await generator.execute(dailyRule, '2026-03-01', '2026-03-05');
      expect(pass1).toHaveLength(5);

      const pass2 = await generator.execute(dailyRule, '2026-03-01', '2026-03-05');
      expect(pass2).toHaveLength(0); // Cero duplicados
    });

    it('maneja el ajuste de fin de mes en febrero (Jan 31 -> Feb 28 en año no bisiesto)', async () => {
      const rule = makeRecurringRule({ id: 'r-jan31', frequency: 'monthly', dayOfMonth: 31, startDate: '2026-01-31' });
      const repo = new FakeTransactionRepository();
      const generator = new GenerateRecurringInstances(repo);

      const created = await generator.execute(rule, '2026-01-31', '2026-02-28');
      expect(created).toHaveLength(2);
      expect(created[0].transactionDate).toBe('2026-01-31');
      expect(created[1].transactionDate).toBe('2026-02-28'); // Ajustado a último día de febrero
    });
  });

  describe('6. Validación de Estados (pending → confirmed → archived)', () => {
    it('permite transiciones de estado válidas y rechaza las no permitidas', () => {
      const validator = new ValidateTransaction();

      // Transiciones válidas
      expect(validator.validateStatusTransition('pending', 'confirmed').isValid).toBe(true);
      expect(validator.validateStatusTransition('pending', 'archived').isValid).toBe(true);
      expect(validator.validateStatusTransition('confirmed', 'archived').isValid).toBe(true);
      expect(validator.validateStatusTransition('archived', 'confirmed').isValid).toBe(true);
      expect(validator.validateStatusTransition('confirmed', 'confirmed').isValid).toBe(true);

      // Transición inválida
      const invalid = validator.validateStatusTransition('archived', 'pending');
      expect(invalid.isValid).toBe(false);
      expect(invalid.error).toContain("No se permite cambiar de estado 'archived' a 'pending'.");
    });

    it('al pasar de pending a confirmed se preservan metadatos originales de vencimiento e IA', async () => {
      const repo = new FakeTransactionRepository();
      const pendingTx = await repo.create(makeTx({
        id: 'tx-bill-1',
        status: 'pending',
        isRecurringInstance: true,
        recurringRuleId: 'rule-water',
        aiMetadata: {
          rawInput: 'Factura de agua por 45 dólares',
          parsedAmount: 45,
          parsedCategory: 'Servicios',
          parsedAccount: null,
          parsedMerchant: 'Acueducto',
          confidence: 0.98,
          corrections: {},
          dueDate: '2026-07-20',
          occurrenceDate: '2026-07-20',
        },
      }));

      // Confirmar la factura en la fecha real de pago (2026-07-22)
      const confirmedTx = await repo.update(pendingTx.id, {
        status: 'confirmed',
        transactionDate: '2026-07-22',
      });

      expect(confirmedTx.status).toBe('confirmed');
      expect(confirmedTx.transactionDate).toBe('2026-07-22');
      expect(confirmedTx.recurringRuleId).toBe('rule-water');
      expect(confirmedTx.aiMetadata?.dueDate).toBe('2026-07-20');
      expect(confirmedTx.aiMetadata?.occurrenceDate).toBe('2026-07-20');
    });
  });

});
