/**
 * ZenMoney — ConfirmHabitExpense UseCase
 *
 * Registra en 1 solo toque una transacción derivada del cumplimiento de un hábito atómico
 * y genera el log de disciplina correspondiente, cumpliendo la Regla de los 2 Minutos.
 */
import { AtomicHabit, HabitLog } from '../entities/AtomicHabit';
import { Transaction } from '../entities/Transaction';

export interface ConfirmHabitExpenseInput {
  habit: AtomicHabit;
  amount?: number;
  accountId?: string;
  familyGroupId: string;
  userId: string;
  date?: string; // YYYY-MM-DD
  currency?: string;
  note?: string;
}

export interface ConfirmHabitExpenseResult {
  transaction: Transaction;
  habitLog: HabitLog;
}

export class ConfirmHabitExpense {
  static execute(input: ConfirmHabitExpenseInput): ConfirmHabitExpenseResult {
    const {
      habit,
      familyGroupId,
      userId,
      date = new Date().toISOString().split('T')[0],
      currency = 'COP',
      note,
    } = input;

    const amount = input.amount ?? habit.suggestedActionAmount ?? habit.ruleConfig.maxCapPerOccasion;
    if (!amount || amount <= 0) {
      throw new Error('El monto de la transacción debe ser mayor a cero');
    }

    const accountId = input.accountId ?? habit.defaultAccountId;
    if (!accountId) {
      throw new Error('Se requiere una cuenta válida para registrar el gasto del hábito');
    }

    const txId = `tx-habit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const description = note || `Hábito: ${habit.title}`;

    const transaction: Transaction = {
      id: txId,
      familyGroupId,
      accountId,
      categoryId: habit.categoryId,
      createdByUserId: userId,
      type: 'expense',
      amount,
      currency,
      description,
      merchantName: habit.merchantName ?? null,
      transactionDate: date,
      transferToAccountId: null,
      isRecurringInstance: false,
      recurringRuleId: null,
      status: 'confirmed',
      inputMethod: 'manual',
      aiMetadata: null,
      isPrivate: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncedAt: null,
    };

    // Si tiene regla de tope por ocasión, evaluar si hubo sobregiro respecto al tope
    const isOverspent = habit.ruleConfig.maxCapPerOccasion
      ? amount > habit.ruleConfig.maxCapPerOccasion
      : false;

    const habitLog: HabitLog = {
      id: logId,
      habitId: habit.id,
      date,
      status: isOverspent ? 'overspent' : 'completed',
      amountSpent: amount,
      transactionId: txId,
      createdAt: new Date().toISOString(),
    };

    return {
      transaction,
      habitLog,
    };
  }
}
