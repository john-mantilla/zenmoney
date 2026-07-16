/**
 * ZenMoney — SupabaseRecurringRuleRepository
 *
 * Conecta las operaciones CRUD de reglas recurrentes con la tabla `recurring_rules`
 * de Supabase.
 */

import { RecurringRuleRepository } from '@domain/repositories/RecurringRuleRepository';
import { RecurringRule, CreateRecurringRuleInput } from '@domain/entities/RecurringRule';
import { supabase } from '@infrastructure/supabase/client';
import { Mapper } from '../models/Mapper';

export class SupabaseRecurringRuleRepository implements RecurringRuleRepository {
  
  async getById(id: string): Promise<RecurringRule | null> {
    const { data, error } = await supabase
      .from('recurring_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return Mapper.toDomainRecurringRule(data);
  }

  async getAllActive(): Promise<RecurringRule[]> {
    const { data, error } = await supabase
      .from('recurring_rules')
      .select('*')
      .eq('is_active', true);

    if (error || !data) {
      return [];
    }

    return data.map(Mapper.toDomainRecurringRule);
  }

  async create(input: CreateRecurringRuleInput): Promise<RecurringRule> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado.');
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('family_group_id')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('No se encontró el perfil familiar del usuario.');
    }

    const dbRule = Mapper.toDbRecurringRule({
      ...input,
      familyGroupId: profile.family_group_id,
      isActive: true,
    });

    const { data, error } = await supabase
      .from('recurring_rules')
      .insert(dbRule)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Error al crear la regla recurrente: ${error?.message}`);
    }

    return Mapper.toDomainRecurringRule(data);
  }

  async update(id: string, data: Partial<CreateRecurringRuleInput>): Promise<RecurringRule> {
    const dbData = Mapper.toDbRecurringRule(data);

    const { data: updated, error } = await supabase
      .from('recurring_rules')
      .update(dbData)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !updated) {
      throw new Error(`Error al actualizar la regla recurrente: ${error?.message}`);
    }

    return Mapper.toDomainRecurringRule(updated);
  }

  async delete(id: string): Promise<void> {
    // Eliminación lógica (desactivar)
    const { error } = await supabase
      .from('recurring_rules')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      throw new Error(`Error al eliminar la regla recurrente: ${error.message}`);
    }
  }
}
