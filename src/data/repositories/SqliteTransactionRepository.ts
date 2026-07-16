import { TransactionRepository, TransactionFilters } from '@domain/repositories/TransactionRepository';
import { Transaction, CreateTransactionInput } from '@domain/entities/Transaction';
import { LocalDatabase } from '../local/LocalDatabase';

export class SqliteTransactionRepository implements TransactionRepository {
  private getDb() {
    return LocalDatabase.getDb();
  }

  async getById(id: string): Promise<Transaction | null> {
    const db = this.getDb();
    const row = await db.getFirstAsync<any>('SELECT * FROM transactions WHERE id = ?;', [id]);
    if (!row) return null;
    return this.toDomain(row);
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
      if (filters.startDate) {
        conditions.push('transaction_date >= ?');
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        conditions.push('transaction_date <= ?');
        params.push(filters.endDate);
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
    return rows.map(this.toDomain);
  }

  async create(input: CreateTransactionInput): Promise<Transaction> {
    const db = this.getDb();
    const id = (input as any).id || Math.random().toString(36).substring(2, 15);
    const familyGroupId = (input as any).familyGroupId || 'offline-family';
    const createdByUserId = (input as any).createdByUserId || 'offline-user';
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;
    const synced = (input as any).synced !== undefined ? ((input as any).synced ? 1 : 0) : 0;

    const transactionDate = input.transactionDate || new Date().toISOString().split('T')[0];
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

    return {
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
  }

  async update(id: string, data: Partial<CreateTransactionInput>): Promise<Transaction> {
    const db = this.getDb();
    const existing = await this.getById(id);
    if (!existing) {
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

    return {
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
  }

  async delete(id: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync('DELETE FROM transactions WHERE id = ?;', [id]);
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
    const db = this.getDb();
    for (const tx of transactions) {
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
          tx.familyGroupId,
          tx.accountId,
          tx.categoryId || null,
          tx.createdByUserId,
          tx.type,
          tx.amount,
          tx.currency,
          tx.description || null,
          tx.merchantName || null,
          tx.transactionDate,
          tx.transferToAccountId || null,
          tx.isRecurringInstance ? 1 : 0,
          tx.recurringRuleId || null,
          tx.status,
          tx.inputMethod,
          tx.aiMetadata ? JSON.stringify(tx.aiMetadata) : null,
          tx.isPrivate ? 1 : 0,
          1, // bulk saved are always synced = 1
          tx.createdAt,
          tx.updatedAt
        ]
      );
    }
  }

  private toDomain(row: any): Transaction {
    let parsedMetadata = null;
    if (row.ai_metadata) {
      try {
        parsedMetadata = JSON.parse(row.ai_metadata);
      } catch {
        // ignore
      }
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
      isPrivate: row.is_private === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      syncedAt: null
    };
  }
}
