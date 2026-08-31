/**
 * ZenMoney — SupabaseTransactionRepository
 *
 * Implementa TransactionRepository del dominio utilizando Supabase Client.
 */

import { TransactionRepository, TransactionFilters } from '@domain/repositories/TransactionRepository';
import { Transaction, CreateTransactionInput } from '@domain/entities/Transaction';
import { supabase } from '@infrastructure/supabase/client';
import { Mapper } from '../models/Mapper';

export class SupabaseTransactionRepository implements TransactionRepository {
  
  async getById(id: string): Promise<Transaction | null> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, tags(*)')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return Mapper.toDomainTransaction(data);
  }

  async getAll(filters?: TransactionFilters): Promise<Transaction[]> {
    let query = supabase.from('transactions').select('*, tags(*)');

    if (filters) {
      if (filters.accountId) {
        query = query.or(`account_id.eq.${filters.accountId},transfer_to_account_id.eq.${filters.accountId}`);
      }
      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }
      if (filters.type) {
        query = query.eq('type', filters.type);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.inputMethod) {
        query = query.eq('input_method', filters.inputMethod);
      }
      if (filters.recurringRuleId) {
        query = query.eq('recurring_rule_id', filters.recurringRuleId);
      }
      if (filters.startDate) {
        query = query.gte('transaction_date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('transaction_date', filters.endDate);
      }
      if (filters.tagIds && filters.tagIds.length > 0) {
        // PostgREST filtering on joined tables can be complex, but for many-to-many 
        // it's easier to filter if the tag is contained in the joined tags array,
        // However, a simpler way is filtering via inner join if supported, or just let the client filter if needed.
        // For now, we will leave it as is and maybe filter on the client if it's too complex.
        // Or query `transaction_tags` separately.
      }
      
      // Orden por defecto: fecha de transacción descendente
      query = query.order('transaction_date', { ascending: false });
      query = query.order('created_at', { ascending: false });

      if (filters.offset !== undefined) {
        query = query.range(filters.offset, (filters.offset + (filters.limit || 20) - 1));
      } else if (filters.limit !== undefined) {
        query = query.limit(filters.limit);
      }
    } else {
      query = query.order('transaction_date', { ascending: false });
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map(Mapper.toDomainTransaction);
  }

  async create(input: CreateTransactionInput): Promise<Transaction> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado.');
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('family_group_id, id')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('No se encontró el perfil familiar del usuario.');
    }

    const dbTransaction = Mapper.toDbTransaction({
      ...input,
      familyGroupId: profile.family_group_id,
      createdByUserId: profile.id,
      currency: input.currency || 'COP',
      transactionDate: input.transactionDate || new Date().toISOString().split('T')[0],
      status: (input as any).status || 'confirmed',
    });

    const { data, error } = await supabase
      .from('transactions')
      .insert(dbTransaction)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Error al crear la transacción: ${error?.message}`);
    }

    if (input.tags && input.tags.length > 0) {
      const tagInserts = input.tags.map(tagId => ({ transaction_id: data.id, tag_id: tagId }));
      await supabase.from('transaction_tags').insert(tagInserts);
    }

    return this.getById(data.id) as Promise<Transaction>;
  }

  async update(id: string, data: Partial<CreateTransactionInput>): Promise<Transaction> {
    const dbData = Mapper.toDbTransaction(data);

    const { data: updated, error } = await supabase
      .from('transactions')
      .update(dbData)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !updated) {
      throw new Error(`Error al actualizar la transacción: ${error?.message}`);
    }

    if (data.tags !== undefined) {
      // Borrar tags existentes y crear nuevos
      await supabase.from('transaction_tags').delete().eq('transaction_id', id);
      if (data.tags.length > 0) {
        const tagInserts = data.tags.map(tagId => ({ transaction_id: id, tag_id: tagId }));
        await supabase.from('transaction_tags').insert(tagInserts);
      }
    }

    return this.getById(id) as Promise<Transaction>;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error al eliminar la transacción: ${error.message}`);
    }
  }

  async getByDateRange(startDate: string, endDate: string): Promise<Transaction[]> {
    return this.getAll({ startDate, endDate });
  }

  async getTotalByType(type: Transaction['type'], startDate: string, endDate: string): Promise<number> {
    const { data, error } = await supabase
      .from('transactions')
      .select('amount')
      .eq('type', type)
      .eq('status', 'confirmed')
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate);

    if (error || !data) {
      return 0;
    }

    return data.reduce((acc, row) => acc + Number(row.amount), 0);
  }
}
