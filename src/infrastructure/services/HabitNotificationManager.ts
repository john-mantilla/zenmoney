/**
 * ZenMoney — HabitNotificationManager
 *
 * Administra las notificaciones interactivas para hábitos atómicos y disponibles diarios,
 * configurando acciones rápidas de 1 toque (2-Minute Rule) directamente en la pantalla de bloqueo.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AtomicHabit, HabitSettings } from '../../domain/entities/AtomicHabit';

export const HABIT_NUDGE_CATEGORY = 'zenmoney:habit_nudge_category';
export const ACTION_REGISTER_DEFAULT = 'action_register_default';
export const ACTION_ADJUST_AMOUNT = 'action_adjust_amount';
export const ACTION_SKIP_TODAY = 'action_skip_today';

let Notifications: typeof import('expo-notifications') | null = null;

if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
  } catch (err) {
    console.warn('[HabitNotificationManager] Notifications nativas no disponibles:', err);
  }
}

export class HabitNotificationManager {
  private static isCategoryRegistered = false;

  /**
   * Registra la categoría de notificación interactiva con botones de acción rápida.
   */
  static async registerNotificationCategories(): Promise<void> {
    if (Platform.OS === 'web' || !Notifications || this.isCategoryRegistered) return;

    try {
      await Notifications.setNotificationCategoryAsync(HABIT_NUDGE_CATEGORY, [
        {
          identifier: ACTION_REGISTER_DEFAULT,
          buttonTitle: '⚡ Registrar monto',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: ACTION_ADJUST_AMOUNT,
          buttonTitle: '✏️ Ajustar',
          options: {
            opensAppToForeground: true,
          },
        },
        {
          identifier: ACTION_SKIP_TODAY,
          buttonTitle: '✋ Hoy no',
          options: {
            isDestructive: false,
            opensAppToForeground: false,
          },
        },
      ]);
      this.isCategoryRegistered = true;
    } catch (err) {
      console.warn('[HabitNotificationManager] Error al registrar categoría:', err);
    }
  }

  /**
   * Programa el recordatorio contextual para un hábito atómico.
   */
  static async scheduleHabitNudge(
    habit: AtomicHabit,
    settings?: Partial<HabitSettings>
  ): Promise<string | null> {
    // Si la funcionalidad o las notificaciones están desactivadas
    if (
      settings?.isGloballyEnabled === false ||
      settings?.notificationsEnabled === false ||
      !habit.isEnabled
    ) {
      return null;
    }

    if (Platform.OS === 'web' || !Notifications) return null;

    try {
      await this.registerNotificationCategories();
      await this.cancelHabitNudge(habit.id);

      const hour = habit.cueHour ?? (habit.timeOfDayCue === 'morning' ? 8 : 21);
      const amountStr = habit.suggestedActionAmount
        ? `$${habit.suggestedActionAmount.toLocaleString('es-CO')}`
        : '';

      const title = habit.timeOfDayCue === 'morning'
        ? `☀️ Intención de hoy: ${habit.title}`
        : `🌙 Cierre de jornada: ${habit.title}`;

      const body = habit.suggestedActionAmount
        ? `¿Completaste este plan hoy? Toca para registrar ${amountStr} en 1 segundo.`
        : `Revisa tu hábito "${habit.title}" y confirma tu micro-victoria de hoy.`;

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          categoryIdentifier: HABIT_NUDGE_CATEGORY,
          data: {
            habitId: habit.id,
            budgetId: habit.budgetId,
            categoryId: habit.categoryId,
            suggestedAmount: habit.suggestedActionAmount ?? 0,
            defaultAccountId: habit.defaultAccountId ?? null,
            merchantName: habit.merchantName ?? null,
          },
        },
        trigger: {
          hour,
          minute: 0,
          repeats: true,
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
        } as any,
      });

      await AsyncStorage.setItem(`zenmoney:habit_notif_${habit.id}`, notificationId);
      return notificationId;
    } catch (err) {
      console.warn('[HabitNotificationManager] Error al programar nudge:', err);
      return null;
    }
  }

  /**
   * Cancela la notificación programada de un hábito.
   */
  static async cancelHabitNudge(habitId: string): Promise<void> {
    if (Platform.OS === 'web' || !Notifications) return;

    try {
      const key = `zenmoney:habit_notif_${habitId}`;
      const existingId = await AsyncStorage.getItem(key);
      if (existingId) {
        await Notifications.cancelScheduledNotificationAsync(existingId);
        await AsyncStorage.removeItem(key);
      }
    } catch (err) {
      console.warn('[HabitNotificationManager] Error al cancelar notificación:', err);
    }
  }
}
