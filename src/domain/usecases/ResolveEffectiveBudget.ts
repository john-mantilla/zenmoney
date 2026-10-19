/**
 * ZenMoney — ResolveEffectiveBudget UseCase
 *
 * Resuelve el presupuesto efectivo aplicable para una categoría y mes específicos (año, mes),
 * gestionando la regla maestra recurrente y los límites extraordinarios puntuales (Budget Override).
 *
 * Reglas de Negocio:
 * 1. Anulación Específica (Override): Si existe un registro explícito para (year, month) con isOverride === true,
 *    este prevalece sobre cualquier regla maestra.
 * 2. Regla Maestra Recurrente: Si no hay override para ese mes puntual, se toma el último presupuesto
 *    maestro histórico registrado (isOverride !== true) con fecha (year * 12 + month) <= mesObjetivo.
 * 3. Aislamiento Temporal: Un presupuesto con isOverride === true NUNCA se propaga hacia meses futuros.
 *    Al avanzar al mes siguiente (M+1), el sistema retoma de forma transparente la regla maestra.
 */

import { Budget, BudgetScope } from '../entities/Budget';

export interface ResolvedBudgetItem {
  budget: Budget;
  isOverride: boolean;
  overrideReason?: string;
  baseMasterBudget?: Budget | null;
}

export class ResolveEffectiveBudget {
  /**
   * Resuelve el presupuesto aplicable para todas las categorías en un mes específico.
   *
   * @param allBudgets Lista total de presupuestos del usuario/grupo familiar.
   * @param targetYear Año a evaluar (ej. 2026).
   * @param targetMonth Mes a evaluar (1 - 12).
   */
  static resolveAll(
    allBudgets: Budget[],
    targetYear: number,
    targetMonth: number
  ): ResolvedBudgetItem[] {
    const targetValue = targetYear * 12 + targetMonth;

    // Agrupar presupuestos por clave de categoría y ámbito
    const byKey: Record<string, Budget[]> = {};
    for (const b of allBudgets) {
      const key = `${b.categoryId}_${b.scope || 'family'}_${b.ownerUserId || 'family'}`;
      if (!byKey[key]) byKey[key] = [];
      byKey[key].push(b);
    }

    const results: ResolvedBudgetItem[] = [];

    for (const key in byKey) {
      const categoryBudgets = byKey[key];

      // 1. Buscar si hay un override puntual exacto para este mes
      const exactOverride = categoryBudgets.find(
        (b) => b.year === targetYear && b.month === targetMonth && b.isOverride === true
      );

      // 2. Buscar la regla maestra aplicable (último registro no-override con fecha <= targetValue)
      const masterBudgets = categoryBudgets
        .filter((b) => !b.isOverride && (b.year * 12 + b.month) <= targetValue)
        .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));

      const latestMaster = masterBudgets[0] || null;

      if (exactOverride) {
        results.push({
          budget: exactOverride,
          isOverride: true,
          overrideReason: exactOverride.overrideReason,
          baseMasterBudget: latestMaster,
        });
      } else if (latestMaster) {
        results.push({
          budget: latestMaster,
          isOverride: false,
          baseMasterBudget: latestMaster,
        });
      }
    }

    return results;
  }
}
