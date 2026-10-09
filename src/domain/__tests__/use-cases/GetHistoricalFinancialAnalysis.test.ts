import { describe, it, expect, vi } from 'vitest';
import { GetHistoricalFinancialAnalysis } from '../../usecases/GetHistoricalFinancialAnalysis';
import { TransactionRepository } from '../../repositories/TransactionRepository';
import { Category } from '../../entities/Category';
import { Transaction } from '../../entities/Transaction';

describe('GetHistoricalFinancialAnalysis', () => {
  const nowStr = '2026-10-15T12:00:00.000Z';
  const mockCategories: Category[] = [
    {
      id: 'cat-housing',
      familyGroupId: 'f1',
      name: 'Vivienda',
      icon: 'home',
      color: '#4F46E5',
      parentCategoryId: null,
      isSystem: false,
      isPrivate: false,
      createdAt: nowStr,
    },
    {
      id: 'cat-food',
      familyGroupId: 'f1',
      name: 'Mercado',
      icon: 'cart',
      color: '#10B981',
      parentCategoryId: null,
      isSystem: false,
      isPrivate: false,
      createdAt: nowStr,
    },
  ];

  it('calculates 3-month and 12-month aggregations correctly', async () => {
    // Referencia: 2026-10-15
    const refDate = new Date('2026-10-15T12:00:00Z');

    const mockTransactions: Transaction[] = [
      // Octubre 2026 (mes 1 de los 3 recientes)
      {
        id: 'tx-1',
        familyGroupId: 'f1',
        accountId: 'acc-1',
        categoryId: 'cat-housing',
        createdByUserId: 'u1',
        type: 'expense',
        amount: 1545000,
        currency: 'COP',
        description: 'Oasis',
        merchantName: 'Oasis',
        transactionDate: '2026-10-02',
        transferToAccountId: null,
        isRecurringInstance: true,
        recurringRuleId: 'rule-oasis',
        status: 'confirmed',
        inputMethod: 'manual',
        isPrivate: false,
        createdAt: nowStr,
        updatedAt: nowStr,
      },
      // Septiembre 2026 (mes 2 de los 3 recientes)
      {
        id: 'tx-2',
        familyGroupId: 'f1',
        accountId: 'acc-1',
        categoryId: 'cat-housing',
        createdByUserId: 'u1',
        type: 'expense',
        amount: 1545000,
        currency: 'COP',
        description: 'Oasis',
        merchantName: 'Oasis',
        transactionDate: '2026-09-02',
        transferToAccountId: null,
        isRecurringInstance: true,
        recurringRuleId: 'rule-oasis',
        status: 'confirmed',
        inputMethod: 'manual',
        isPrivate: false,
        createdAt: nowStr,
        updatedAt: nowStr,
      },
      // Agosto 2026 (mes 3 de los 3 recientes)
      {
        id: 'tx-3',
        familyGroupId: 'f1',
        accountId: 'acc-1',
        categoryId: 'cat-housing',
        createdByUserId: 'u1',
        type: 'expense',
        amount: 1545000,
        currency: 'COP',
        description: 'Oasis',
        merchantName: 'Oasis',
        transactionDate: '2026-08-02',
        transferToAccountId: null,
        isRecurringInstance: true,
        recurringRuleId: 'rule-oasis',
        status: 'confirmed',
        inputMethod: 'manual',
        isPrivate: false,
        createdAt: nowStr,
        updatedAt: nowStr,
      },
      // Agosto 2026 - Mercado
      {
        id: 'tx-4',
        familyGroupId: 'f1',
        accountId: 'acc-1',
        categoryId: 'cat-food',
        createdByUserId: 'u1',
        type: 'expense',
        amount: 500000,
        currency: 'COP',
        description: 'Supermercado',
        merchantName: 'Exito',
        transactionDate: '2026-08-10',
        transferToAccountId: null,
        isRecurringInstance: false,
        status: 'confirmed',
        inputMethod: 'manual',
        isPrivate: false,
        createdAt: nowStr,
        updatedAt: nowStr,
      },
      // Ingreso en Septiembre 2026
      {
        id: 'tx-5',
        familyGroupId: 'f1',
        accountId: 'acc-1',
        categoryId: null,
        createdByUserId: 'u1',
        type: 'income',
        amount: 5000000,
        currency: 'COP',
        description: 'Salario',
        merchantName: null,
        transactionDate: '2026-09-30',
        transferToAccountId: null,
        isRecurringInstance: false,
        status: 'confirmed',
        inputMethod: 'manual',
        isPrivate: false,
        createdAt: nowStr,
        updatedAt: nowStr,
      },
      // Transacción de hace 6 meses (Abril 2026)
      {
        id: 'tx-6',
        familyGroupId: 'f1',
        accountId: 'acc-1',
        categoryId: 'cat-food',
        createdByUserId: 'u1',
        type: 'expense',
        amount: 400000,
        currency: 'COP',
        description: 'Mercado abril',
        merchantName: 'Jumbo',
        transactionDate: '2026-04-12',
        transferToAccountId: null,
        isRecurringInstance: false,
        status: 'confirmed',
        inputMethod: 'manual',
        isPrivate: false,
        createdAt: nowStr,
        updatedAt: nowStr,
      },
    ];

    const mockRepo: TransactionRepository = {
      getById: vi.fn(),
      getAll: vi.fn().mockResolvedValue(mockTransactions),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getByDateRange: vi.fn(),
      getTotalByType: vi.fn(),
    };

    const useCase = new GetHistoricalFinancialAnalysis(mockRepo);
    const result = await useCase.execute(mockCategories, refDate, 12);

    // 12 meses en el desglose
    expect(result.monthlyBreakdown).toHaveLength(12);

    // Los últimos 3 meses: Agosto, Septiembre, Octubre
    // Gastos últimos 3 meses: 1545000 (Oct) + 1545000 (Sep) + (1545000 + 500000) (Ago) = 5135000
    expect(result.totalExpensesLast3Months).toBe(5135000);
    expect(result.totalIncomeLast3Months).toBe(5000000);
    expect(result.averageMonthlyExpenseLast3Months).toBe(Math.round(5135000 / 3));

    // Gastos anuales: 5135000 + 400000 (Abril) = 5535000
    expect(result.totalExpensesLast12Months).toBe(5535000);

    // Top categorías anuales
    expect(result.topCategoriesLast12Months[0].name).toBe('Vivienda');
    expect(result.topCategoriesLast12Months[0].amount).toBe(4635000); // 3 * 1545000
    expect(result.topCategoriesLast12Months[1].name).toBe('Mercado');
    expect(result.topCategoriesLast12Months[1].amount).toBe(900000); // 500000 + 400000

    // Patrón recurrente de Oasis detectado
    expect(result.recurringPatterns.length).toBeGreaterThan(0);
    const oasisPattern = result.recurringPatterns.find(p => p.concept.toLowerCase().includes('oasis'));
    expect(oasisPattern).toBeDefined();
    expect(oasisPattern?.averageAmount).toBe(1545000);
    expect(oasisPattern?.occurrences).toBe(3);
  });
});
