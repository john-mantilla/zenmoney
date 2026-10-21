/**
 * ZenMoney — TrendAnalysisUseCase
 *
 * Agrupa y procesa los datos históricos de los últimos 12 meses para
 * graficarlos en el dashboard de análisis.
 */

import { Transaction } from '@/src/domain/entities/Transaction';
import { Budget } from '@/src/domain/entities/Budget';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { HybridBudgetRepository } from '@/src/data/repositories/HybridBudgetRepository';
import { HybridCategoryRepository } from '@/src/data/repositories/HybridCategoryRepository';

export interface TrendDataPoint {
  label: string; // ej. "Jul", "Ago"
  income: number;
  expense: number;
  budget: number;
  fullDate: string; // YYYY-MM
}

export class TrendAnalysisUseCase {
  constructor(
    private transactionRepo: HybridTransactionRepository,
    private budgetRepo: HybridBudgetRepository,
    private categoryRepo?: HybridCategoryRepository
  ) {}

  async execute(currentUserId?: string | null): Promise<TrendDataPoint[]> {
    const today = new Date();
    
    // Preparar el arreglo de 12 meses hacia atrás
    const points: TrendDataPoint[] = [];
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1; // 1-12
      const monthLabel = monthNames[month - 1];
      
      points.push({
        label: monthLabel,
        income: 0,
        expense: 0,
        budget: 0,
        fullDate: `${year}-${String(month).padStart(2, '0')}`
      });
    }

    const startDate = `${points[0].fullDate}-01`;
    // Traer todas las transacciones de los últimos 12 meses (modo caché/local-first)
    const txs = await (this.transactionRepo as any).getAll({ startDate }, true);
    
    // Cargar todos los presupuestos para aplicar la regla de herencia temporal/carry-forward
    // (un presupuesto creado en un mes anterior sigue activo hasta que se actualice o elimine)
    const allBudgets = await (this.budgetRepo as any).getAll(true);
    let loadedCats: any[] = [];
    try {
      if (this.categoryRepo) {
        loadedCats = await (this.categoryRepo as any).getAll(true, true);
      }
    } catch {
      // Ignorar si categoryRepo no está disponible
    }

    for (const pt of points) {
      const [y, m] = pt.fullDate.split('-').map(Number);
      const targetValue = y * 12 + m;

      // Filtrar presupuestos activos hasta ese mes
      const pastBudgets = allBudgets.filter(
        (b) =>
          b.year * 12 + b.month <= targetValue &&
          (b.scope === 'family' || !b.ownerUserId || (currentUserId && b.ownerUserId === currentUserId))
      );

      // Obtener el registro más reciente por categoría / alcance
      const latestByKey: Record<string, Budget> = {};
      for (const b of pastBudgets) {
        const key = `${b.categoryId}_${b.scope || 'family'}_${b.ownerUserId || 'family'}`;
        const existing = latestByKey[key];
        if (!existing || existing.year * 12 + existing.month < b.year * 12 + b.month) {
          latestByKey[key] = b;
        }
      }

      const activeMonthlyBudgets = Object.values(latestByKey);

      // Calcular el límite total evitando duplicidad padre-hijo si existen subcategorías
      if (loadedCats.length > 0) {
        const parentGroups: Record<string, { parentBudgets: Budget[]; subBudgets: Budget[] }> = {};
        for (const b of activeMonthlyBudgets) {
          const cat = loadedCats.find((c) => c.id === b.categoryId);
          const isSub = !!cat?.parentCategoryId;
          const parentId = isSub ? cat!.parentCategoryId! : b.categoryId;

          if (!parentGroups[parentId]) {
            parentGroups[parentId] = { parentBudgets: [], subBudgets: [] };
          }
          if (isSub) {
            parentGroups[parentId].subBudgets.push(b);
          } else {
            parentGroups[parentId].parentBudgets.push(b);
          }
        }

        let totalMonthBudget = 0;
        for (const parentId in parentGroups) {
          const group = parentGroups[parentId];
          if (group.subBudgets.length > 0) {
            totalMonthBudget += group.parentBudgets[0]
              ? group.parentBudgets[0].amountLimit
              : group.subBudgets.reduce((sum, s) => sum + s.amountLimit, 0);
          } else if (group.parentBudgets[0]) {
            totalMonthBudget += group.parentBudgets[0].amountLimit;
          }
        }
        pt.budget = totalMonthBudget;
      } else {
        pt.budget = activeMonthlyBudgets.reduce((sum, b) => sum + b.amountLimit, 0);
      }
    }

    // Agregar transacciones
    for (const tx of txs) {
      if (tx.status !== 'confirmed') continue;
      
      const prefix = tx.transactionDate.substring(0, 7); // YYYY-MM
      const point = points.find(p => p.fullDate === prefix);
      if (point) {
        if (tx.type === 'income') point.income += tx.amount;
        if (tx.type === 'expense') point.expense += tx.amount;
      }
    }

    // Recortar meses iniciales sin datos para que la gráfica no se vea plana y vacía.
    // Buscamos el primer mes que tenga ingresos, gastos o presupuesto.
    let firstActiveIndex = points.findIndex(p => p.income > 0 || p.expense > 0 || p.budget > 0);
    
    // Si no hay datos en absoluto o solo en el último mes, mostramos al menos 6 meses por estética.
    if (firstActiveIndex === -1 || firstActiveIndex > 6) {
      firstActiveIndex = 6;
    }
    
    // Retornamos el subarreglo desde el primer mes con datos (o los últimos 6 meses)
    return points.slice(firstActiveIndex);
  }
}
