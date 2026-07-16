/**
 * ZenMoney — Caso de Uso: LearnCategorizationFromCorrection
 *
 * Cuando el usuario corrige la categoría que la IA (o una regla previa) había
 * sugerido para un comercio, se recuerda esa corrección: así el mismo error
 * no se repite la próxima vez, sin importar qué adivine el modelo ese día.
 */

import { CategorizationRule } from '../entities/CategorizationRule';
import { CategorizationRuleRepository } from '../repositories/CategorizationRuleRepository';

export interface LearnCategorizationInput {
  merchantName: string;
  correctedCategoryId: string;
  /** Reglas ya cargadas en memoria, para no repetir el fetch que ya hizo el formulario. */
  existingRules: CategorizationRule[];
}

export class LearnCategorizationFromCorrection {
  constructor(private repository: CategorizationRuleRepository) {}

  async execute(input: LearnCategorizationInput): Promise<CategorizationRule | null> {
    const pattern = input.merchantName.trim();
    if (!pattern) return null;

    const existing = input.existingRules.find(
      (rule) => rule.matchPattern.trim().toLowerCase() === pattern.toLowerCase()
    );

    if (existing) {
      if (existing.categoryId === input.correctedCategoryId) {
        return existing; // Ya aprendida, nada que hacer
      }
      return this.repository.update(existing.id, {
        categoryId: input.correctedCategoryId,
        isAiGenerated: false,
      });
    }

    return this.repository.create({
      matchPattern: pattern,
      categoryId: input.correctedCategoryId,
      priority: 10,
      isAiGenerated: false,
    });
  }
}
