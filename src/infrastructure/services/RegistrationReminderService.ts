/**
 * ZenMoney — Servicio de Recordatorio de Registro
 *
 * Programa una notificación local que llega aunque el usuario no abra la app
 * — el problema #1 de retención en apps de finanzas personales es que la
 * gente simplemente se olvida de anotar sus gastos. Se reprograma cada vez
 * que se recalcula el patrón de uso (al abrir el Dashboard), así siempre
 * refleja el ritmo real más reciente del usuario.
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BudgetAlertService } from './BudgetAlertService';

const SCHEDULED_ID_KEY = 'zenmoney:registration_reminder_id';
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let Notifications: typeof import('expo-notifications') | null = null;

if (!isExpoGo && Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
  } catch (err) {
    console.warn('[RegistrationReminderService] Notificaciones nativas no disponibles:', err);
  }
}

export class RegistrationReminderService {
  /**
   * @param expectedGapDays - Ritmo habitual del usuario (de DetectRegistrationGap);
   *   el recordatorio se programa para ese horizonte, acotado entre 1 y 5 días.
   */
  static async schedule(expectedGapDays: number): Promise<void> {
    if (Platform.OS === 'web' || isExpoGo || !Notifications) return;

    try {
      await this.cancelExisting();

      const granted = await BudgetAlertService.requestPermissions();
      if (!granted) return;

      const daysUntilReminder = Math.max(1, Math.min(5, Math.round(expectedGapDays)));

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🧾 ¿Se te olvidó algo?',
          body: 'Ha pasado un tiempo desde tu último gasto registrado. Tómate 10 segundos para ponerte al día.',
          sound: true,
          data: { screen: 'index' },
        },
        trigger: { seconds: daysUntilReminder * 24 * 60 * 60 } as any,
      });

      await AsyncStorage.setItem(SCHEDULED_ID_KEY, id);
    } catch (err) {
      console.warn('[RegistrationReminderService] Error al programar recordatorio:', err);
    }
  }

  static async cancelExisting(): Promise<void> {
    if (Platform.OS === 'web' || isExpoGo || !Notifications) return;

    try {
      const existingId = await AsyncStorage.getItem(SCHEDULED_ID_KEY);
      if (existingId) {
        await Notifications.cancelScheduledNotificationAsync(existingId);
        await AsyncStorage.removeItem(SCHEDULED_ID_KEY);
      }
    } catch {
      // No es crítico si falla la cancelación; el próximo schedule() reemplaza igual.
    }
  }
}
