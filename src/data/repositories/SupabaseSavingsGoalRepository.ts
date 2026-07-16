/**
 * ZenMoney — Implementación SupabaseSavingsGoalRepository
 */

import { SavingsGoalRepository } from '@/src/domain/repositories/SavingsGoalRepository';
import { SavingsGoal, CreateSavingsGoalInput } from '@/src/domain/entities/SavingsGoal';
import { supabase } from '@/src/infrastructure/supabase/client';
import { Mapper } from '../models/Mapper';

export class SupabaseSavingsGoalRepository implements SavingsGoalRepository {
  /**
   * Obtiene una meta de ahorro por su ID.
   */
  async getById(id: string): Promise<SavingsGoal | null> {
    const { data, error } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      console.warn(`[SavingsGoal Repo] Error al buscar meta ${id}:`, error?.message);
      return null;
    }
    return Mapper.toDomainSavingsGoal(data);
  }

  /**
   * Obtiene todas las metas de ahorro asociadas al grupo familiar actual.
   * Filtro implícito vía RLS.
   */
  async getAll(): Promise<SavingsGoal[]> {
    const { data, error } = await supabase
      .from('savings_goals')
      .select('*')
      .order('target_date', { ascending: true });

    if (error || !data) {
      console.warn('[SavingsGoal Repo] Error al listar metas:', error?.message);
      return [];
    }
    return data.map(Mapper.toDomainSavingsGoal);
  }

  /**
   * Crea una nueva meta de ahorro.
   * Busca los datos de sesión para rellenar family_group_id y owner_user_id.
   */
  async create(input: CreateSavingsGoalInput): Promise<SavingsGoal> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado para crear metas de ahorro.');
    }

    // Obtener perfil e ID de grupo familiar
    const { data: profile, error: profError } = await supabase
      .from('user_profiles')
      .select('id, family_group_id')
      .eq('auth_user_id', user.id)
      .single();

    if (profError || !profile) {
      throw new Error('No se pudo verificar el perfil familiar del usuario activo.');
    }

    const dbGoal = {
      family_group_id: profile.family_group_id,
      owner_user_id: profile.id,
      name: input.name,
      target_amount: input.targetAmount,
      current_amount: input.currentAmount ?? 0,
      target_date: input.targetDate,
      status: 'active',
    };

    const { data, error } = await supabase
      .from('savings_goals')
      .insert(dbGoal)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Error en inserción de base de datos de metas: ${error?.message}`);
    }

    return Mapper.toDomainSavingsGoal(data);
  }

  /**
   * Actualiza una meta de ahorro.
   */
  async update(
    id: string,
    data: Partial<CreateSavingsGoalInput> & { status?: SavingsGoal['status'] }
  ): Promise<SavingsGoal> {
    const dbData = Mapper.toDbSavingsGoal(data);

    const { data: updated, error } = await supabase
      .from('savings_goals')
      .update(dbData)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !updated) {
      throw new Error(`Error en actualización de base de datos de metas: ${error?.message}`);
    }

    return Mapper.toDomainSavingsGoal(updated);
  }

  /**
   * Elimina una meta de ahorro.
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('savings_goals')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error al eliminar la meta de la base de datos: ${error.message}`);
    }
  }
}
