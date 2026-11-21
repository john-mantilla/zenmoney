/**
 * ZenMoney — SmartSearchTransactions Use Case
 *
 * Motor de búsqueda inteligente para movimientos financieros.
 * Permite buscar en toda la historia de registros (cross-month / global)
 * o dentro del mes actual.
 *
 * Características inteligentes:
 * - Búsqueda multi-campo: concepto, comercio, categoría, categoría padre, cuentas (origen/destino) y etiquetas.
 * - Tolerancia a acentos y mayúsculas/minúsculas (normalización Unicode NFD).
 * - Multi-token AND: cada término ingresado debe coincidir con algún atributo del movimiento.
 * - Búsqueda inteligente por importes: exacto (50000, $50.000), aproximaciones en K/M (50k, 1.5M),
 *   operadores de comparación (>100k, <50000, >=, <=) y rangos (50k-100k).
 * - Búsqueda por lenguaje natural de fechas: meses en español (enero-diciembre / abr, oct), años y días.
 * - Detección de tipo: 'ingreso', 'gasto', 'transferencia'.
 * - Preservación de filtros combinados: cuenta, miembro, tipo, etiquetas y privacidad familiar.
 */

import { Transaction } from '../entities/Transaction';
import { Category } from '../entities/Category';
import { Account } from '../entities/Account';

export interface SmartSearchOptions {
  query?: string;
  scope?: 'all' | 'month'; // 'all': toda la historia; 'month': mes específico
  targetYear?: number;
  targetMonth?: number;
  selectedAccountId?: string | null;
  selectedMemberId?: string | null;
  selectedType?: 'all' | 'income' | 'expense' | 'transfer';
  selectedTagId?: string | null;
  selectedCategoryId?: string | null;
  currentUserId?: string | null;
}

export interface SmartSearchResult {
  transactions: Transaction[];
  totalMatches: number;
  incomeSum: number;
  expenseSum: number;
  netSum: number;
  matchedMonthsCount: number;
  distinctMonths: string[]; // YYYY-MM únicos encontrados
}

export const SPANISH_MONTHS: Record<string, number> = {
  enero: 1, ene: 1,
  febrero: 2, feb: 2,
  marzo: 3, mar: 3,
  abril: 4, abr: 4,
  mayo: 5, may: 5,
  junio: 6, jun: 6,
  julio: 7, jul: 7,
  agosto: 8, ago: 8,
  septiembre: 9, sep: 9, set: 9,
  octubre: 10, oct: 10,
  noviembre: 11, nov: 11,
  diciembre: 12, dic: 12,
};

export class SmartSearchTransactions {
  /**
   * Normaliza cadenas eliminando tildes y diacríticos, pasando a minúsculas.
   */
  public static normalize(str: string): string {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /**
   * Parsea un valor numérico flexible expresado como texto ($50.000, 50k, 1.5m, etc.)
   */
  public static parseNumericValue(raw: string): number | null {
    let clean = raw.trim().toLowerCase();
    if (clean.startsWith('$')) {
      clean = clean.substring(1).trim();
    }

    let multiplier = 1;
    if (clean.endsWith('k')) {
      multiplier = 1_000;
      clean = clean.slice(0, -1);
    } else if (clean.endsWith('m')) {
      multiplier = 1_000_000;
      clean = clean.slice(0, -1);
    }

    // Remover separadores de miles y estandarizar decimales
    // Ejemplo: 50.000 -> 50000; 1,5 -> 1.5
    clean = clean.replace(/\./g, '').replace(/,/g, '.');

    const val = parseFloat(clean);
    if (isNaN(val)) return null;
    return val * multiplier;
  }

  /**
   * Ejecuta la búsqueda inteligente sobre el universo de transacciones proporcionado.
   */
  public execute(
    allTransactions: Transaction[],
    categories: Category[] = [],
    accounts: Account[] = [],
    options: SmartSearchOptions = {}
  ): SmartSearchResult {
    const {
      query = '',
      scope = 'all',
      targetYear,
      targetMonth,
      selectedAccountId,
      selectedMemberId,
      selectedType = 'all',
      selectedTagId,
      selectedCategoryId,
      currentUserId,
    } = options;

    // 1. Construir mapas de búsqueda rápida de categorías y cuentas
    const categoryMap = new Map<string, { nameNorm: string; parentNameNorm?: string }>();
    const parentCatMap = new Map<string, Category>();
    categories.forEach((c) => {
      if (!c.parentCategoryId) {
        parentCatMap.set(c.id, c);
      }
    });
    categories.forEach((c) => {
      const nameNorm = SmartSearchTransactions.normalize(c.name);
      let parentNameNorm: string | undefined = undefined;
      if (c.parentCategoryId) {
        const parent = parentCatMap.get(c.parentCategoryId) || categories.find((x) => x.id === c.parentCategoryId);
        if (parent) {
          parentNameNorm = SmartSearchTransactions.normalize(parent.name);
        }
      }
      categoryMap.set(c.id, { nameNorm, parentNameNorm });
    });

    const accountMap = new Map<string, string>();
    accounts.forEach((a) => {
      accountMap.set(a.id, SmartSearchTransactions.normalize(a.name));
    });

    const cleanQuery = query.trim();
    const queryTokens = cleanQuery.length > 0 ? cleanQuery.split(/\s+/).map(SmartSearchTransactions.normalize) : [];

    // 2. Filtrado inicial y reglas de negocio
    let filtered = allTransactions.filter((tx) => {
      // Privacidad familiar
      if (tx.isPrivate && currentUserId && tx.createdByUserId !== currentUserId) {
        return false;
      }

      // Restricción por mes si el alcance es 'month'
      if (scope === 'month' && targetYear && targetMonth) {
        const monthPrefix = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
        if (!tx.transactionDate.startsWith(monthPrefix)) {
          return false;
        }
      }

      // Filtro por cuenta seleccionada
      if (selectedAccountId) {
        if (tx.accountId !== selectedAccountId && tx.transferToAccountId !== selectedAccountId) {
          return false;
        }
      }

      // Filtro por integrante familiar
      if (selectedMemberId && tx.createdByUserId !== selectedMemberId) {
        return false;
      }

      // Filtro por tipo de movimiento
      if (selectedType !== 'all' && tx.type !== selectedType) {
        return false;
      }

      // Filtro por etiqueta
      if (selectedTagId) {
        const hasTag = tx.tags && tx.tags.some((t) => t.id === selectedTagId);
        if (!hasTag) return false;
      }

      // Filtro por categoría específica
      if (selectedCategoryId) {
        if (tx.categoryId !== selectedCategoryId) {
          const cat = categories.find((c) => c.id === tx.categoryId);
          if (cat?.parentCategoryId !== selectedCategoryId) {
            return false;
          }
        }
      }

      // Si no hay texto de búsqueda, supera el filtro
      if (queryTokens.length === 0) {
        return true;
      }

      // 3. Evaluación inteligente de los términos de búsqueda (Multi-token AND)
      return this.matchesQueryTokens(tx, queryTokens, categoryMap, accountMap);
    });

    // 4. Ordenar resultados cronológicamente descendente (más recientes primero)
    filtered.sort((a, b) => {
      const cmpDate = b.transactionDate.localeCompare(a.transactionDate);
      if (cmpDate !== 0) return cmpDate;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    // 5. Calcular estadísticas agregadas
    let incomeSum = 0;
    let expenseSum = 0;
    const monthsSet = new Set<string>();

    for (const tx of filtered) {
      const amount = Number(tx.amount);
      if (tx.type === 'income') {
        incomeSum += amount;
      } else if (tx.type === 'expense') {
        expenseSum += amount;
      } else if (tx.type === 'transfer') {
        if (selectedAccountId) {
          if (tx.transferToAccountId === selectedAccountId) {
            incomeSum += amount;
          } else if (tx.accountId === selectedAccountId) {
            expenseSum += amount;
          }
        }
      }

      if (tx.transactionDate && tx.transactionDate.length >= 7) {
        monthsSet.add(tx.transactionDate.substring(0, 7));
      }
    }

    return {
      transactions: filtered,
      totalMatches: filtered.length,
      incomeSum,
      expenseSum,
      netSum: incomeSum - expenseSum,
      matchedMonthsCount: monthsSet.size,
      distinctMonths: Array.from(monthsSet).sort().reverse(),
    };
  }

  /**
   * Verifica si una transacción satisface todos los tokens de la consulta inteligente.
   */
  private matchesQueryTokens(
    tx: Transaction,
    tokens: string[],
    categoryMap: Map<string, { nameNorm: string; parentNameNorm?: string }>,
    accountMap: Map<string, string>
  ): boolean {
    const descNorm = tx.description ? SmartSearchTransactions.normalize(tx.description) : '';
    const merchantNorm = tx.merchantName ? SmartSearchTransactions.normalize(tx.merchantName) : '';

    const catInfo = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
    const catNameNorm = catInfo?.nameNorm || '';
    const parentCatNameNorm = catInfo?.parentNameNorm || '';

    const accNameNorm = accountMap.get(tx.accountId) || '';
    const destAccNameNorm = tx.transferToAccountId ? accountMap.get(tx.transferToAccountId) || '' : '';

    const tagNamesNorm = tx.tags ? tx.tags.map((t) => SmartSearchTransactions.normalize(t.name)) : [];

    const amountNum = Math.abs(Number(tx.amount));
    const amountStr = String(amountNum);

    const txDate = tx.transactionDate; // Formato YYYY-MM-DD
    const dateParts = txDate.split('-');
    const txYear = dateParts[0];
    const txMonthNum = parseInt(dateParts[1], 10);
    const txDay = dateParts[2];

    for (const token of tokens) {
      if (!token) continue;

      let tokenMatched = false;

      // A. Coincidencia por texto directo en descripción o comercio
      if (descNorm.includes(token) || merchantNorm.includes(token)) {
        tokenMatched = true;
      }

      // B. Coincidencia por categoría o categoría padre
      if (!tokenMatched && (catNameNorm.includes(token) || parentCatNameNorm.includes(token))) {
        tokenMatched = true;
      }

      // C. Coincidencia por cuenta origen o destino
      if (!tokenMatched && (accNameNorm.includes(token) || destAccNameNorm.includes(token))) {
        tokenMatched = true;
      }

      // D. Coincidencia por etiquetas (#tag o tag)
      if (!tokenMatched) {
        const cleanTagToken = token.startsWith('#') ? token.substring(1) : token;
        if (tagNamesNorm.some((t) => t.includes(cleanTagToken))) {
          tokenMatched = true;
        }
      }

      // E. Coincidencia por tipo de transacción en lenguaje natural
      if (!tokenMatched) {
        if (
          (token === 'gasto' || token === 'gastos') && tx.type === 'expense' ||
          (token === 'ingreso' || token === 'ingresos') && tx.type === 'income' ||
          (token === 'transferencia' || token === 'transferencias' || token === 'transfe') && tx.type === 'transfer'
        ) {
          tokenMatched = true;
        }
      }

      // F. Coincidencia por fecha en lenguaje natural (Meses en español, año, día)
      if (!tokenMatched) {
        // ¿Es un mes en español? (ej. octubre, oct, noviembre)
        const monthNum = SPANISH_MONTHS[token];
        if (monthNum !== undefined && monthNum === txMonthNum) {
          tokenMatched = true;
        } else if (token === txYear) {
          // Coincidencia con el año (ej. 2024, 2025, 2026)
          tokenMatched = true;
        } else if (token === txDay || token === String(parseInt(txDay, 10))) {
          // Coincidencia de día
          tokenMatched = true;
        } else if (txDate.includes(token)) {
          // Coincidencia con formato ISO (ej: 2024-10)
          tokenMatched = true;
        }
      }

      // G. Coincidencia inteligente por importe numérico / comparadores / rangos
      if (!tokenMatched) {
        // ¿Es un operador de comparación? (>100k, >=50000, <20000, <=30k)
        if (token.startsWith('>=') || token.startsWith('<=')) {
          const op = token.substring(0, 2);
          const target = SmartSearchTransactions.parseNumericValue(token.substring(2));
          if (target !== null) {
            tokenMatched = op === '>=' ? amountNum >= target : amountNum <= target;
          }
        } else if (token.startsWith('>') || token.startsWith('<')) {
          const op = token[0];
          const target = SmartSearchTransactions.parseNumericValue(token.substring(1));
          if (target !== null) {
            tokenMatched = op === '>' ? amountNum >= target : amountNum <= target;
          }
        } else if (token.includes('-') && !token.startsWith('-')) {
          // Rango numérico (ej. 50k-100k o 20000-50000)
          const parts = token.split('-');
          if (parts.length === 2) {
            const min = SmartSearchTransactions.parseNumericValue(parts[0]);
            const max = SmartSearchTransactions.parseNumericValue(parts[1]);
            if (min !== null && max !== null) {
              tokenMatched = amountNum >= min && amountNum <= max;
            }
          }
        } else {
          // Valor numérico directo o monto parcial
          const parsedVal = SmartSearchTransactions.parseNumericValue(token);
          if (parsedVal !== null) {
            // Coincidencia exacta de monto
            if (amountNum === parsedVal) {
              tokenMatched = true;
            } else if (amountStr.includes(token.replace(/[^0-9]/g, '')) && token.replace(/[^0-9]/g, '').length >= 3) {
              // Subcadena numérica si tiene al menos 3 dígitos (ej: buscando 500 encuentra 50000)
              tokenMatched = true;
            }
          }
        }
      }

      // H. Coincidencia en notas de IA o metadatos
      if (!tokenMatched && tx.aiMetadata) {
        const metaStr = SmartSearchTransactions.normalize(JSON.stringify(tx.aiMetadata));
        if (metaStr.includes(token)) {
          tokenMatched = true;
        }
      }

      // Si este token no coincidió con nada en el movimiento, la transacción no satisface la búsqueda
      if (!tokenMatched) {
        return false;
      }
    }

    return true;
  }
}
