/**
 * ZenMoney — Servicio de Alertas de Presupuestos
 *
 * Evalúa los límites presupuestarios tras cada transacción y dispara notificaciones
 * in-app o del sistema (Push) utilizando el módulo de notificaciones de Expo.
 */

import { BudgetProgress } from '@domain/entities/Budget';
import { Transaction } from '@domain/entities/Transaction';
import { AtypicalDetectionResult } from '@domain/usecases/DetectAtypicalExpense';
import { RunwayProjection } from '@domain/usecases/ProjectMonthlyRunway';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

let Notifications: typeof import('expo-notifications') | null = null;

if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
    Notifications?.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (err) {
    console.warn('[BudgetAlertService] Notificaciones nativas no disponibles:', err);
  }
}

export class BudgetAlertService {
  
  /**
   * Inicializa los permisos para notificaciones nativas en dispositivos móviles.
   */
  static async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web' || !Notifications) return true;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      return finalStatus === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * Evalúa el progreso del presupuesto tras registrar una nueva transacción
   * y envía una alerta si cruza los umbrales críticos.
   *
   * @param progress - Estado actual del progreso calculado
   * @param categoryName - Nombre de la categoría evaluada
   * @param transaction - Transacción que causó la evaluación
   */
  static async checkAndAlert(
    progress: BudgetProgress,
    categoryName: string,
    transaction: Transaction
  ): Promise<void> {
    const { percentage, budget } = progress;
    const spentFormatted = Math.abs(progress.spent).toLocaleString('es-CO');
    const limitFormatted = Math.abs(budget.amountLimit).toLocaleString('es-CO');

    // Inicializar permisos rápidamente
    await this.requestPermissions();

    // 1. Alerta Crítica (Sobregiro - Gasto > 100%)
    if (percentage >= 100) {
      await this.sendNotification(
        '🚨 Presupuesto Excedido',
        `Has superado el límite mensual en la categoría ${categoryName}. ` +
        `Gastado: $${spentFormatted} de $${limitFormatted} presupuestados.`
      );
    }
    
    // 2. Alerta Preventiva (Gasto entre 80% y 100% justo después de esta transacción)
    // Evaluamos si el gasto recién cruzó el 80% para evitar alertas duplicadas
    else if (percentage >= 80) {
      const amountBeforeTx = progress.spent - transaction.amount;
      const percentageBeforeTx = (amountBeforeTx / budget.amountLimit) * 100;

      if (percentageBeforeTx < 80) {
        await this.sendNotification(
          '⚠️ Alerta de Presupuesto (80%)',
          `Has consumido el ${Math.round(percentage)}% de tu presupuesto en ${categoryName}. ` +
          `Te quedan $${Math.max(0, progress.remaining).toLocaleString('es-CO')} COP disponibles.`
        );
      }
    }
  }

  /**
   * Alerta cuando un gasto recién registrado es atípico frente al historial de su categoría.
   */
  static async alertAtypicalExpense(result: AtypicalDetectionResult, categoryName: string): Promise<void> {
    await this.requestPermissions();
    await this.sendNotification(
      '🔍 Gasto atípico detectado',
      `Tu gasto en ${categoryName} es ${result.differenceRatio}x tu promedio habitual ` +
      `($${result.average.toLocaleString('es-CO')} COP). Vale la pena revisarlo.`
    );
  }

  /**
   * Alerta cuando, al ritmo de gasto actual, un presupuesto se agotará antes de fin de mes.
   */
  static async alertBudgetPace(categoryName: string, daysUntilExceeded: number): Promise<void> {
    await this.requestPermissions();
    await this.sendNotification(
      '📊 Ritmo de gasto',
      `Basado en tu ritmo actual, superarás el presupuesto de ${categoryName} en ` +
      `${daysUntilExceeded} día${daysUntilExceeded === 1 ? '' : 's'}.`
    );
  }

  /**
   * Alerta cuando la proyección de saldo líquido a fin de mes queda en riesgo (negativa).
   */
  static async alertRunwayAtRisk(projection: RunwayProjection): Promise<void> {
    await this.requestPermissions();
    const projectedFormatted = projection.projectedBalance.toLocaleString('es-CO');
    await this.sendNotification(
      '📉 Alerta de liquidez',
      `A este ritmo, tu saldo líquido proyectado a fin de mes es de $${projectedFormatted} COP. ` +
      `Considera frenar gastos no esenciales.`
    );
  }

  /**
   * Envía una notificación física en el dispositivo o un alert fallback en web/Expo Go.
   */
  private static async sendNotification(title: string, body: string): Promise<void> {
    try {
      if (Platform.OS === 'web' || !Notifications) {
        // Fallback para Web / Expo Go: Notificación del navegador o log limpio
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body });
        } else {
          console.log(`[ZenMoney Alert] ${title}: ${body}`);
        }
      } else {
        // Notificación Push del Sistema en Builds Nativas (Development Build / Standalone)
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: true,
            data: { screen: 'budgets' },
          },
          trigger: null,
        });
      }
    } catch (err) {
      console.error('[BudgetAlertService Error]:', err);
    }
  }
}
