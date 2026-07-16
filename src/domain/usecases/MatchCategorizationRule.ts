/**
 * ZenMoney — Caso de Uso: MatchCategorizationRule
 *
 * Busca, entre las reglas ya aprendidas de la familia, cuál categoría
 * corresponde a un comercio dado. Una regla explícita (fruto de una
 * corrección del usuario) siempre debe ganarle a la adivinanza de la IA.
 */

import { CategorizationRule } from '../entities/CategorizationRule';

export class MatchCategorizationRule {
  /**
   * @returns el categoryId de la mejor regla que coincide con el comercio, o null si ninguna aplica.
   */
  execute(merchantName: string, rules: CategorizationRule[]): string | null {
    const normalizedMerchant = merchantName.trim().toLowerCase();
    if (!normalizedMerchant) return null;

    const matches = rules.filter((rule) => {
      const pattern = rule.matchPattern.trim().toLowerCase();
      if (!pattern) return false;
      return normalizedMerchant.includes(pattern) || pattern.includes(normalizedMerchant);
    });

    if (matches.length === 0) return null;

    matches.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.matchPattern.length - a.matchPattern.length; // patrón más específico primero
    });

    return matches[0].categoryId;
  }
}
