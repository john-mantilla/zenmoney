/**
 * ZenMoney — Servicio de Recordatorio de Registro (Inactividad 2 Días)
 *
 * Programa una notificación local nativa que llega exactamente 48 horas (2 días)
 * después de la última transacción o apertura de la app.
 *
 * Incluye:
 * - Identificador determinista único ('zenmoney-inactivity-reminder') para sobreescribir en lugar de apilar.
 * - Mutex en memoria y debounce para prevenir disparos concurrentes múltiples.
 * - Limpieza exhaustiva de notificaciones huérfanas en la bandeja y en el programador de alarmas nativo.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BudgetAlertService } from './BudgetAlertService';

export const INACTIVITY_REMINDER_ID = 'zenmoney-inactivity-reminder';
const SCHEDULED_ID_KEY = 'zenmoney:registration_reminder_id';

let Notifications: any = null;

function getNotificationModule(): any {
  if (Notifications) return Notifications;
  if (Platform.OS !== 'web') {
    try {
      Notifications = require('expo-notifications');
    } catch {
      // Notificaciones nativas no disponibles en este entorno
    }
  }
  return Notifications;
}

export class RegistrationReminderService {
  private static isScheduling = false;
  private static lastScheduledAt = 0;

  /** @internal Soporte para pruebas unitarias */
  static setNotificationModule(mock: any): void {
    Notifications = mock;
  }

  /**
   * Se ejecuta cuando el usuario abre la aplicación para descartar la notificación
   * de la bandeja (si ya había sido entregada) y reiniciar el ciclo.
   */
  static async onAppOpened(): Promise<void> {
    const notif = getNotificationModule();
    if (Platform.OS === 'web' || !notif) return;
    try {
      if (typeof notif.dismissNotificationAsync === 'function') {
        await notif.dismissNotificationAsync(INACTIVITY_REMINDER_ID);
      }
    } catch {
      // Ignorar si no estaba presente
    }
  }

  /**
   * Programa un recordatorio nativo único para 48 horas (2 días) a partir de este momento.
   */
  static async scheduleInactivityReminder(days = 2): Promise<void> {
    const notif = getNotificationModule();
    if (Platform.OS === 'web' || !notif) return;

    // Mutex & Debounce: evitar llamadas concurrentes en ráfaga (mínimo 60 segundos entre programaciones)
    if (this.isScheduling) return;
    const now = Date.now();
    if (now - this.lastScheduledAt < 60_000) return;

    this.isScheduling = true;

    try {
      // 1. Limpieza total de notificaciones previas (tanto por ID fijo como por escaneo de pendientes)
      await this.cancelExisting();

      // 2. Descartar cualquier notificación de inactividad que ya esté visible en la bandeja
      if (typeof notif.dismissNotificationAsync === 'function') {
        await Promise.resolve(notif.dismissNotificationAsync(INACTIVITY_REMINDER_ID)).catch(() => {});
      }

      const granted = await BudgetAlertService.requestPermissions();
      if (!granted) return;

      const seconds = days * 24 * 60 * 60; // 48 horas = 172.800 segundos

      // 3. Programar con identifier fijo para que Android reemplace cualquier alarma previa
      await notif.scheduleNotificationAsync({
        identifier: INACTIVITY_REMINDER_ID,
        content: {
          title: '🧾 ¿Olvidaste anotar algún gasto?',
          body: 'Llevas 2 días sin registrar movimientos en ZenMoney. Tómate 10 segundos para ponerte al día por voz o manual.',
          sound: true,
          data: { screen: 'index', type: 'inactivity_reminder' },
        },
        trigger: {
          seconds,
          type: notif.SchedulableTriggerInputTypes?.TIME_INTERVAL || 'timeInterval',
        } as any,
      });

      this.lastScheduledAt = Date.now();
      await AsyncStorage.setItem(SCHEDULED_ID_KEY, INACTIVITY_REMINDER_ID);
      console.log(`[RegistrationReminderService] Programado recordatorio único de inactividad 48h (${INACTIVITY_REMINDER_ID})`);
    } catch (err) {
      console.warn('[RegistrationReminderService] Error al programar recordatorio:', err);
    } finally {
      this.isScheduling = false;
    }
  }

  /**
   * Cancela de forma exhaustiva cualquier notificación de inactividad programada
   */
  static async cancelExisting(): Promise<void> {
    const notif = getNotificationModule();
    if (Platform.OS === 'web' || !notif) return;

    try {
      // A. Cancelar por identificador determinista
      await Promise.resolve(notif.cancelScheduledNotificationAsync(INACTIVITY_REMINDER_ID)).catch(() => {});

      // B. Cancelar ID antiguo en AsyncStorage si difería
      const legacyId = await AsyncStorage.getItem(SCHEDULED_ID_KEY);
      if (legacyId && legacyId !== INACTIVITY_REMINDER_ID) {
        await Promise.resolve(notif.cancelScheduledNotificationAsync(legacyId)).catch(() => {});
        await AsyncStorage.removeItem(SCHEDULED_ID_KEY);
      }

      // C. Escaneo defensivo: buscar y cancelar cualquier notificación huérfana en el sistema
      if (typeof notif.getAllScheduledNotificationsAsync === 'function') {
        const scheduledList = (await notif.getAllScheduledNotificationsAsync().catch(() => [])) || [];
        for (const item of scheduledList) {
          if (
            item.identifier === INACTIVITY_REMINDER_ID ||
            (item.content as any)?.data?.type === 'inactivity_reminder' ||
            item.content?.title?.includes('¿Olvidaste anotar algún gasto?')
          ) {
            await Promise.resolve(notif.cancelScheduledNotificationAsync(item.identifier)).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn('[RegistrationReminderService] Warning al cancelar previas:', err);
    }
  }
}
