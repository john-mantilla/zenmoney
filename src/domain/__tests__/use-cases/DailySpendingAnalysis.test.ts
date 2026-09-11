import { describe, it, expect } from 'vitest';
import { DailySpendingAnalysis } from '../../usecases/DailySpendingAnalysis';
import { Transaction } from '../../entities/Transaction';
import { Category } from '../../entities/Category';

describe('DailySpendingAnalysis Use Case', () => {
  const mockCategories: Category[] = [
    {
      id: 'cat-food',
      familyGroupId: 'fam-1',
      name: 'Alimentación',
      icon: 'silverware-fork-knife',
      color: '#FF5722',
      parentCategoryId: null,
      budgetRole: 'flexible',
      isSystem: false,
      isPrivate: false,
      createdAt: '2026-01-01',
    },
    {
      id: 'cat-rest',
      familyGroupId: 'fam-1',
      name: 'Restaurantes',
      icon: 'food',
      color: '#FF9800',
      parentCategoryId: 'cat-food',
      budgetRole: 'flexible',
      isSystem: false,
      isPrivate: false,
      createdAt: '2026-01-01',
    },
    {
      id: 'cat-trans',
      familyGroupId: 'fam-1',
      name: 'Transporte',
      icon: 'car',
      color: '#2196F3',
      parentCategoryId: null,
      budgetRole: 'fixed',
      isSystem: false,
      isPrivate: false,
      createdAt: '2026-01-01',
    },
  ];

  const mockTransactions: Transaction[] = [
    // 2026-08-01 (Sábado - Fin de semana)
    {
      id: 'tx-1',
      familyGroupId: 'fam-1',
      accountId: 'acc-1',
      categoryId: 'cat-rest',
      createdByUserId: 'usr-1',
      type: 'expense',
      amount: 150000,
      currency: 'COP',
      description: 'Cena sábado',
      merchantName: 'Restaurante El Sol',
      transactionDate: '2026-08-01',
      transferToAccountId: null,
      isRecurringInstance: false,
      recurringRuleId: null,
      status: 'confirmed',
      inputMethod: 'manual',
      isPrivate: false,
      createdAt: '2026-08-01T12:00:00Z',
      updatedAt: '2026-08-01T12:00:00Z',
    },
    // 2026-08-02 (Domingo - Fin de semana)
    {
      id: 'tx-2',
      familyGroupId: 'fam-1',
      accountId: 'acc-1',
      categoryId: 'cat-food',
      createdByUserId: 'usr-1',
      type: 'expense',
      amount: 100000,
      currency: 'COP',
      description: 'Mercado domingo',
      merchantName: 'Supermercado',
      transactionDate: '2026-08-02',
      transferToAccountId: null,
      isRecurringInstance: false,
      recurringRuleId: null,
      status: 'confirmed',
      inputMethod: 'manual',
      isPrivate: false,
      createdAt: '2026-08-02T12:00:00Z',
      updatedAt: '2026-08-02T12:00:00Z',
    },
    // 2026-08-03 (Lunes - Entre semana)
    {
      id: 'tx-3',
      familyGroupId: 'fam-1',
      accountId: 'acc-1',
      categoryId: 'cat-trans',
      createdByUserId: 'usr-1',
      type: 'expense',
      amount: 50000,
      currency: 'COP',
      description: 'Gasolina',
      merchantName: 'Estación Terpel',
      transactionDate: '2026-08-03',
      transferToAccountId: null,
      isRecurringInstance: false,
      recurringRuleId: null,
      status: 'confirmed',
      inputMethod: 'manual',
      isPrivate: false,
      createdAt: '2026-08-03T12:00:00Z',
      updatedAt: '2026-08-03T12:00:00Z',
    },
    // Ingreso (debe ignorarse)
    {
      id: 'tx-4',
      familyGroupId: 'fam-1',
      accountId: 'acc-1',
      categoryId: null,
      createdByUserId: 'usr-1',
      type: 'income',
      amount: 2000000,
      currency: 'COP',
      description: 'Salario',
      merchantName: null,
      transactionDate: '2026-08-01',
      transferToAccountId: null,
      isRecurringInstance: false,
      recurringRuleId: null,
      status: 'confirmed',
      inputMethod: 'manual',
      isPrivate: false,
      createdAt: '2026-08-01T08:00:00Z',
      updatedAt: '2026-08-01T08:00:00Z',
    },
  ];

  it('procesa correctamente los 31 días del mes de Agosto 2026', () => {
    const result = DailySpendingAnalysis.execute(mockTransactions, mockCategories, 2026, 8);

    expect(result.dailyPoints.length).toBe(31);
    expect(result.totalSpending).toBe(300000);
    expect(result.weekendSpending).toBe(250000); // 150.000 + 100.000
    expect(result.weekdaySpending).toBe(50000);
    expect(result.weekendPercentage).toBe(83); // 250k / 300k = ~83%
    expect(result.topWeekendCategory).toBe('Restaurantes');
    expect(result.insightMessage).toContain('fines de semana (83% del mes)');
  });

  it('identifica el día de mayor gasto correctamente', () => {
    const result = DailySpendingAnalysis.execute(mockTransactions, mockCategories, 2026, 8);

    expect(result.maxSpendingDay).not.toBeNull();
    expect(result.maxSpendingDay?.day).toBe(1);
    expect(result.maxSpendingDay?.total).toBe(150000);
  });

  it('filtra por categoría padre e incluye subcategorías', () => {
    // Filtrar por 'cat-food' debe incluir 'cat-food' ($100.000) y 'cat-rest' ($150.000) = $250.000
    const result = DailySpendingAnalysis.execute(mockTransactions, mockCategories, 2026, 8, 'cat-food');

    expect(result.totalSpending).toBe(250000);
    expect(result.dailyPoints[0].total).toBe(150000); // Día 1
    expect(result.dailyPoints[1].total).toBe(100000); // Día 2
    expect(result.dailyPoints[2].total).toBe(0); // Día 3 (Transporte queda excluido)
  });

  it('calcula métricas de Lunes a Domingo adecuadamente', () => {
    const result = DailySpendingAnalysis.execute(mockTransactions, mockCategories, 2026, 8);

    const lunes = result.weekdayPoints.find(w => w.name === 'Lunes');
    const sabado = result.weekdayPoints.find(w => w.name === 'Sábado');

    expect(lunes?.total).toBe(50000);
    expect(sabado?.total).toBe(150000);
  });
});
