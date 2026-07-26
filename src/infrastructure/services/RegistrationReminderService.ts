/**
 * ZenMoney — Servicio de Recordatorio de Registro (Inactividad 2 Días)
 *
 * Programa una notificación local nativa que llega exactamente 48 horas (2 días)
 * después de la última transacción o apertura de la app.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BudgetAlertService } from './BudgetAlertService';

const SCHEDULED_ID_KEY = 'zenmoney:registration_reminder_id';

let Notifications: typeof import('expo-notifications') | null = null;

if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
  } catch (err) {
    console.warn('[RegistrationReminderService] Notificaciones nativas no disponibles:', err);
  }
}

export class RegistrationReminderService {
  /**
   * Programa un recordatorio nativo para 48 horas (2 días) a partir de este momento.
   */
  static async scheduleInactivityReminder(days = 2): Promise<void> {
    if (Platform.OS === 'web' || !Notifications) return;

    try {
      await this.cancelExisting();

      const granted = await BudgetAlertService.requestPermissions();
      if (!granted) return;

      const seconds = days * 24 * 60 * 60; // 48 horas = 172.800 segundos

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🧾 ¿Olvidaste anotar algún gasto?',
          body: 'Llevas 2 días sin registrar movimientos en ZenMoney. Tómate 10 segundos para ponerte al día por voz o manual.',
          sound: true,
          data: { screen: 'index' },
        },
        trigger: {
          seconds,
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        } as any,
      });

      await AsyncStorage.setItem(SCHEDULED_ID_KEY, id);
      console.log(`[RegistrationReminderService] Programado recordatorio de inactividad 48h (${id})`);
    } catch (err) {
      console.warn('[RegistrationReminderService] Error al programar recordatorio:', err);
    }
  }

  static async cancelExisting(): Promise<void> {
    if (Platform.OS === 'web' || !Notifications) return;

    try {
      const existingId = await AsyncStorage.getItem(SCHEDULED_ID_KEY);
      if (existingId) {
        await Notifications.cancelScheduledNotificationAsync(existingId);
        await AsyncStorage.removeItem(SCHEDULED_ID_KEY);
      }
    } catch {
      // Ignorar si no existe previa
    }
  }
}
