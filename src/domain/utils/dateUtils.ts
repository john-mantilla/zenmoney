/**
 * ZenMoney — Utilidades de Fechas Locales
 *
 * En JavaScript, `new Date().toISOString()` devuelve la fecha en zona horaria UTC (Z).
 * En zonas horarias como Colombia (UTC-5), a partir de las 7:00 PM,
 * `toISOString().split('T')[0]` pasa a ser el día siguiente en UTC.
 *
 * Esta función garantiza que siempre se obtenga la fecha en la zona horaria LOCAL
 * del dispositivo (formato 'YYYY-MM-DD').
 */

export const getLocalDateString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Filtra y ordena transacciones recientes blindando contra fechas futuras (ej. cuotas diferidas de TC).
 * Solo incluye transacciones con transactionDate <= todayStr, ordenadas DESC por transactionDate
 * y secundariamente DESC por createdAt.
 */
export function filterRecentTransactions<T extends { transactionDate: string; createdAt?: string | null }>(
  transactions: T[],
  todayStr: string = getLocalDateString(),
  limit: number = 3
): T[] {
  return transactions
    .filter(tx => tx.transactionDate <= todayStr)
    .sort((a, b) => {
      const dateDiff = b.transactionDate.localeCompare(a.transactionDate);
      if (dateDiff !== 0) return dateDiff;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    })
    .slice(0, limit);
}

