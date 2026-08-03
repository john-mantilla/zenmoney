/**
 * ZenMoney — Servicio de Alertas de Facturas por Vencer (Hoy a las 2:00 PM)
 *
 * Programa o dispara notificaciones nativas para facturas que vencen el día de hoy
 * fijando la hora a las 2:00 PM (14:00 hrs). Incluye deduplicación estricta por día
 * y firma de facturas para evitar desbordamientos o duplicados en el centro de notificaciones.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupabaseTransactionRepository } from '@/src/data/repositories/SupabaseTransactionRepository';
import { BudgetAlertService } from './BudgetAlertService';

const SCHEDULED_BILL_KEYS = 'zenmoney:scheduled_bill_notification_ids';
const LAST_NOTIFIED_BILL_SIGNATURE_KEY = 'zenmoney:last_notified_bill_signature';

let Notifications: typeof import('expo-notifications') | null = null;

if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
  } catch (err) {
    console.warn('[BillAlertService] Notificaciones nativas no disponibles:', err);
  }
}

export class BillAlertService {
  /**
   * Programa o notifica facturas que vencen HOY a las 2:00 PM (14:00 hrs).
   * Deduplica mediante firma única (`fecha_cantidad_montoTotal`) para notificar máximo una vez al día.
   */
  static async scheduleBillAlerts(): Promise<void> {
    if (Platform.OS === 'web' || !Notifications) return;

    try {
      const transactionRepo = new SupabaseTransactionRepository();
      const pendingTxs = await transactionRepo.getAll({ status: 'pending' });

      if (pendingTxs.length === 0) return;

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      // Filtrar facturas con vencimiento HOY
      const todayBills = pendingTxs.filter(tx => {
        const dueDate = tx.aiMetadata?.dueDate || tx.transactionDate;
        return dueDate === todayStr && tx.amount > 0;
      });

      if (todayBills.length === 0) return;

      const count = todayBills.length;
      const totalAmount = todayBills.reduce((sum, tx) => sum + Number(tx.amount), 0);
      const billSignature = `${todayStr}_${count}_${Math.round(totalAmount)}`;

      // Evitar notificaciones duplicadas si ya se notificó la misma combinación hoy
      const lastSignature = await AsyncStorage.getItem(LAST_NOTIFIED_BILL_SIGNATURE_KEY);
      if (lastSignature === billSignature) {
        return;
      }

      await this.cancelExistingAlerts();

      const permissionsGranted = await BudgetAlertService.requestPermissions();
      if (!permissionsGranted) return;

      const amountFormatted = Math.round(totalAmount).toLocaleString('es-CO');

      let title = '';
      let body = '';

      if (count === 1) {
        const tx = todayBills[0];
        title = '🚨 Factura por vencer hoy';
        body = `Hoy vence tu factura de "${tx.description || 'Sin descripción'}" por $${Math.round(Number(tx.amount)).toLocaleString('es-CO')} COP. ¡Págala a tiempo!`;
      } else {
        title = '🚨 Facturas por vencer hoy';
        body = `Tienes ${count} facturas por pagar hoy que suman $${amountFormatted} COP. ¡Evita recargos y revísalas a tiempo!`;
      }

      // Definir la hora de disparo: Hoy a las 2:00 PM (14:00)
      const targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0);

      let trigger: any;
      if (now.getHours() >= 14) {
        // Si ya pasaron las 2:00 PM del día actual, notificar una sola vez inmediatamente
        trigger = { seconds: 2, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL };
      } else {
        trigger = targetTime;
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          data: { screen: 'bills' },
        },
        trigger,
      });

      await AsyncStorage.setItem(SCHEDULED_BILL_KEYS, JSON.stringify([id]));
      await AsyncStorage.setItem(LAST_NOTIFIED_BILL_SIGNATURE_KEY, billSignature);
      console.log(`[BillAlertService] Alerta de facturas registrada hoy (${billSignature}) id: ${id}`);
    } catch (err) {
      console.warn('[BillAlertService] Error al programar alerta de facturas para hoy:', err);
    }
  }

  static async cancelExistingAlerts(): Promise<void> {
    if (Platform.OS === 'web' || !Notifications) return;

    try {
      const existing = await AsyncStorage.getItem(SCHEDULED_BILL_KEYS);
      if (existing) {
        const ids: string[] = JSON.parse(existing);
        for (const id of ids) {
          await Notifications.cancelScheduledNotificationAsync(id);
        }
        await AsyncStorage.removeItem(SCHEDULED_BILL_KEYS);
      }
    } catch {
      // Ignorar si no existen previas
    }
  }
}
