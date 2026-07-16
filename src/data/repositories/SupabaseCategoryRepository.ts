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

    const dbCategory = {
      family_group_id: profile.family_group_id,
      name: input.name,
      icon: input.icon,
      color: input.color,
      parent_category_id: input.parentCategoryId || null,
      is_system: false,
      is_private: input.isPrivate || false,
    };

    const { data, error } = await supabase
      .from('categories')
      .insert(dbCategory)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Error al crear la categoría: ${error?.message}`);
    }

    return Mapper.toDomainCategory(data);
  }

  async update(id: string, data: Partial<CreateCategoryInput>): Promise<Category> {
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

    // Obtener la categoría actual para preservar sus llaves y evitar desasociaciones o RLS
    const current = await this.getById(id);
    if (!current) {
      throw new Error('Categoría no encontrada.');
    }

    const dbData = {
      name: data.name !== undefined ? data.name : current.name,
      icon: data.icon !== undefined ? data.icon : current.icon,
      color: data.color !== undefined ? data.color : current.color,
      parent_category_id: data.parentCategoryId !== undefined ? (data.parentCategoryId || null) : current.parentCategoryId,
      family_group_id: profile.family_group_id, // Asegurar que coincida con el RLS del usuario
      is_system: false,
      is_private: data.isPrivate !== undefined ? data.isPrivate : current.isPrivate
    };

    const { data: updated, error } = await supabase
      .from('categories')
      .update(dbData)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !updated) {
      throw new Error(`Error al actualizar la categoría: ${error?.message}`);
    }

    return Mapper.toDomainCategory(updated);
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
