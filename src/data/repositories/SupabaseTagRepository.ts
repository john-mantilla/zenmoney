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

    const { data, error } = await supabase
      .from('tags')
      .insert({
        family_group_id: profile.family_group_id,
        name: input.name,
        color: input.color || '#808080'
      })
      .select('*')
      .single();

    if (error || !data) throw new Error(`Error al crear tag: ${error?.message}`);
    return Mapper.toDomainTag(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('tags').delete().eq('id', id);
    if (error) throw new Error(`Error al eliminar tag: ${error.message}`);
  }
}
