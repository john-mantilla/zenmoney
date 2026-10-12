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
import { DetectHabitPatterns } from '@/src/domain/usecases/DetectHabitPatterns';
import { useHabitStore } from '@/src/infrastructure/state/habitStore';
import { HabitPattern } from '@/src/domain/entities/HabitPattern';

const DISMISSED_ALERTS_KEY = 'zenmoney:dismissed_smart_alerts';

export interface SmartAlert {
  id: string; // Firma única para deduplicación y persistencia de descarte
  type: 'duplicate' | 'subscription' | 'spike' | 'habit';
  title: string;
  message: string;
  actionLabel?: string;
  actionRoute?: string;
  actionParams?: Record<string, any>;
  categoryId?: string;
  habitData?: Partial<HabitPattern>;
}

export class AnomalyDetectorService {
  private txRepo = new HybridTransactionRepository();
  private catRepo = new HybridCategoryRepository();

  /**
   * Escanea anomalías activas y filtra aquellas que el usuario ya haya descartado.
   */
  async scanForAnomalies(preferCache = true): Promise<SmartAlert[]> {
    const rawAlerts: SmartAlert[] = [];
    try {
      const now = new Date();
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(now.getDate() - 90);
      const startDate = ninetyDaysAgo.toISOString().split('T')[0];

      const txs = await this.txRepo.getAll({ startDate }, preferCache);
      const expenses = txs.filter((tx) => tx.type === 'expense' && tx.status === 'confirmed');

      const duplicates = this.detectDuplicates(expenses);
      rawAlerts.push(...duplicates);

      const subscriptions = this.detectHiddenSubscriptions(expenses);
      rawAlerts.push(...subscriptions);

      const habits = this.detectLifestyleHabits(expenses, subscriptions);
      rawAlerts.push(...habits);

      const spikes = await this.detectSpikes(expenses, preferCache);
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
      // Si hay 3 o más pagos idénticos en los últimos 90 días, es un patrón consistente
      if (group.length >= 3) {
        // Verificar si ya es una suscripción conocida (isRecurringInstance)
        const alreadyRecurring = group.some((tx) => tx.isRecurringInstance || tx.recurringRuleId);
        if (!alreadyRecurring) {
          const sample = group[0];
          const name = sample.merchantName || sample.description || 'Comercio';
          const alertId = `subscription:${name.toLowerCase()}:${sample.amount}`;

          // Calcular día de la semana más común en este grupo
          const dayCounts: Record<number, number> = {};
          for (const tx of group) {
            const d = new Date(`${tx.transactionDate.split('T')[0]}T12:00:00`).getDay();
            dayCounts[d] = (dayCounts[d] || 0) + 1;
          }
          let mostCommonDay = 3; // Por defecto miércoles
          let maxCount = 0;
          for (const dStr in dayCounts) {
            const dayNum = Number(dStr);
            if (dayCounts[dayNum] > maxCount) {
              maxCount = dayCounts[dayNum];
              mostCommonDay = dayNum;
            }
          }

          alerts.push({
            id: alertId,
            type: 'subscription',
            title: 'Patrón Recurrente Detectado',
            message: `Noté un patrón: Has pagado **$${sample.amount.toLocaleString('es-CO')}** en **${name}** consistentemente en los últimos 3 meses. ¿Es una suscripción/factura mensual o un hábito de rutina familiar?`,
            actionLabel: 'Agendar Factura',
            actionRoute: '/settings/recurrences',
            habitData: {
              title: `${name}`,
              dayOfWeek: mostCommonDay,
              timePrompt: '21:00',
              estimatedAmount: sample.amount,
              merchantName: name,
              defaultAccountId: sample.accountId,
              defaultCategoryId: sample.categoryId,
              confidenceScore: 0.9,
              icon: name.toLowerCase().includes('pizza') || name.toLowerCase().includes('domino') ? 'pizza' : 'repeat',
            },
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Detecta patrones de hábitos de vida frecuentes (ZenHabits) que aún no estén agregados.
   */
  private detectLifestyleHabits(expenses: Transaction[], subscriptionAlerts: SmartAlert[] = []): SmartAlert[] {
    const alerts: SmartAlert[] = [];
    const detectedPatterns = DetectHabitPatterns.execute(expenses);
    const existingHabits = useHabitStore.getState().habits;

    const subscriptionMerchants = new Set(
      subscriptionAlerts
        .map((s) => (s.habitData?.merchantName || '').toLowerCase().trim())
        .filter(Boolean)
    );

    const dayNames = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

    for (const pattern of detectedPatterns) {
      const merchant = pattern.merchantName || pattern.title;
      const merchantLower = merchant.toLowerCase().trim();

      // Si ya hay una alerta de suscripción para este comercio, no duplicar alerta
      if (subscriptionMerchants.has(merchantLower)) {
        continue;
      }

      // Verificar si ya existe este hábito guardado en ZenHabits
      const alreadySaved = existingHabits.some(
        (h) =>
          h.dayOfWeek === pattern.dayOfWeek &&
          (h.merchantName?.toLowerCase() === pattern.merchantName?.toLowerCase() ||
           h.title.toLowerCase() === pattern.title.toLowerCase())
      );

      if (!alreadySaved) {
        const dayStr = dayNames[pattern.dayOfWeek] || 'este día';
        const alertId = `habit:${merchant.toLowerCase()}:${pattern.dayOfWeek}`;

        alerts.push({
          id: alertId,
          type: 'habit',
          title: 'ZenHabits — Hábitos y Rutinas',
          message: `Noté una rutina familiar: Sueles gastar aprox. **$${pattern.estimatedAmount.toLocaleString('es-CO')}** en **${merchant}** los **${dayStr}**. ¿Quieres activar este hábito para recordarte registrarlo automáticamente por la noche si se te pasa?`,
          actionLabel: 'Activar Hábito',
          habitData: pattern,
        });
      }
    }

    return alerts;
  }

  private async detectSpikes(expenses: Transaction[], preferCache = true): Promise<SmartAlert[]> {
    const alerts: SmartAlert[] = [];
    const categories = await this.catRepo.getAll(true, preferCache);

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
