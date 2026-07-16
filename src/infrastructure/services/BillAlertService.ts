/**
 * ZenMoney — Servicio de Alertas de Facturas por Vencer (Solo Hoy a las 2:00 PM)
 *
 * Programa alertas locales agrupadas para notificar al usuario sobre sus facturas
 * pendientes únicamente el día exacto de su vencimiento a las 2:00 PM.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupabaseTransactionRepository } from '@/src/data/repositories/SupabaseTransactionRepository';
import { BudgetAlertService } from './BudgetAlertService';

const SCHEDULED_BILL_KEYS = 'zenmoney:scheduled_bill_notification_ids';

export class BillAlertService {
  /**
   * Programa una notificación consolidada para hoy a las 2:00 PM si hay facturas pendientes.
   * Cancela la programación previa antes de programar la nueva.
   */
  static async scheduleBillAlerts(): Promise<void> {
    if (Platform.OS === 'web') return; // Las notificaciones locales nativas no aplican en la versión web

    try {
      // 1. Cancelar cualquier alerta de facturas programada anteriormente para evitar duplicados
      await this.cancelExistingAlerts();

      // 2. Solicitar permisos de notificación nativa
      const permissionsGranted = await BudgetAlertService.requestPermissions();
      if (!permissionsGranted) return;

      // 3. Consultar transacciones pendientes (facturas)
      const transactionRepo = new SupabaseTransactionRepository();
      const pendingTxs = await transactionRepo.getAll({ status: 'pending' });

      if (pendingTxs.length === 0) return;

      const todayStr = new Date().toISOString().split('T')[0];

      // 4. Filtrar solo las facturas que vencen HOY
      const todayBills = pendingTxs.filter(tx => tx.transactionDate === todayStr);

      if (todayBills.length === 0) return;

      // 5. Verificar si la hora actual es antes de las 2:00 PM (14:00)
      const now = new Date();
      if (now.getHours() >= 14) {
        // Si ya es después de las 2:00 PM hoy, la hora de la notificación ya pasó.
        // No agendamos nada para hoy para evitar vibraciones repetidas.
        return;
      }

      // 6. Preparar contenido consolidado
      const count = todayBills.length;
      const totalAmount = todayBills.reduce((sum, tx) => sum + Number(tx.amount), 0);
      const amountFormatted = totalAmount.toLocaleString('es-CO');

      let title = '';
      let body = '';

      if (count === 1) {
        const tx = todayBills[0];
        title = '🧾 Factura pendiente para hoy';
        body = `Tienes pendiente: "${tx.description || 'Sin descripción'}" por $${Number(tx.amount).toLocaleString('es-CO')} COP.`;
      } else {
        title = '🧾 Facturas pendientes para hoy';
        body = `Tienes ${count} facturas por pagar hoy que suman un total de $${amountFormatted} COP.`;
      }

      // 7. Definir gatillo: 2:00 PM de hoy
      const triggerDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0);

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          data: { screen: 'bills' }, // Redirigir a la pestaña de facturas al presionar
        },
        trigger: triggerDate as any,
      });

      // Guardar el ID programado para poder cancelarlo/actualizarlo después
      await AsyncStorage.setItem(SCHEDULED_BILL_KEYS, JSON.stringify([id]));
    } catch (err) {
      console.warn('[BillAlertService] Error al programar alerta de facturas para hoy:', err);
    }
  }

  /**
   * Cancela todas las notificaciones de facturas previamente programadas.
   */
  static async cancelExistingAlerts(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(SCHEDULED_BILL_KEYS);
      if (stored) {
        const ids: string[] = JSON.parse(stored);
        await Promise.all(
          ids.map(id => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
        );
        await AsyncStorage.removeItem(SCHEDULED_BILL_KEYS);
      }
    } catch (err) {
      console.warn('[BillAlertService] Error al cancelar alertas de facturas previas:', err);
    }
  }
}
