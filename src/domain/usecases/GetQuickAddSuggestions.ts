/**
 * ZenMoney — Caso de Uso: GetQuickAddSuggestions
 *
 * Deriva atajos de registro rápido a partir del historial de transacciones
 * ya existente, sin necesidad de tablas ni reglas adicionales:
 * - Última transacción registrada (para "repetir").
 * - Comercios recientes por cuenta (para chips de un toque).
 * - Categoría más frecuente por comercio (para autocompletar al elegir un comercio).
 */

import { Transaction } from '../entities/Transaction';
import { TransactionRepository } from '../repositories/TransactionRepository';

export interface QuickAddSuggestions {
  lastTransaction: Transaction | null;
  /** accountId -> comercios recientes, más reciente primero */
  recentMerchantsByAccount: Record<string, string[]>;
  /** comercio en minúsculas -> categoryId más frecuente para ese comercio */
  topCategoryByMerchant: Record<string, string>;
}

const HISTORY_SIZE = 60;
const MAX_MERCHANTS_PER_ACCOUNT = 8;

export class GetQuickAddSuggestions {
  constructor(private transactionRepository: TransactionRepository) {}

  async execute(): Promise<QuickAddSuggestions> {
    const recent = await this.transactionRepository.getAll({
      status: 'confirmed',
      limit: HISTORY_SIZE,
    });

    const lastTransaction = recent[0] ?? null;

    const recentMerchantsByAccount: Record<string, string[]> = {};
    const merchantCategoryCounts: Record<string, Record<string, number>> = {};

    for (const tx of recent) {
      if (tx.type !== 'expense' || !tx.merchantName) continue;
      const merchant = tx.merchantName.trim();
      if (!merchant) continue;

      const seenForAccount = recentMerchantsByAccount[tx.accountId] ?? (recentMerchantsByAccount[tx.accountId] = []);
      const alreadySeen = seenForAccount.some((m) => m.toLowerCase() === merchant.toLowerCase());
      if (!alreadySeen && seenForAccount.length < MAX_MERCHANTS_PER_ACCOUNT) {
        seenForAccount.push(merchant);
      }

      if (tx.categoryId) {
        const key = merchant.toLowerCase();
        const counts = merchantCategoryCounts[key] ?? (merchantCategoryCounts[key] = {});
        counts[tx.categoryId] = (counts[tx.categoryId] ?? 0) + 1;
      }
    }

    const topCategoryByMerchant: Record<string, string> = {};
    for (const [merchant, counts] of Object.entries(merchantCategoryCounts)) {
      let bestCategoryId = '';
      let bestCount = 0;
      for (const [categoryId, count] of Object.entries(counts)) {
        if (count > bestCount) {
          bestCategoryId = categoryId;
          bestCount = count;
        }
      }
      if (bestCategoryId) topCategoryByMerchant[merchant] = bestCategoryId;
    }

    return { lastTransaction, recentMerchantsByAccount, topCategoryByMerchant };
  }
}
