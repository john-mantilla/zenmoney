/**
 * ZenMoney — SupabaseAssistantMessageRepository
 *
 * Implementa AssistantMessageRepository del dominio utilizando Supabase Client.
 */

import { AssistantMessageRepository } from '@domain/repositories/AssistantMessageRepository';
import { AssistantMessage, CreateAssistantMessageInput } from '@domain/entities/AssistantMessage';
import { supabase } from '@infrastructure/supabase/client';
import { Mapper } from '../models/Mapper';

export class SupabaseAssistantMessageRepository implements AssistantMessageRepository {

  async getRecent(limit: number): Promise<AssistantMessage[]> {
    const { data, error } = await supabase
      .from('assistant_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map(Mapper.toDomainAssistantMessage).reverse();
  }

  async create(input: CreateAssistantMessageInput): Promise<AssistantMessage> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado.');
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, family_group_id')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('No se encontró el perfil del usuario.');
    }

    const { data, error } = await supabase
      .from('assistant_messages')
      .insert({
        family_group_id: profile.family_group_id,
        user_id: profile.id,
        sender: input.sender,
        content: input.content,
        suggested_actions: input.suggestedActions || [],
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Error al guardar el mensaje del asistente: ${error?.message}`);
    }

    return Mapper.toDomainAssistantMessage(data);
  }

  async deleteAll(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado.');
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) return;

    const { error } = await supabase
      .from('assistant_messages')
      .delete()
      .eq('user_id', profile.id);

    if (error) {
      throw new Error(`Error al borrar la conversación: ${error.message}`);
    }
  }
}
