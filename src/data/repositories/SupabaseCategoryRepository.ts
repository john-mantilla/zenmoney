/**
 * ZenMoney — SupabaseCategoryRepository
 *
 * Implementa CategoryRepository del dominio utilizando el SDK de Supabase.
 */

import { CategoryRepository } from '@domain/repositories/CategoryRepository';
import { Category, CreateCategoryInput } from '@domain/entities/Category';
import { supabase } from '@infrastructure/supabase/client';
import { Mapper } from '../models/Mapper';

export class SupabaseCategoryRepository implements CategoryRepository {
  
  async getById(id: string): Promise<Category | null> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return Mapper.toDomainCategory(data);
  }

  async getAll(includeSystem = true): Promise<Category[]> {
    let query = supabase.from('categories').select('*');

    if (!includeSystem) {
      // Filtrar solo las creadas por el grupo familiar (is_system = false)
      query = query.eq('is_system', false);
    }

    const { data, error } = await query.order('name', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map(Mapper.toDomainCategory);
  }

  async getByParentId(parentId: string | null): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('parent_category_id', parentId)
      .order('name', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map(Mapper.toDomainCategory);
  }

  async create(input: CreateCategoryInput): Promise<Category> {
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

    const dbCategory: Record<string, any> = {
      ...(input.id && { id: input.id }),
      family_group_id: profile.family_group_id,
      name: input.name,
      icon: input.icon,
      color: input.color,
      parent_category_id: input.parentCategoryId || null,
      budget_role: input.budgetRole || 'needs',
      is_system: false,
      is_private: input.isPrivate || false,
    };

    let { data, error } = await supabase
      .from('categories')
      .insert(dbCategory)
      .select('*')
      .single();

    if (error && error.message.includes('budget_role')) {
      delete dbCategory.budget_role;
      const res = await supabase.from('categories').insert(dbCategory).select('*').single();
      data = res.data;
      error = res.error;
    }

    if (error || !data) {
      throw new Error(`Error al crear la categoría: ${error?.message}`);
    }

    return Mapper.toDomainCategory({ ...data, budget_role: input.budgetRole || 'needs' });
  }

  async update(id: string, data: Partial<CreateCategoryInput>): Promise<Category> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado.');
    }

    // Obtener la categoría actual para preservar sus propiedades
    const current = await this.getById(id);
    if (!current) {
      throw new Error('Categoría no encontrada.');
    }

    const dbData: Record<string, any> = {};
    if (data.name !== undefined) dbData.name = data.name;
    if (data.icon !== undefined) dbData.icon = data.icon;
    if (data.color !== undefined) dbData.color = data.color;
    if (data.parentCategoryId !== undefined) dbData.parent_category_id = data.parentCategoryId || null;
    if (data.budgetRole !== undefined) dbData.budget_role = data.budgetRole;
    if (data.isPrivate !== undefined) dbData.is_private = data.isPrivate;

    let { data: updated, error } = await supabase
      .from('categories')
      .update(dbData)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error && error.message.includes('budget_role')) {
      delete dbData.budget_role;
      const res = await supabase.from('categories').update(dbData).eq('id', id).select('*').maybeSingle();
      updated = res.data;
      error = res.error;
    }

    if (error) {
      throw new Error(`Error al actualizar la categoría: ${error.message}`);
    }

    // Si no retornó fila remota (ej: categoría del sistema con family_group_id nulo),
    // asociamos el family_group_id del usuario para guardar la personalización de forma permanente en Supabase.
    if (!updated) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('family_group_id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (profile?.family_group_id) {
        const { data: retryUpdated } = await supabase
          .from('categories')
          .update({
            ...dbData,
            family_group_id: profile.family_group_id,
            is_system: false,
          })
          .eq('id', id)
          .select('*')
          .maybeSingle();

        if (retryUpdated) {
          updated = retryUpdated;
        }
      }
    }

    const resultObj = updated || {
      id: current.id,
      family_group_id: current.familyGroupId,
      name: dbData.name !== undefined ? dbData.name : current.name,
      icon: dbData.icon !== undefined ? dbData.icon : current.icon,
      color: dbData.color !== undefined ? dbData.color : current.color,
      parent_category_id: dbData.parent_category_id !== undefined ? dbData.parent_category_id : current.parentCategoryId,
      budget_role: dbData.budget_role !== undefined ? dbData.budget_role : current.budgetRole,
      is_system: current.isSystem,
      is_private: dbData.is_private !== undefined ? dbData.is_private : current.isPrivate,
    };

    return Mapper.toDomainCategory(resultObj);
  }

  async delete(id: string): Promise<void> {
    // Al eliminar una categoría, PostgreSQL pone a NULL los category_id asociados 
    // en cascada (ON DELETE SET NULL).
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error al eliminar la categoría: ${error.message}`);
    }
  }

  async searchByName(query: string): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .ilike('name', `%${query}%`)
      .order('name', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map(Mapper.toDomainCategory);
  }
}
