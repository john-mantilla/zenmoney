/**
 * ZenMoney — SupabaseAccountRepository
 *
 * Implementa AccountRepository del dominio utilizando Supabase Client.
 */

import { AccountRepository } from '@domain/repositories/AccountRepository';
import { Account, CreateAccountInput } from '@domain/entities/Account';
import { supabase } from '@infrastructure/supabase/client';
import { Mapper } from '../models/Mapper';

export class SupabaseAccountRepository implements AccountRepository {
  
  async getById(id: string): Promise<Account | null> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return Mapper.toDomainAccount(data);
  }

  async getAll(): Promise<Account[]> {
    // get_user_family_group_id() se resuelve en las políticas RLS de PostgreSQL de forma transparente.
    // Pero para estar 100% seguros y evitar cargar de más, las políticas garantizan el filtrado.
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('name', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map(Mapper.toDomainAccount);
  }

  async create(input: CreateAccountInput): Promise<Account> {
    // 1. Obtener el perfil del usuario autenticado para rellenar family_group_id y owner_user_id
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

    // 2. Preparar el registro para la DB
    const dbAccount = {
      family_group_id: profile.family_group_id,
      owner_user_id: profile.id,
      name: input.name,
      type: input.type,
      initial_balance: input.initialBalance,
      currency: input.currency || 'COP',
      is_active: true,
      is_private: input.isPrivate || false,
    };

    const { data, error } = await supabase
      .from('accounts')
      .insert(dbAccount)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Error al crear la cuenta: ${error?.message}`);
    }

    return Mapper.toDomainAccount(data);
  }

  async update(id: string, data: Partial<CreateAccountInput>): Promise<Account> {
    const dbData = Mapper.toDbAccount(data);

    const { data: updated, error } = await supabase
      .from('accounts')
      .update(dbData)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !updated) {
      throw new Error(`Error al actualizar la cuenta: ${error?.message}`);
    }

    return Mapper.toDomainAccount(updated);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('accounts')
      .update({ is_active: false }) // Eliminación lógica en MVP
      .eq('id', id);

    if (error) {
      throw new Error(`Error al desactivar la cuenta: ${error.message}`);
    }
  }
}
