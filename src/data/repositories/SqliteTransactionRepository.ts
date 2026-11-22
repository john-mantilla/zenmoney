import { TransactionRepository, TransactionFilters } from '@domain/repositories/TransactionRepository';
import { Transaction, CreateTransactionInput } from '@domain/entities/Transaction';
import { LocalDatabase } from '../local/LocalDatabase';
import { SqliteAccountRepository } from './SqliteAccountRepository';
import { getLocalDateString } from '../../infrastructure/utils/dateUtils';

export class SqliteTransactionRepository implements TransactionRepository {
  private accountRepo = new SqliteAccountRepository();

  private getDb() {
    return LocalDatabase.getDb();
  }

  async getById(id: string): Promise<Transaction | null> {
    const db = this.getDb();
    const row = await db.getFirstAsync<any>('SELECT * FROM transactions WHERE id = ?;', [id]);
    if (!row) return null;
    const tx = this.toDomain(row);
    await this.attachTags([tx]);
    return tx;
  }

  async getAll(filters?: TransactionFilters): Promise<Transaction[]> {
    const db = this.getDb();
    let query = 'SELECT * FROM transactions';
    const params: any[] = [];
    const conditions: string[] = [];

    if (filters) {
      if (filters.accountId) {
        conditions.push('(account_id = ? OR transfer_to_account_id = ?)');
        params.push(filters.accountId, filters.accountId);
      }
      if (filters.categoryId) {
        conditions.push('category_id = ?');
        params.push(filters.categoryId);
      }
      if (filters.tagId) {
        conditions.push('id IN (SELECT transaction_id FROM transaction_tags WHERE tag_id = ?)');
        params.push(filters.tagId);
      }
      if (filters.tagIds && filters.tagIds.length > 0) {
        const placeholders = filters.tagIds.map(() => '?').join(',');
        conditions.push(`id IN (SELECT transaction_id FROM transaction_tags WHERE tag_id IN (${placeholders}))`);
        params.push(...filters.tagIds);
      }
      if (filters.type) {
        conditions.push('type = ?');
        params.push(filters.type);
      }
      if (filters.status) {
        conditions.push('status = ?');
        params.push(filters.status);
      }
      if (filters.inputMethod) {
        conditions.push('input_method = ?');
        params.push(filters.inputMethod);
      }
      if (filters.recurringRuleId) {
        conditions.push('recurring_rule_id = ?');
        params.push(filters.recurringRuleId);
      }
      if (filters.startDate && filters.endDate) {
        if (filters.includeAmortizations) {
          conditions.push('((transaction_date >= ? AND transaction_date <= ?) OR ai_metadata LIKE "%period_split%" OR ai_metadata LIKE "%periodSplit%")');
        } else {
          conditions.push('transaction_date >= ? AND transaction_date <= ?');
        }
        params.push(filters.startDate, filters.endDate);
      } else {
        if (filters.startDate) {
          if (filters.includeAmortizations) {
            conditions.push('(transaction_date >= ? OR ai_metadata LIKE "%period_split%" OR ai_metadata LIKE "%periodSplit%")');
          } else {
            conditions.push('transaction_date >= ?');
          }
          params.push(filters.startDate);
        }
        if (filters.endDate) {
          if (filters.includeAmortizations) {
            conditions.push('(transaction_date <= ? OR ai_metadata LIKE "%period_split%" OR ai_metadata LIKE "%periodSplit%")');
          } else {
            conditions.push('transaction_date <= ?');
          }
          params.push(filters.endDate);
        }
      }
      if (filters.updatedAfter) {
        conditions.push('updated_at > ?');
        params.push(filters.updatedAfter);
      }
      if (filters.search && filters.search.trim()) {
        const term = `%${filters.search.trim()}%`;
        conditions.push('(description LIKE ? OR merchant_name LIKE ?)');
        params.push(term, term);
      }
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Orden descendente por defecto
    query += ' ORDER BY transaction_date DESC, created_at DESC';

    if (filters) {
      if (filters.offset !== undefined && filters.limit !== undefined) {
        query += ' LIMIT ? OFFSET ?';
        params.push(filters.limit, filters.offset);
      } else if (filters.limit !== undefined) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }
    }

    const rows = await db.getAllAsync<any>(query, params);
    const transactions = rows.map(this.toDomain).filter(tx => {
      if (filters?.includeAmortizations && tx.periodSplit && (filters?.startDate || filters?.endDate)) {
        const txStartMonth = tx.periodSplit.startMonth;
        const txEndMonth = tx.periodSplit.endMonth;
        const fStartMonth = filters.startDate ? filters.startDate.substring(0, 7) : txStartMonth;
        const fEndMonth = filters.endDate ? filters.endDate.substring(0, 7) : txEndMonth;
        if (txStartMonth > fEndMonth || txEndMonth < fStartMonth) {
          return false;
        }
      }
      return true;
    });

    if (transactions.length > 0) {
      await this.attachTags(transactions);
    }

    return transactions;
  }

  async create(input: CreateTransactionInput): Promise<Transaction> {
    const db = this.getDb();
    const id = (input as any).id || Math.random().toString(36).substring(2, 15);
    const familyGroupId = (input as any).familyGroupId || 'offline-family';
    const createdByUserId = (input as any).createdByUserId || 'offline-user';
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;
    const synced = (input as any).synced !== undefined ? ((input as any).synced ? 1 : 0) : 0;

    const transactionDate = input.transactionDate || getLocalDateString();
    const status = (input as any).status || 'confirmed';

    await db.runAsync(
      `INSERT INTO transactions (
        id, family_group_id, account_id, category_id, created_by_user_id,
        type, amount, currency, description, merchant_name,
        transaction_date, transfer_to_account_id, is_recurring_instance,
        recurring_rule_id, status, input_method, ai_metadata, is_private,
        synced, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        familyGroupId,
        input.accountId,
        input.categoryId || null,
        createdByUserId,
        input.type,
        input.amount,
        input.currency || 'COP',
        input.description || null,
        input.merchantName || null,
        transactionDate,
        input.transferToAccountId || null,
        (input as any).isRecurringInstance ? 1 : 0,
        (input as any).recurringRuleId || null,
        status,
        input.inputMethod || 'manual',
        input.aiMetadata ? JSON.stringify(input.aiMetadata) : null,
        input.isPrivate ? 1 : 0,
        synced,
        createdAt,
        updatedAt
      ]
    );

    // Guardar etiquetas asociadas en la tabla relacional transaction_tags
    if (input.tags && input.tags.length > 0) {
      for (const tagId of input.tags) {
        await db.runAsync(
          'INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?);',
          [id, tagId]
        );
      }
    }

    // Ledger Atómico: si la transacción está confirmada, recalcular saldo de cuentas afectadas
    if (status === 'confirmed') {
      const affected = [input.accountId, input.transferToAccountId].filter(Boolean) as string[];
      await this.accountRepo.recalculateBalances(affected);
    }

    const createdTx: Transaction = {
      id,
      familyGroupId,
      accountId: input.accountId,
      categoryId: input.categoryId || null,
      createdByUserId,
      type: input.type,
      amount: input.amount,
      currency: input.currency || 'COP',
      description: input.description || null,
      merchantName: input.merchantName || null,
      transactionDate,
      transferToAccountId: input.transferToAccountId || null,
      isRecurringInstance: (input as any).isRecurringInstance || false,
      recurringRuleId: (input as any).recurringRuleId || null,
      status: status as any,
      inputMethod: (input.inputMethod || 'manual') as any,
      aiMetadata: input.aiMetadata || null,
      isPrivate: input.isPrivate || false,
      createdAt,
      updatedAt,
      syncedAt: null
    };

    await this.attachTags([createdTx]);
    return createdTx;
  }

  async update(id: string, data: Partial<CreateTransactionInput>): Promise<Transaction> {
    const db = this.getDb();
    let existing = await this.getById(id);
    if (!existing) {
      if (data.accountId && data.amount !== undefined && data.type) {
        return this.create({
          ...(data as any),
          id,
          synced: (data as any).synced !== undefined ? (data as any).synced : false,
        });
      }
      throw new Error(`Transacción no encontrada: ${id}`);
    }

    const accountId = data.accountId !== undefined ? data.accountId : existing.accountId;
    const categoryId = data.categoryId !== undefined ? data.categoryId : existing.categoryId;
    const type = data.type !== undefined ? data.type : existing.type;
    const amount = data.amount !== undefined ? data.amount : existing.amount;
    const currency = data.currency !== undefined ? data.currency : existing.currency;
    const description = data.description !== undefined ? data.description : existing.description;
    const merchantName = data.merchantName !== undefined ? data.merchantName : existing.merchantName;
    const transactionDate = data.transactionDate !== undefined ? data.transactionDate : existing.transactionDate;
    const transferToAccountId = data.transferToAccountId !== undefined ? data.transferToAccountId : existing.transferToAccountId;
    const isRecurringInstance = (data as any).isRecurringInstance !== undefined ? (data as any).isRecurringInstance : (existing as any).isRecurringInstance;
    const recurringRuleId = (data as any).recurringRuleId !== undefined ? (data as any).recurringRuleId : (existing as any).recurringRuleId;
    const status = (data as any).status !== undefined ? (data as any).status : existing.status;
    const inputMethod = data.inputMethod !== undefined ? data.inputMethod : existing.inputMethod;
    const aiMetadata = data.aiMetadata !== undefined ? data.aiMetadata : existing.aiMetadata;
    const isPrivate = data.isPrivate !== undefined ? data.isPrivate : existing.isPrivate;
    const updatedAt = new Date().toISOString();
    const synced = (data as any).synced !== undefined ? ((data as any).synced ? 1 : 0) : 0;

    await db.runAsync(
      `UPDATE transactions SET
        account_id = ?, category_id = ?, type = ?, amount = ?, currency = ?,
        description = ?, merchant_name = ?, transaction_date = ?, transfer_to_account_id = ?,
        is_recurring_instance = ?, recurring_rule_id = ?, status = ?, input_method = ?,
        ai_metadata = ?, is_private = ?, synced = ?, updated_at = ?
       WHERE id = ?;`,
      [
        accountId,
        categoryId || null,
        type,
        amount,
        currency || 'COP',
        description || null,
        merchantName || null,
        transactionDate,
        transferToAccountId || null,
        isRecurringInstance ? 1 : 0,
        recurringRuleId || null,
        status,
        inputMethod,
        aiMetadata ? JSON.stringify(aiMetadata) : null,
        isPrivate ? 1 : 0,
        synced,
        updatedAt,
        id
      ]
    );

    if (data.tags !== undefined) {
      await db.runAsync('DELETE FROM transaction_tags WHERE transaction_id = ?;', [id]);
      if (data.tags.length > 0) {
        for (const tagId of data.tags) {
          await db.runAsync('INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?);', [id, tagId]);
        }
      }
    }

    // Ledger Atómico: recalcular cuentas afectadas si hubo o hay transacciones confirmadas
    const affectedAccounts = new Set<string>();
    if (existing.status === 'confirmed') {
      if (existing.accountId) affectedAccounts.add(existing.accountId);
      if (existing.transferToAccountId) affectedAccounts.add(existing.transferToAccountId);
    }
    if (status === 'confirmed') {
      if (accountId) affectedAccounts.add(accountId);
      if (transferToAccountId) affectedAccounts.add(transferToAccountId);
    }
    if (affectedAccounts.size > 0) {
      await this.accountRepo.recalculateBalances(Array.from(affectedAccounts));
    }

    const updatedTx: Transaction = {
      ...existing,
      accountId,
      categoryId: categoryId || null,
      type,
      amount,
      currency: currency || 'COP',
      description: description || null,
      merchantName: merchantName || null,
      transactionDate,
      transferToAccountId: transferToAccountId || null,
      isRecurringInstance,
      recurringRuleId: recurringRuleId || null,
      status,
      inputMethod,
      aiMetadata,
      isPrivate,
      updatedAt,
      syncedAt: null
    };

    await this.attachTags([updatedTx]);
    return updatedTx;
  }

  async delete(id: string): Promise<void> {
    const db = this.getDb();
    const existing = await this.getById(id);
    await db.runAsync('DELETE FROM transactions WHERE id = ?;', [id]);
    await db.runAsync('DELETE FROM transaction_tags WHERE transaction_id = ?;', [id]);
    if (existing && existing.status === 'confirmed') {
      const affected = [existing.accountId, existing.transferToAccountId].filter(Boolean) as string[];
      await this.accountRepo.recalculateBalances(affected);
    }
  }

  async getByDateRange(startDate: string, endDate: string): Promise<Transaction[]> {
    return this.getAll({ startDate, endDate });
  }

  async getTotalByType(type: Transaction['type'], startDate: string, endDate: string): Promise<number> {
    const db = this.getDb();
    const row = await db.getFirstAsync<any>(
      `SELECT SUM(amount) as total FROM transactions
       WHERE type = ? AND status = 'confirmed' AND transaction_date >= ? AND transaction_date <= ?;`,
      [type, startDate, endDate]
    );
    return row?.total || 0;
  }

  async bulkSave(transactions: Transaction[]): Promise<void> {
    if (!transactions || transactions.length === 0) return;
    const db = this.getDb();
    const nowIso = new Date().toISOString();

    const runInserts = async () => {
      for (const tx of transactions) {
        try {
          await db.runAsync(
            `INSERT OR REPLACE INTO transactions (
              id, family_group_id, account_id, category_id, created_by_user_id,
              type, amount, currency, description, merchant_name,
              transaction_date, transfer_to_account_id, is_recurring_instance,
              recurring_rule_id, status, input_method, ai_metadata, is_private,
              synced, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              tx.id,
              tx.familyGroupId || 'offline-family',
              tx.accountId,
              tx.categoryId || null,
              tx.createdByUserId || 'offline-user',
              tx.type,
              tx.amount,
              tx.currency || 'COP',
              tx.description || null,
              tx.merchantName || null,
              tx.transactionDate,
              tx.transferToAccountId || null,
              tx.isRecurringInstance ? 1 : 0,
              tx.recurringRuleId || null,
              tx.status || 'confirmed',
              tx.inputMethod || 'manual',
              tx.aiMetadata ? JSON.stringify(tx.aiMetadata) : null,
              tx.isPrivate ? 1 : 0,
              1, // bulk saved are always synced = 1
              tx.createdAt || nowIso,
              tx.updatedAt || tx.createdAt || nowIso
            ]
          );

          if (tx.tags && tx.tags.length > 0) {
            await db.runAsync('DELETE FROM transaction_tags WHERE transaction_id = ?;', [tx.id]);
            for (const tag of tx.tags) {
              await db.runAsync('INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?);', [tx.id, tag.id]);
            }
          }
        } catch (err) {
          console.warn(`[SqliteTxRepo] Error in bulkSave for tx ${tx.id}:`, err);
        }
      }
    };

    if (typeof (db as any).withTransactionAsync === 'function') {
      try {
        await (db as any).withTransactionAsync(runInserts);
      } catch (txErr: any) {
        if (txErr?.message?.includes('cannot start a transaction within a transaction')) {
          await runInserts();
        } else {
          throw txErr;
        }
      }
    } else {
      await runInserts();
    }

    // Ledger Atómico: actualizar balances de todas las cuentas afectadas por bulkSave
    const affected = new Set<string>();
    for (const tx of transactions) {
      if (tx.status === 'confirmed') {
        if (tx.accountId) affected.add(tx.accountId);
        if (tx.transferToAccountId) affected.add(tx.transferToAccountId);
      }
    }
    if (affected.size > 0) {
      await this.accountRepo.recalculateBalances(Array.from(affected));
    }
  }

  async syncWithRemote(remoteTransactions: Transaction[], filters?: TransactionFilters): Promise<void> {
    const db = this.getDb();
    await this.bulkSave(remoteTransactions);

    // Permitir reconciliación segura si hay un rango delimitado O si se sincronizan movimientos pendientes
    if (!filters || (!filters.startDate && !filters.endDate && !filters.accountId && filters.status !== 'pending')) {
      return;
    }

    const remoteIds = remoteTransactions.map(t => t.id);
    let deleteQuery = "DELETE FROM transactions WHERE synced = 1 AND id NOT IN (SELECT record_id FROM sync_actions_queue WHERE table_name = 'transactions')";
    const deleteParams: any[] = [];

    if (filters.accountId) {
      deleteQuery += " AND (account_id = ? OR transfer_to_account_id = ?)";
      deleteParams.push(filters.accountId, filters.accountId);
    }
    if (filters.status) {
      deleteQuery += " AND status = ?";
      deleteParams.push(filters.status);
    }
    if (filters.inputMethod) {
      deleteQuery += " AND input_method = ?";
      deleteParams.push(filters.inputMethod);
    }
    if (filters.startDate) {
      deleteQuery += " AND transaction_date >= ?";
      deleteParams.push(filters.startDate);
    }
    if (filters.endDate) {
      deleteQuery += " AND transaction_date <= ?";
      deleteParams.push(filters.endDate);
    }

    if (remoteIds.length > 0) {
      const placeholders = remoteIds.map(() => '?').join(',');
      deleteQuery += ` AND id NOT IN (${placeholders})`;
      deleteParams.push(...remoteIds);
      await db.runAsync(deleteQuery, deleteParams);
    } else if ((filters.startDate && filters.endDate) || filters.status === 'pending') {
      // Si la nube no tiene transacciones en ese rango o estado
      await db.runAsync(deleteQuery, deleteParams);
    }
  }

  async reconcilePendingTransactions(remotePendingList: Transaction[], inputMethod?: string): Promise<void> {
    const db = this.getDb();
    const remoteIds = (remotePendingList || []).map(t => t.id);
    let query = "DELETE FROM transactions WHERE synced = 1 AND status = 'pending' AND id NOT IN (SELECT record_id FROM sync_actions_queue WHERE table_name = 'transactions')";
    const params: any[] = [];
    if (inputMethod) {
      query += " AND input_method = ?";
      params.push(inputMethod);
    }
    if (remoteIds.length > 0) {
      const placeholders = remoteIds.map(() => '?').join(',');
      query += ` AND id NOT IN (${placeholders})`;
      await db.runAsync(query, params);
    } else {
      await db.runAsync(query, params);
    }
  }

  async syncPendingEmailInvoices(remotePendingList: Transaction[]): Promise<void> {
    return this.reconcilePendingTransactions(remotePendingList, 'email');
  }

  async getUnsynced(): Promise<Transaction[]> {
    const db = this.getDb();
    const rows = await db.getAllAsync<any>('SELECT * FROM transactions WHERE synced = 0;');
    return rows.map(row => this.toDomain(row));
  }

  public toDomain(row: any): Transaction {
    let parsedMetadata = null;
    if (row.ai_metadata) {
      try {
        parsedMetadata = JSON.parse(row.ai_metadata);
      } catch {
        // ignore
      }
    }
    let periodSplit = undefined;
    if (!parsedMetadata?.installments) {
      periodSplit = row.period_split || parsedMetadata?.period_split || parsedMetadata?.periodSplit || undefined;
    }

    return {
      id: row.id,
      familyGroupId: row.family_group_id,
      accountId: row.account_id,
      categoryId: row.category_id || null,
      createdByUserId: row.created_by_user_id,
      type: row.type,
      amount: row.amount,
      currency: row.currency,
      description: row.description || null,
      merchantName: row.merchant_name || null,
      transactionDate: row.transaction_date,
      transferToAccountId: row.transfer_to_account_id || null,
      isRecurringInstance: row.is_recurring_instance === 1,
      recurringRuleId: row.recurring_rule_id || null,
      status: row.status,
      inputMethod: row.input_method,
      aiMetadata: parsedMetadata,
      periodSplit,
      isPrivate: row.is_private === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      syncedAt: null
    };
  }

  private async attachTags(transactions: Transaction[]): Promise<void> {
    if (!transactions || transactions.length === 0) return;
    const db = this.getDb();
    const txIds = transactions.map(t => t.id);

    try {
      let rawTagRows: any = [];
      if (txIds.length <= 500) {
        const placeholders = txIds.map(() => '?').join(',');
        rawTagRows = await db.getAllAsync<any>(
          `SELECT tt.transaction_id, t.id, t.family_group_id, t.name, t.color, t.created_at
           FROM transaction_tags tt
           JOIN tags t ON tt.tag_id = t.id
           WHERE tt.transaction_id IN (${placeholders});`,
          txIds
        );
      } else {
        rawTagRows = await db.getAllAsync<any>(
          `SELECT tt.transaction_id, t.id, t.family_group_id, t.name, t.color, t.created_at
           FROM transaction_tags tt
           JOIN tags t ON tt.tag_id = t.id;`
        );
      }

      const tagRows = Array.isArray(rawTagRows) ? rawTagRows : [];
      const tagsByTxId = new Map<string, any[]>();
      for (const row of tagRows) {
        const tag = {
          id: row.id,
          familyGroupId: row.family_group_id,
          name: row.name,
          color: row.color,
          createdAt: row.created_at,
        };
        const list = tagsByTxId.get(row.transaction_id) || [];
        list.push(tag);
        tagsByTxId.set(row.transaction_id, list);
      }

      for (const tx of transactions) {
        tx.tags = tagsByTxId.get(tx.id) || [];
      }
    } catch (err) {
      console.warn('[SqliteTxRepo] Error attaching tags to transactions:', err);
      for (const tx of transactions) {
        if (!tx.tags) tx.tags = [];
      }
    }
  }
}
