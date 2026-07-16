/**
 * ZenMoney — Entidad CategorizationRule
 *
 * Regla patrón→categoría para no repetir el mismo error de categorización.
 * Se crea/actualiza automáticamente cuando el usuario corrige la categoría
 * que la IA sugirió para un comercio.
 */

export interface CategorizationRule {
  id: string;
  familyGroupId: string;
  matchPattern: string;
  categoryId: string;
  priority: number;
  isAiGenerated: boolean;
  createdAt: string;
}

export interface CreateCategorizationRuleInput {
  matchPattern: string;
  categoryId: string;
  priority?: number;
  isAiGenerated?: boolean;
}
