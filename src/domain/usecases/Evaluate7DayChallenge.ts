/**
 * ZenMoney — Caso de Uso: Evaluate7DayChallenge
 *
 * Evalúa el progreso del desafío de 7 días consecutivos de registro ("Hábito de Acero").
 * Construye una ventana de 7 días móviles hasta la fecha actual y determina los días completados.
 */

import { Challenge, ChallengeDayStatus } from '../entities/Challenge';
import { Transaction } from '../entities/Transaction';

export class Evaluate7DayChallenge {
  static execute(
    transactions: Transaction[],
    referenceDateStr: string = new Date().toISOString().split('T')[0],
    userId?: string
  ): Challenge {
    const refDate = new Date(`${referenceDateStr}T12:00:00`);

    // Construir la ventana de 7 días (desde hace 6 días hasta hoy)
    const days: ChallengeDayStatus[] = [];
    const dateSet = new Set<string>();

    // Filtrar transacciones del usuario
    const userTxs = userId
      ? transactions.filter((tx) => tx.createdByUserId === userId && tx.status === 'confirmed')
      : transactions.filter((tx) => tx.status === 'confirmed');

    userTxs.forEach((tx) => {
      dateSet.add(tx.transactionDate);
    });

    for (let i = 6; i >= 0; i--) {
      const d = new Date(refDate);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const isCompleted = dateSet.has(dateStr);
      const isToday = dateStr === referenceDateStr;
      const dayNumber = 7 - i;

      days.push({
        dayNumber,
        date: dateStr,
        isCompleted,
        isToday,
      });
    }

    const completedDays = days.filter((d) => d.isCompleted).length;
    const isCompletedAll = completedDays === 7;

    const startDate = days[0].date;
    const endDate = days[6].date;

    return {
      id: 'challenge-streak-7d',
      type: 'streak_7_days',
      title: 'Desafío 7 Días: Hábito de Acero',
      description: 'Registra al menos 1 movimiento diario durante 7 días seguidos para afianzar tu disciplina.',
      icon: 'fire',
      targetDays: 7,
      completedDays,
      days,
      startDate,
      endDate,
      status: isCompletedAll ? 'completed' : 'active',
      rewardBadgeTitle: '🔥 Constancia de Acero',
    };
  }
}
