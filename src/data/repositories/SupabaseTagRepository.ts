/**
 * ZenMoney — SupabaseTagRepository
 */

import { TagRepository } from '@domain/repositories/TagRepository';
import { Tag, CreateTagInput } from '@domain/entities/Tag';
import { supabase } from '@infrastructure/supabase/client';
import { Mapper } from '../models/Mapper';

export class SupabaseTagRepository implements TagRepository {
  async getById(id: string): Promise<Tag | null> {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return Mapper.toDomainTag(data);
  }

  async getAll(): Promise<Tag[]> {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('name', { ascending: true });

    if (error || !data) return [];
    return data.map(Mapper.toDomainTag);
  }

  async create(input: CreateTagInput): Promise<Tag> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado.');

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('family_group_id')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) throw new Error('Perfil no encontrado.');

    const cleanName = (input.name || '').trim();

    // 1. Prevención de etiquetas duplicadas en Supabase por nombre
    const { data: existing } = await supabase
      .from('tags')
      .select('*')
      .eq('family_group_id', profile.family_group_id)
      .ilike('name', cleanName)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return Mapper.toDomainTag(existing);
    }

    const insertPayload: any = {
      family_group_id: profile.family_group_id,
      name: cleanName,
      color: input.color || '#808080'
    };
    if ((input as any).id) {
      insertPayload.id = (input as any).id;
    }

    const { data, error } = await supabase
      .from('tags')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error || !data) throw new Error(`Error al crear tag: ${error?.message}`);
    return Mapper.toDomainTag(data);
  }

  async update(id: string, input: Partial<CreateTagInput>): Promise<Tag> {
    const updateData: any = {};
    if (input.name) updateData.name = input.name.trim();
    if (input.color) updateData.color = input.color;

    const { data, error } = await supabase
      .from('tags')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) throw new Error(`Error al actualizar tag: ${error?.message}`);
    return Mapper.toDomainTag(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('tags').delete().eq('id', id);
    if (error) throw new Error(`Error al eliminar tag: ${error.message}`);
  }
}
