/**
 * ZenMoney — AnomalyDetectorService
 *
 * Motor de análisis pasivo que escanea las transacciones recientes para detectar
 * suscripciones no registradas, cobros duplicados y picos de gasto inusuales.
 *
 * Incluye persistencia de descarte (AsyncStorage) para evitar que el usuario vuelva
 * a ver la misma alerta tras haberla cerrado o marcado como entendida.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction } from '@/src/domain/entities/Transaction';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { HybridCategoryRepository } from '@/src/data/repositories/HybridCategoryRepository';

const DISMISSED_ALERTS_KEY = 'zenmoney:dismissed_smart_alerts';

export interface SmartAlert {
  id: string; // Firma única para deduplicación y persistencia de descarte
  type: 'duplicate' | 'subscription' | 'spike';
  title: string;
  message: string;
  actionLabel?: string;
  actionRoute?: string;
  actionParams?: Record<string, any>;
  categoryId?: string;
}

export class AnomalyDetectorService {
  private txRepo = new HybridTransactionRepository();
  private catRepo = new HybridCategoryRepository();

  /**
   * Escanea anomalías activas y filtra aquellas que el usuario ya haya descartado.
   */
  async scanForAnomalies(): Promise<SmartAlert[]> {
    const rawAlerts: SmartAlert[] = [];
    try {
      const now = new Date();
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(now.getDate() - 90);
      const startDate = ninetyDaysAgo.toISOString().split('T')[0];

      const txs = await this.txRepo.getAll({ startDate });
      const expenses = txs.filter((tx) => tx.type === 'expense' && tx.status === 'confirmed');

      const duplicates = this.detectDuplicates(expenses);
      rawAlerts.push(...duplicates);

      const subscriptions = this.detectHiddenSubscriptions(expenses);
      rawAlerts.push(...subscriptions);

      const spikes = await this.detectSpikes(expenses);
      rawAlerts.push(...spikes);
    } catch (err) {
      console.error('[AnomalyDetectorService] Error scanning anomalies:', err);
    }

    const dismissedIds = await this.getDismissedAlertIds();
    return rawAlerts.filter((alert) => !dismissedIds.includes(alert.id));
  }

  /**
   * Guarda de forma permanente el ID de una alerta descartada para que no vuelva a aparecer.
   */
  static async dismissAlert(alertId: string): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem(DISMISSED_ALERTS_KEY);
      const list: string[] = existing ? JSON.parse(existing) : [];
      if (!list.includes(alertId)) {
        list.push(alertId);
        await AsyncStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(list));
      }
    } catch (err) {
      console.warn('[AnomalyDetectorService] Error al guardar descarte de alerta:', err);
    }
  }

  private async getDismissedAlertIds(): Promise<string[]> {
    try {
      const existing = await AsyncStorage.getItem(DISMISSED_ALERTS_KEY);
      return existing ? JSON.parse(existing) : [];
    } catch {
      return [];
    }
  }

  private detectDuplicates(expenses: Transaction[]): SmartAlert[] {
    const alerts: SmartAlert[] = [];
    const recent = expenses.filter((tx) => {
      const txDate = new Date(tx.transactionDate);
      const diff = Date.now() - txDate.getTime();
      return diff <= 5 * 24 * 60 * 60 * 1000; // Últimos 5 días
    });

    const seen = new Set<string>();

    for (let i = 0; i < recent.length; i++) {
      for (let j = i + 1; j < recent.length; j++) {
        const tx1 = recent[i];
        const tx2 = recent[j];

        // Misma fecha, mismo monto, misma cuenta, mismo nombre
        if (
          tx1.id !== tx2.id &&
          tx1.amount === tx2.amount &&
          tx1.accountId === tx2.accountId &&
          tx1.transactionDate === tx2.transactionDate &&
          (tx1.merchantName === tx2.merchantName || tx1.description === tx2.description)
        ) {
          const merchant = tx1.merchantName || tx1.description || 'un comercio';
          const alertId = `duplicate:${tx1.amount}:${tx1.transactionDate}:${merchant.toLowerCase()}`;
          
          if (!seen.has(alertId)) {
            seen.add(alertId);
            alerts.push({
              id: alertId,
              type: 'duplicate',
              title: 'Posible Cobro Duplicado',
              message: `He detectado dos cobros idénticos por **$${tx1.amount.toLocaleString('es-CO')}** el ${tx1.transactionDate} en **${merchant}**. Podría ser un cobro duplicado por error del banco o comercio. Revisa tu extracto.`,
              actionLabel: 'Ver Movimientos',
              actionRoute: '/(tabs)/transactions',
            });
          }
        }
      }
    }
    return alerts;
  }

  private detectHiddenSubscriptions(expenses: Transaction[]): SmartAlert[] {
    const alerts: SmartAlert[] = [];

    // Agrupar por merchant o monto exacto
    const groups: Record<string, Transaction[]> = {};
    for (const tx of expenses) {
      const name = (tx.merchantName || tx.description || '').toLowerCase().trim();
      if (!name || name.length < 3) continue;

      const key = `${name}-${tx.amount}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    }

    for (const key in groups) {
      const group = groups[key];
      // Si hay 3 o más pagos idénticos en los últimos 90 días, es recurrente
      if (group.length >= 3) {
        // Verificar si ya es una suscripción conocida (isRecurringInstance)
        const alreadyRecurring = group.some((tx) => tx.isRecurringInstance || tx.recurringRuleId);
        if (!alreadyRecurring) {
          const name = group[0].merchantName || group[0].description || 'Comercio';
          const alertId = `subscription:${name.toLowerCase()}:${group[0].amount}`;
          alerts.push({
            id: alertId,
            type: 'subscription',
            title: 'Suscripción Detectada',
            message: `Noté un patrón: Has pagado **$${group[0].amount.toLocaleString('es-CO')}** en **${name}** consistentemente en los últimos 3 meses. ¿Es una suscripción? Te sugiero agregarla a tus Facturas Agendadas para que ZenMoney la presupueste automáticamente.`,
            actionLabel: 'Agendar Factura',
            actionRoute: '/settings/recurrences',
          });
        }
      }
    }

    return alerts;
  }

  private async detectSpikes(expenses: Transaction[]): Promise<SmartAlert[]> {
    const alerts: SmartAlert[] = [];
    const categories = await this.catRepo.getAll(true);

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const catTotals: Record<string, { current: number; past1: number; past2: number }> = {};

    for (const cat of categories) {
      catTotals[cat.id] = { current: 0, past1: 0, past2: 0 };
    }

    for (const tx of expenses) {
      if (!tx.categoryId || !catTotals[tx.categoryId]) continue;
      const txDate = new Date(tx.transactionDate);
      const m = txDate.getMonth();
      const y = txDate.getFullYear();

      if (y === currentYear && m === currentMonth) {
        catTotals[tx.categoryId].current += tx.amount;
      } else if (
        (y === currentYear && m === currentMonth - 1) ||
        (y === currentYear - 1 && currentMonth === 0 && m === 11)
      ) {
        catTotals[tx.categoryId].past1 += tx.amount;
      } else if (
        (y === currentYear && m === currentMonth - 2) ||
        (y === currentYear - 1 && currentMonth === 0 && m === 10) ||
        (y === currentYear - 1 && currentMonth === 1 && m === 11)
      ) {
        catTotals[tx.categoryId].past2 += tx.amount;
      }
    }

    // Evaluar anomalías
    for (const cat of categories) {
      const data = catTotals[cat.id];
      if (!data) continue;

      const avgPast = (data.past1 + data.past2) / 2;

      // Si el promedio pasado es > 50,000 COP y en este mes ya llevamos más del 180% del promedio
      if (avgPast > 50000 && data.current > avgPast * 1.8) {
        const percent = Math.round((data.current / avgPast) * 100);
        const alertId = `spike:${cat.id}:${currentYear}-${currentMonth}`;
        alerts.push({
          id: alertId,
          type: 'spike',
          title: 'Alerta de Gasto Inusual',
          message: `¡Alerta de Gasto Inusual! Este mes has gastado **$${data.current.toLocaleString('es-CO')}** en **${cat.name}**, lo que representa un **${percent}%** de tu promedio histórico. Considera frenar el consumo en esta categoría.`,
          actionLabel: 'Ver Movimientos',
          actionRoute: '/(tabs)/transactions',
          categoryId: cat.id,
        });
      }
    }

    return alerts;
  }
}
