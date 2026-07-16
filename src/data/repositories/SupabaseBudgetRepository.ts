/**
 * ZenMoney — SupabaseBudgetRepository
 *
 * Implementa BudgetRepository del dominio utilizando Supabase Client.
 */

import { BudgetRepository } from '@domain/repositories/BudgetRepository';
import { Budget, CreateBudgetInput } from '@domain/entities/Budget';
import { supabase } from '@infrastructure/supabase/client';
import { Mapper } from '../models/Mapper';

export class SupabaseBudgetRepository implements BudgetRepository {
  
  async getById(id: string): Promise<Budget | null> {
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return Mapper.toDomainBudget(data);
  }

  async getByMonth(year: number, month: number): Promise<Budget[]> {
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('year', year)
      .eq('month', month);

    if (error || !data) {
      return [];
    }

    return data.map(Mapper.toDomainBudget);
  }

  async create(input: CreateBudgetInput): Promise<Budget> {
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

    const dbBudget = Mapper.toDbBudget({
      ...input,
      familyGroupId: profile.family_group_id,
      scope: input.scope || 'family',
      ownerUserId: input.scope === 'individual' ? profile.id : null,
    });

    const { data, error } = await supabase
      .from('budgets')
      .insert(dbBudget)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Error al crear el presupuesto: ${error?.message}`);
    }

    return Mapper.toDomainBudget(data);
  }

  async update(id: string, data: Partial<CreateBudgetInput>): Promise<Budget> {
    const dbData = Mapper.toDbBudget(data);

    const { data: updated, error } = await supabase
      .from('budgets')
      .update(dbData)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !updated) {
      throw new Error(`Error al actualizar el presupuesto: ${error?.message}`);
    }

    return Mapper.toDomainBudget(updated);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error al eliminar el presupuesto: ${error.message}`);
    }
  }
}
