import { describe, it, expect } from 'vitest';
import { getLocalDateString, filterRecentTransactions } from '../../utils/dateUtils';

describe('getLocalDateString', () => {
  it('should return YYYY-MM-DD formatted date in local time', () => {
    const testDate = new Date(2026, 9, 18, 20, 38, 0); // Oct 18, 2026 at 20:38 local
    expect(getLocalDateString(testDate)).toBe('2026-10-18');
  });

  it('should pad single-digit months and days with leading zeros', () => {
    const testDate = new Date(2026, 0, 5, 8, 5, 0); // Jan 5, 2026
    expect(getLocalDateString(testDate)).toBe('2026-01-05');
  });

  it('should default to current local date if no date provided', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(getLocalDateString()).toBe(expected);
  });
});

describe('filterRecentTransactions (Temporal Shielding)', () => {
  const transactions = [
    { id: 'tx-future-installment', transactionDate: '2026-10-30', createdAt: '2026-06-30T10:00:00Z', description: 'Cuota 5/6 Computador' },
    { id: 'tx-today-afternoon', transactionDate: '2026-10-01', createdAt: '2026-10-01T15:30:00Z', description: 'Almuerzo' },
    { id: 'tx-today-morning', transactionDate: '2026-10-01', createdAt: '2026-10-01T08:00:00Z', description: 'Café' },
    { id: 'tx-yesterday', transactionDate: '2026-09-30', createdAt: '2026-09-30T20:00:00Z', description: 'Supermercado' },
    { id: 'tx-older', transactionDate: '2026-09-29', createdAt: '2026-09-29T11:00:00Z', description: 'Gasolina' },
  ];

  it('excluye estrictamente transacciones con fecha futura cuando es primero de mes', () => {
    const today = '2026-10-01';
    const recent = filterRecentTransactions(transactions, today, 3);

    expect(recent).toHaveLength(3);
    // tx-future-installment (2026-10-30) MUST NOT be present
    expect(recent.some(tx => tx.id === 'tx-future-installment')).toBe(false);
    // Should order by transactionDate DESC, then createdAt DESC
    expect(recent[0].id).toBe('tx-today-afternoon');
    expect(recent[1].id).toBe('tx-today-morning');
    expect(recent[2].id).toBe('tx-yesterday');
  });

  it('hace elegible la transacción cuando se alcanza su fecha efectiva', () => {
    const today = '2026-10-30';
    const recent = filterRecentTransactions(transactions, today, 3);

    expect(recent[0].id).toBe('tx-future-installment');
    expect(recent[1].id).toBe('tx-today-afternoon');
    expect(recent[2].id).toBe('tx-today-morning');
  });

  it('respeta el límite de elementos especificado', () => {
    const today = '2026-10-01';
    const recent2 = filterRecentTransactions(transactions, today, 2);
    expect(recent2).toHaveLength(2);
    expect(recent2[0].id).toBe('tx-today-afternoon');
    expect(recent2[1].id).toBe('tx-today-morning');
  });
});
