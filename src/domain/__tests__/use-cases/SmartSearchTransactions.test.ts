import { describe, it, expect } from 'vitest';
import { SmartSearchTransactions } from '../../usecases/SmartSearchTransactions';
import { Transaction } from '../../entities/Transaction';
import { Category } from '../../entities/Category';
import { Account } from '../../entities/Account';

describe('SmartSearchTransactions (Buscador Inteligente Histórico)', () => {
  const searchEngine = new SmartSearchTransactions();

  const mockCategories: Category[] = [
    {
      id: 'cat_alim',
      familyGroupId: 'fam_1',
      name: 'Alimentación',
      parentCategoryId: null,
      icon: 'silverware-fork-knife',
      color: '#EF4444',
      budgetRole: 'needs',
      isSystem: false,
      isPrivate: false,
      createdAt: '2024-01-01',
    },
    {
      id: 'cat_rest',
      familyGroupId: 'fam_1',
      name: 'Restaurantes',
      parentCategoryId: 'cat_alim',
      icon: 'glass-cocktail',
      color: '#F87171',
      budgetRole: 'wants',
      isSystem: false,
      isPrivate: false,
      createdAt: '2024-01-01',
    },
    {
      id: 'cat_trans',
      familyGroupId: 'fam_1',
      name: 'Transporte',
      parentCategoryId: null,
      icon: 'car',
      color: '#3B82F6',
      budgetRole: 'needs',
      isSystem: false,
      isPrivate: false,
      createdAt: '2024-01-01',
    },
  ];

  const mockAccounts: Account[] = [
    {
      id: 'acc_nequi',
      familyGroupId: 'fam_1',
      ownerUserId: 'user_1',
      name: 'Nequi Personal',
      type: 'bank',
      initialBalance: 100000,
      currency: 'COP',
      isActive: true,
      isPrivate: false,
      createdAt: '2024-01-01',
    },
    {
      id: 'acc_banco',
      familyGroupId: 'fam_1',
      ownerUserId: 'user_1',
      name: 'Bancolombia Nómina',
      type: 'bank',
      initialBalance: 5000000,
      currency: 'COP',
      isActive: true,
      isPrivate: false,
      createdAt: '2024-01-01',
    },
  ];

  const makeTx = (data: Partial<Transaction> & { id: string; amount: number; transactionDate: string }): Transaction => ({
    familyGroupId: 'fam_1',
    accountId: 'acc_nequi',
    categoryId: null,
    createdByUserId: 'user_1',
    type: 'expense',
    currency: 'COP',
    description: null,
    merchantName: null,
    transferToAccountId: null,
    isRecurringInstance: false,
    recurringRuleId: null,
    status: 'confirmed',
    inputMethod: 'manual',
    aiMetadata: null,
    isPrivate: false,
    createdAt: '2026-11-20T12:00:00Z',
    updatedAt: '2026-11-20T12:00:00Z',
    syncedAt: null,
    tags: [],
    ...data,
  });

  const mockTransactions: Transaction[] = [
    // Movimiento en Noviembre 2026 (mes actual)
    makeTx({
      id: 'tx_1',
      accountId: 'acc_nequi',
      categoryId: 'cat_rest',
      createdByUserId: 'user_1',
      type: 'expense',
      amount: 45000,
      description: 'Almuerzo con compañeros',
      merchantName: 'Crepes & Waffles',
      transactionDate: '2026-11-20',
      tags: [{ id: 'tag_trabajo', name: 'Trabajo', color: '#10B981', familyGroupId: 'fam_1', createdAt: '2024-01-01' }],
    }),
    // Movimiento en Octubre 2026 (mes anterior)
    makeTx({
      id: 'tx_2',
      accountId: 'acc_banco',
      categoryId: 'cat_trans',
      createdByUserId: 'user_1',
      type: 'expense',
      amount: 85000,
      description: 'Tanqueada gasolina',
      merchantName: 'Estación Terpel',
      transactionDate: '2026-10-14',
      inputMethod: 'voice',
    }),
    // Movimiento en Julio 2025 (año anterior)
    makeTx({
      id: 'tx_3',
      accountId: 'acc_banco',
      categoryId: null,
      createdByUserId: 'user_1',
      type: 'income',
      amount: 2500000,
      description: 'Bono semestral empresa',
      merchantName: 'Pensemos S.A.S.',
      transactionDate: '2025-07-15',
    }),
    // Movimiento con acentos en Enero 2025
    makeTx({
      id: 'tx_4',
      accountId: 'acc_nequi',
      categoryId: 'cat_alim',
      createdByUserId: 'user_1',
      type: 'expense',
      amount: 150000,
      description: 'Compra víveres supermercado',
      merchantName: 'Almacenes Éxito Calle 80',
      transactionDate: '2025-01-10',
    }),
    // Transferencia entre cuentas en Marzo 2025
    makeTx({
      id: 'tx_5',
      accountId: 'acc_banco',
      transferToAccountId: 'acc_nequi',
      categoryId: null,
      createdByUserId: 'user_1',
      type: 'transfer',
      amount: 200000,
      description: 'Recarga Nequi para gastos menores',
      transactionDate: '2025-03-01',
    }),
    // Movimiento privado de otro integrante familiar
    makeTx({
      id: 'tx_private',
      accountId: 'acc_banco',
      categoryId: 'cat_rest',
      createdByUserId: 'user_spouse',
      type: 'expense',
      amount: 99000,
      description: 'Regalo sorpresa de cumpleaños',
      transactionDate: '2026-11-05',
      isPrivate: true,
    }),
  ];

  it('1. Encuentra movimientos en toda la historia de registros (scope: all)', () => {
    // Buscar "gasolina" que ocurrió en octubre 2026
    const res = searchEngine.execute(mockTransactions, mockCategories, mockAccounts, {
      query: 'gasolina',
      scope: 'all',
      targetYear: 2026,
      targetMonth: 11, // el mes actual es noviembre, pero debe encontrarlo en octubre
    });

    expect(res.totalMatches).toBe(1);
    expect(res.transactions[0].id).toBe('tx_2');
    expect(res.transactions[0].transactionDate).toBe('2026-10-14');
  });

  it('2. Restringe al mes seleccionado cuando scope es "month"', () => {
    // Si el usuario explícitamente selecciona "Este mes" (Noviembre 2026), no debe mostrar octubre
    const res = searchEngine.execute(mockTransactions, mockCategories, mockAccounts, {
      query: 'gasolina',
      scope: 'month',
      targetYear: 2026,
      targetMonth: 11,
    });

    expect(res.totalMatches).toBe(0);
  });

  it('3. Búsqueda insensible a tildes, diacríticos y mayúsculas ("exito" -> "Éxito")', () => {
    const res = searchEngine.execute(mockTransactions, mockCategories, mockAccounts, {
      query: 'exito',
      scope: 'all',
    });

    expect(res.totalMatches).toBe(1);
    expect(res.transactions[0].id).toBe('tx_4');
    expect(res.transactions[0].merchantName).toContain('Éxito');
  });

  it('4. Búsqueda por categoría padre ("alimentacion" encuentra restaurantes y viveres)', () => {
    const res = searchEngine.execute(mockTransactions, mockCategories, mockAccounts, {
      query: 'alimentacion',
      scope: 'all',
      currentUserId: 'user_1',
    });

    // Debe encontrar tx_1 (Restaurantes -> Alimentación) y tx_4 (Alimentación)
    expect(res.totalMatches).toBe(2);
    const ids = res.transactions.map((t) => t.id);
    expect(ids).toContain('tx_1');
    expect(ids).toContain('tx_4');
  });

  it('5. Búsqueda por cuenta ("nequi" encuentra movimientos donde Nequi es origen o destino)', () => {
    const res = searchEngine.execute(mockTransactions, mockCategories, mockAccounts, {
      query: 'nequi',
      scope: 'all',
    });

    // tx_1 (cuenta Nequi), tx_4 (cuenta Nequi), tx_5 (transferencia destino Nequi)
    expect(res.totalMatches).toBe(3);
    const ids = res.transactions.map((t) => t.id);
    expect(ids).toContain('tx_1');
    expect(ids).toContain('tx_4');
    expect(ids).toContain('tx_5');
  });

  it('6. Búsqueda por etiqueta (#trabajo)', () => {
    const res = searchEngine.execute(mockTransactions, mockCategories, mockAccounts, {
      query: '#trabajo',
      scope: 'all',
    });

    expect(res.totalMatches).toBe(1);
    expect(res.transactions[0].id).toBe('tx_1');
  });

  it('7. Búsqueda inteligente por importes numéricos (45000, $45.000, 45k)', () => {
    const resExact = searchEngine.execute(mockTransactions, mockCategories, mockAccounts, {
      query: '45000',
      scope: 'all',
    });
    expect(resExact.totalMatches).toBe(1);
    expect(resExact.transactions[0].id).toBe('tx_1');

    const resFormatted = searchEngine.execute(mockTransactions, mockCategories, mockAccounts, {
      query: '$45.000',
      scope: 'all',
    });
    expect(resFormatted.totalMatches).toBe(1);
    expect(resFormatted.transactions[0].id).toBe('tx_1');

    const resK = searchEngine.execute(mockTransactions, mockCategories, mockAccounts, {
      query: '45k',
      scope: 'all',
    });
    expect(resK.totalMatches).toBe(1);
    expect(resK.transactions[0].id).toBe('tx_1');
  });

  it('8. Búsqueda por operadores de comparación (>100k, <50k)', () => {
    // Gastos o ingresos mayores a 100.000
    const resGt = searchEngine.execute(mockTransactions, mockCategories, mockAccounts, {
      query: '>100k',
      scope: 'all',
    });

    // tx_3 (2.500.000), tx_4 (150.000), tx_5 (200.000)
    expect(resGt.totalMatches).toBe(3);
    const ids = resGt.transactions.map((t) => t.id);
    expect(ids).toContain('tx_3');
    expect(ids).toContain('tx_4');
    expect(ids).toContain('tx_5');
  });

  it('9. Búsqueda por nombre de mes en español ("octubre", "enero 2025")', () => {
    const resOct = searchEngine.execute(mockTransactions, mockCategories, mockAccounts, {
      query: 'octubre',
      scope: 'all',
    });
    expect(resOct.totalMatches).toBe(1);
    expect(resOct.transactions[0].id).toBe('tx_2');

    const resEne2025 = searchEngine.execute(mockTransactions, mockCategories, mockAccounts, {
      query: 'enero 2025',
      scope: 'all',
    });
    expect(resEne2025.totalMatches).toBe(1);
    expect(resEne2025.transactions[0].id).toBe('tx_4');
  });

  it('10. Multi-token AND search (ej: "crepes 45k")', () => {
    const res = searchEngine.execute(mockTransactions, mockCategories, mockAccounts, {
      query: 'crepes 45k',
      scope: 'all',
    });
    expect(res.totalMatches).toBe(1);
    expect(res.transactions[0].id).toBe('tx_1');
  });

  it('11. Oculta transacciones privadas de otros miembros familiares', () => {
    // user_1 busca todo el historial
    const res = searchEngine.execute(mockTransactions, mockCategories, mockAccounts, {
      query: 'cumpleaños',
      scope: 'all',
      currentUserId: 'user_1',
    });

    // tx_private fue creada por user_spouse con isPrivate = true, no debe aparecer
    expect(res.totalMatches).toBe(0);

    // Pero si busca user_spouse (el autor), sí la puede ver
    const resSpouse = searchEngine.execute(mockTransactions, mockCategories, mockAccounts, {
      query: 'cumpleaños',
      scope: 'all',
      currentUserId: 'user_spouse',
    });
    expect(resSpouse.totalMatches).toBe(1);
    expect(resSpouse.transactions[0].id).toBe('tx_private');
  });

  it('12. Calcula correctamente estadísticas agregadas (ingresos, gastos, balance y meses únicos)', () => {
    const res = searchEngine.execute(mockTransactions, mockCategories, mockAccounts, {
      query: '', // sin filtro de texto
      scope: 'all',
      currentUserId: 'user_1',
    });

    // tx_1 (-45k), tx_2 (-85k), tx_3 (+2.5M), tx_4 (-150k), tx_5 (transferencia 200k)
    // Ingresos: 2.500.000
    // Gastos: 45.000 + 85.000 + 150.000 = 280.000
    expect(res.totalMatches).toBe(5);
    expect(res.incomeSum).toBe(2500000);
    expect(res.expenseSum).toBe(280000);
    expect(res.netSum).toBe(2500000 - 280000);
    expect(res.matchedMonthsCount).toBe(5); // 2026-11, 2026-10, 2025-07, 2025-01, 2025-03
  });
});
