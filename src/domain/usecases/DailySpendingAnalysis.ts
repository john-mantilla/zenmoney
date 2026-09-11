/**
 * ZenMoney — Caso de Uso: DailySpendingAnalysis
 *
 * Agrupa y procesa transacciones para generar métricas diarias de gastos,
 * distribuciones por día de la semana (Lunes a Domingo) y detección de patrones
 * de consumo (ej. concentración de gastos en fines de semana).
 */

import { Transaction } from '../entities/Transaction';
import { Category } from '../entities/Category';

export interface DayCategorySpending {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  amount: number;
}

export interface DailySpendingPoint {
  day: number;
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 = Domingo, 1 = Lunes, etc.
  dayName: string; // 'Lun', 'Mar', etc.
  isWeekend: boolean;
  total: number;
  categories: DayCategorySpending[];
}

export interface WeekdaySpendingPoint {
  dayIndex: number; // 0 = Domingo, 1 = Lunes ... 6 = Sábado
  name: string; // 'Lunes', 'Martes', etc.
  shortName: string; // 'Lun', 'Mar', etc.
  total: number;
  count: number;
  average: number;
  isWeekend: boolean;
}

export interface DailySpendingAnalysisResult {
  dailyPoints: DailySpendingPoint[];
  weekdayPoints: WeekdaySpendingPoint[];
  totalSpending: number;
  weekendSpending: number;
  weekendPercentage: number;
  weekdaySpending: number;
  weekdayPercentage: number;
  maxSpendingDay: DailySpendingPoint | null;
  insightMessage: string;
  topWeekendCategory: string | null;
}

const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export class DailySpendingAnalysis {
  static execute(
    transactions: Transaction[],
    categories: Category[],
    year: number,
    month: number, // 1-12
    selectedCategoryId?: string | null
  ): DailySpendingAnalysisResult {
    // 1. Número de días en el mes especificado
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthStr = String(month).padStart(2, '0');

    // 2. Mapa de categorías para resolución rápida
    const catMap = new Map<string, Category>();
    categories.forEach(c => catMap.set(c.id, c));

    // 3. Filtrar gastos confirmados para el mes y categoría seleccionada
    const relevantExpenses = transactions.filter(tx => {
      if (tx.status !== 'confirmed' || tx.type !== 'expense') return false;
      if (!tx.transactionDate.startsWith(`${year}-${monthStr}`)) return false;
      
      if (selectedCategoryId) {
        if (tx.categoryId === selectedCategoryId) return true;
        // Si la categoría seleccionada es padre, incluir también sus subcategorías
        const txCat = catMap.get(tx.categoryId || '');
        if (txCat?.parentCategoryId === selectedCategoryId) return true;
        return false;
      }
      return true;
    });

    // 4. Inicializar los puntos diarios del 1 al daysInMonth
    const dailyMap = new Map<number, DailySpendingPoint>();
    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(year, month - 1, d);
      const dayOfWeek = dayDate.getDay(); // 0 = Domingo, 6 = Sábado
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;

      dailyMap.set(d, {
        day: d,
        dateStr,
        dayOfWeek,
        dayName: WEEKDAY_SHORT[dayOfWeek],
        isWeekend,
        total: 0,
        categories: [],
      });
    }

    // 5. Agrupar gastos en los días correspondientes
    const weekendCatTotals: Record<string, number> = {};

    for (const tx of relevantExpenses) {
      const parts = tx.transactionDate.split('-');
      const dayNum = parseInt(parts[2], 10);
      const point = dailyMap.get(dayNum);
      if (!point) continue;

      const amount = Number(tx.amount);
      point.total += amount;

      // Resolver nombre e icono de categoría
      const cat = tx.categoryId ? catMap.get(tx.categoryId) : null;
      let catName = 'Sin categoría';
      let catColor = '#9E9E9E';
      let catIcon = 'tag-outline';

      if (cat) {
        catName = cat.name;
        catColor = cat.color || '#4CAF50';
        catIcon = cat.icon || 'tag';
      }

      const existingCat = point.categories.find(c => c.categoryId === (tx.categoryId || 'none'));
      if (existingCat) {
        existingCat.amount += amount;
      } else {
        point.categories.push({
          categoryId: tx.categoryId || 'none',
          name: catName,
          color: catColor,
          icon: catIcon,
          amount,
        });
      }

      // Si es fin de semana, sumar para calcular la categoría dominante
      if (point.isWeekend) {
        weekendCatTotals[catName] = (weekendCatTotals[catName] || 0) + amount;
      }
    }

    // Ordenar categorías internas de cada día por monto descendente
    dailyMap.forEach(point => {
      point.categories.sort((a, b) => b.amount - a.amount);
    });

    const dailyPoints = Array.from(dailyMap.values());

    // 6. Calcular métricas por día de la semana (Lunes a Domingo)
    // Ordenamos de Lunes (1) a Domingo (0)
    const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
    const weekdayStats: Record<number, { total: number; count: number }> = {
      0: { total: 0, count: 0 },
      1: { total: 0, count: 0 },
      2: { total: 0, count: 0 },
      3: { total: 0, count: 0 },
      4: { total: 0, count: 0 },
      5: { total: 0, count: 0 },
      6: { total: 0, count: 0 },
    };

    dailyPoints.forEach(p => {
      weekdayStats[p.dayOfWeek].total += p.total;
      weekdayStats[p.dayOfWeek].count += 1;
    });

    const weekdayPoints: WeekdaySpendingPoint[] = weekdayOrder.map(idx => {
      const stats = weekdayStats[idx];
      const avg = stats.count > 0 ? Math.round(stats.total / stats.count) : 0;
      return {
        dayIndex: idx,
        name: WEEKDAY_NAMES[idx],
        shortName: WEEKDAY_SHORT[idx],
        total: stats.total,
        count: stats.count,
        average: avg,
        isWeekend: idx === 0 || idx === 6,
      };
    });

    // 7. Totales y porcentajes
    const totalSpending = dailyPoints.reduce((sum, p) => sum + p.total, 0);
    const weekendSpending = dailyPoints.filter(p => p.isWeekend).reduce((sum, p) => sum + p.total, 0);
    const weekdaySpending = totalSpending - weekendSpending;

    const weekendPercentage = totalSpending > 0 ? Math.round((weekendSpending / totalSpending) * 100) : 0;
    const weekdayPercentage = totalSpending > 0 ? 100 - weekendPercentage : 0;

    // 8. Día de mayor gasto
    let maxSpendingDay: DailySpendingPoint | null = null;
    let maxAmount = 0;
    for (const p of dailyPoints) {
      if (p.total > maxAmount) {
        maxAmount = p.total;
        maxSpendingDay = p;
      }
    }

    // 9. Categoría de mayor gasto en fines de semana
    let topWeekendCategory: string | null = null;
    let maxWeekendCatAmount = 0;
    Object.entries(weekendCatTotals).forEach(([cName, amt]) => {
      if (amt > maxWeekendCatAmount) {
        maxWeekendCatAmount = amt;
        topWeekendCategory = cName;
      }
    });

    // 10. Insight inteligente de patrón
    let insightMessage = '';
    if (totalSpending === 0) {
      insightMessage = 'No hay suficientes movimientos de gasto registrados en este mes.';
    } else if (weekendPercentage >= 40) {
      insightMessage = `Tus gastos se concentran fuertemente los fines de semana (${weekendPercentage}% del mes)${
        topWeekendCategory ? `, liderados principalmente por ${topWeekendCategory}` : ''
      }.`;
    } else if (weekendPercentage <= 20) {
      insightMessage = `Tu patrón de consumo es más activo entre semana (${weekdayPercentage}% del mes), manteniendo un gasto moderado en fines de semana.`;
    } else {
      insightMessage = `Tu consumo mensual mantiene un balance regular entre días laborales (${weekdayPercentage}%) y fines de semana (${weekendPercentage}%).`;
    }

    return {
      dailyPoints,
      weekdayPoints,
      totalSpending,
      weekendSpending,
      weekendPercentage,
      weekdaySpending,
      weekdayPercentage,
      maxSpendingDay,
      insightMessage,
      topWeekendCategory,
    };
  }
}
