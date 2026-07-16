/**
 * ZenMoney — Caso de Uso: CalculateRegistrationStreak
 *
 * Cuenta cuántos días consecutivos el usuario ha registrado al menos un
 * movimiento — el mismo mecanismo de "racha" que usan apps de hábitos, aplicado
 * al registro de gastos para reforzar la costumbre en vez de depender solo de
 * la memoria.
 */

export class CalculateRegistrationStreak {
  /**
   * @param transactionDates - Fechas (YYYY-MM-DD) de las transacciones confirmadas del usuario
   * @param todayStr - Fecha de hoy (YYYY-MM-DD)
   * @returns número de días consecutivos con al menos un registro, contando hacia atrás desde hoy
   */
  execute(transactionDates: string[], todayStr: string): number {
    const datesWithActivity = new Set(transactionDates);

    const cursor = new Date(todayStr + 'T00:00:00');
    // Si hoy todavía no hay nada registrado, no rompemos la racha de una vez —
    // el día no ha terminado — simplemente empezamos a contar desde ayer.
    if (!datesWithActivity.has(todayStr)) {
      cursor.setDate(cursor.getDate() - 1);
    }

    let streak = 0;
    while (datesWithActivity.has(cursor.toISOString().split('T')[0])) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  }
}
