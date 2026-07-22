/**
 * ZenMoney — AnomalyDetectorService
 *
 * Motor de análisis pasivo que escanea las transacciones recientes para detectar
 * suscripciones no registradas, cobros duplicados, y picos de gasto inusuales.
 */

import { Transaction } from '@/src/domain/entities/Transaction';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { HybridCategoryRepository } from '@/src/data/repositories/HybridCategoryRepository';

export class AnomalyDetectorService {
  private txRepo = new HybridTransactionRepository();
  private catRepo = new HybridCategoryRepository();

  async scanForAnomalies(): Promise<string[]> {
    const alerts: string[] = [];
    try {
      const now = new Date();
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(now.getDate() - 90);
      const startDate = ninetyDaysAgo.toISOString().split('T')[0];

      const txs = await this.txRepo.getAll({ startDate });
      const expenses = txs.filter(tx => tx.type === 'expense' && tx.status === 'confirmed');

      const duplicates = this.detectDuplicates(expenses);
      if (duplicates.length > 0) {
        alerts.push(...duplicates);
      }

      const subscriptions = this.detectHiddenSubscriptions(expenses);
      if (subscriptions.length > 0) {
        alerts.push(...subscriptions);
      }

      const spikes = await this.detectSpikes(expenses);
      if (spikes.length > 0) {
        alerts.push(...spikes);
      }

    } catch (err) {
      console.error('[AnomalyDetectorService] Error scanning anomalies:', err);
    }
    return alerts;
  }

  private detectDuplicates(expenses: Transaction[]): string[] {
    const alerts: string[] = [];
    const recent = expenses.filter(tx => {
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
          const key = `${tx1.amount}-${tx1.transactionDate}`;
          if (!seen.has(key)) {
            seen.add(key);
            alerts.push(`He detectado dos cobros idénticos por **$${tx1.amount.toLocaleString('es-CO')}** el ${tx1.transactionDate} en **${tx1.merchantName || tx1.description || 'un comercio'}**. Podría ser un cobro duplicado por error del banco o comercio. Revisa tu extracto.`);
          }
        }
      }
    }
    return alerts;
  }

  private detectHiddenSubscriptions(expenses: Transaction[]): string[] {
    const alerts: string[] = [];
    
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
        const alreadyRecurring = group.some(tx => tx.isRecurringInstance || tx.recurringRuleId);
        if (!alreadyRecurring) {
          const name = group[0].merchantName || group[0].description;
          alerts.push(`Noté un patrón: Has pagado **$${group[0].amount.toLocaleString('es-CO')}** en **${name}** consistentemente en los últimos 3 meses. ¿Es una suscripción? Te sugiero agregarla a tus Facturas Agendadas para que ZenMoney la presupueste automáticamente.`);
        }
      }
    }

    return alerts;
  }

  private async detectSpikes(expenses: Transaction[]): Promise<string[]> {
    const alerts: string[] = [];
    const categories = await this.catRepo.getAll(true);
    
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const catTotals: Record<string, { current: number, past1: number, past2: number }> = {};

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
        alerts.push(`¡Alerta de Gasto Inusual! Este mes has gastado **$${data.current.toLocaleString('es-CO')}** en **${cat.name}**, lo que representa un **${percent}%** de tu promedio histórico. Considera frenar el consumo en esta categoría.`);
      }
    }

    return alerts;
  }
}
