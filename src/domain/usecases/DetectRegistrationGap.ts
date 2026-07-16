/**
 * ZenMoney — Caso de Uso: DetectRegistrationGap
 *
 * Detecta si el usuario lleva más días de lo habitual sin registrar ningún
 * movimiento — el problema #1 de retención en apps de finanzas personales es
 * que la gente simplemente se olvida de anotar sus gastos.
 */

import { Transaction } from '../entities/Transaction';

export interface RegistrationGapResult {
  hasGap: boolean;
  daysSinceLastTransaction: number;
  /** Cada cuántos días, en promedio, este usuario suele registrar algo (basado en su historial reciente) */
  expectedGapDays: number;
}

const MIN_HISTORY_SIZE = 5;
const LOOKBACK_DAYS = 30;
const DEFAULT_EXPECTED_GAP_DAYS = 3;

export class DetectRegistrationGap {
  /**
   * @param userTransactions - Transacciones confirmadas creadas por el usuario actual
   *   (cualquier ventana razonable, ej. últimos 60-90 días)
   * @param todayStr - Fecha de hoy (YYYY-MM-DD)
   */
  execute(userTransactions: Transaction[], todayStr: string): RegistrationGapResult {
    const confirmed = userTransactions
      .filter(tx => tx.status === 'confirmed')
      .sort((a, b) => (a.transactionDate < b.transactionDate ? 1 : -1));

    if (confirmed.length < MIN_HISTORY_SIZE) {
      // Historial insuficiente para juzgar un patrón — no se alerta a un usuario nuevo
      return { hasGap: false, daysSinceLastTransaction: 0, expectedGapDays: DEFAULT_EXPECTED_GAP_DAYS };
    }

    const today = new Date(todayStr + 'T00:00:00');
    const lastTxDate = new Date(confirmed[0].transactionDate + 'T00:00:00');
    const daysSinceLastTransaction = Math.round((today.getTime() - lastTxDate.getTime()) / (1000 * 60 * 60 * 24));

    const lookbackStart = new Date(today);
    lookbackStart.setDate(lookbackStart.getDate() - LOOKBACK_DAYS);
    const lookbackStartStr = lookbackStart.toISOString().split('T')[0];

    const recentCount = confirmed.filter(tx => tx.transactionDate >= lookbackStartStr).length;
    const expectedGapDays = recentCount > 0 ? LOOKBACK_DAYS / recentCount : DEFAULT_EXPECTED_GAP_DAYS;

    // El umbral de alerta es el doble del ritmo habitual (con un piso de 2 días,
    // para no molestar a alguien que registra a diario por apenas medio día de retraso)
    const threshold = Math.max(2, expectedGapDays * 2);

    return {
      hasGap: daysSinceLastTransaction > threshold,
      daysSinceLastTransaction,
      expectedGapDays: Math.round(expectedGapDays * 10) / 10,
    };
  }
}
