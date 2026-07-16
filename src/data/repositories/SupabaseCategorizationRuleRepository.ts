/**
 * ZenMoney — SupabaseCategorizationRuleRepository
 *
 * Implementa CategorizationRuleRepository del dominio utilizando el SDK de Supabase.
 */

import { CategorizationRuleRepository } from '@domain/repositories/CategorizationRuleRepository';
import { CategorizationRule, CreateCategorizationRuleInput } from '@domain/entities/CategorizationRule';
import { supabase } from '@infrastructure/supabase/client';
import { Mapper } from '../models/Mapper';

export class SupabaseCategorizationRuleRepository implements CategorizationRuleRepository {

  async getAll(): Promise<CategorizationRule[]> {
    const { data, error } = await supabase
      .from('auto_categorization_rules')
      .select('*')
      .order('priority', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(Mapper.toDomainCategorizationRule);
  }

  async create(input: CreateCategorizationRuleInput): Promise<CategorizationRule> {
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

    const dbRule = {
      family_group_id: profile.family_group_id,
      match_pattern: input.matchPattern,
      category_id: input.categoryId,
      priority: input.priority ?? 10,
      is_ai_generated: input.isAiGenerated ?? false,
    };

    const { data, error } = await supabase
      .from('auto_categorization_rules')
      .insert(dbRule)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Error al crear la regla de categorización: ${error?.message}`);
    }

    return Mapper.toDomainCategorizationRule(data);
  }

  async update(id: string, data: Partial<CreateCategorizationRuleInput>): Promise<CategorizationRule> {
    const dbData = Mapper.toDbCategorizationRule(data);

    const { data: updated, error } = await supabase
      .from('auto_categorization_rules')
      .update(dbData)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !updated) {
      throw new Error(`Error al actualizar la regla de categorización: ${error?.message}`);
    }

    return Mapper.toDomainCategorizationRule(updated);
  }
}
