/**
 * ZenMoney — Servicio de Autenticación
 *
 * Se conecta directamente con Supabase Auth y gestiona la creación de perfiles
 * y grupos familiares en la base de datos relacional.
 */

import { supabase } from '../supabase/client';
import { UserProfile, FamilyGroup } from '@domain/entities/User';
import { Mapper } from '@data/models/Mapper';

export class AuthService {
  
  /**
   * Registra un nuevo usuario en Supabase Auth, crea su grupo familiar 
   * y su perfil de usuario con rol 'admin' (creador).
   */
  static async signUp(
    email: string,
    password: string,
    displayName: string,
    familyGroupName?: string,
  ): Promise<{ userProfile: UserProfile; familyGroup: FamilyGroup }> {
    // 1. Crear el usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || 'Error al registrar el usuario.');
    }

    const authUserId = authData.user.id;

    try {
      // 2. Verificar si hay una invitación pendiente para este correo usando RPC (Security Definer)
      const { data: invitation, error: inviteErr } = await supabase
        .rpc('get_pending_invitation_by_email', { email_to_check: email.trim().toLowerCase() })
        .maybeSingle() as any;

      let targetFamilyGroupId = '';
      let assignedRole = 'admin';
      let familyGroupObj: any = null;

      if (invitation) {
        // Unirse a la familia existente de la invitación
        targetFamilyGroupId = invitation.family_group_id;
        assignedRole = invitation.role;

        // Cargar el grupo familiar correspondiente
        const { data: fam, error: famErr } = await supabase
          .from('family_groups')
          .select('*')
          .eq('id', targetFamilyGroupId)
          .single();

        if (famErr || !fam) {
          throw new Error('La familia que te invitó ya no existe.');
        }
        familyGroupObj = fam;

        // Actualizar el estado de la invitación a aceptada usando RPC (Security Definer)
        await supabase
          .rpc('accept_family_invitation', { invitation_id: invitation.id });
          
      } else {
        // Crear un grupo familiar nuevo por defecto. No se le exige el nombre al usuario
        // al registrarse (fricción innecesaria para quien solo quiere llevar sus propias
        // finanzas) — se autogenera y se puede renombrar luego desde "Mi Grupo Familiar".
        const resolvedFamilyGroupName = familyGroupName?.trim() || `Familia de ${displayName.trim()}`;
        const { data: dbFamilyGroup, error: familyError } = await supabase
          .from('family_groups')
          .insert({
            name: resolvedFamilyGroupName,
            currency_default: 'COP',
          })
          .select('*')
          .single();

        if (familyError || !dbFamilyGroup) {
          throw new Error(`Error al crear el grupo familiar: ${familyError?.message}`);
        }
        targetFamilyGroupId = dbFamilyGroup.id;
        assignedRole = 'admin';
        familyGroupObj = dbFamilyGroup;
      }

      // 3. Crear el perfil del usuario asociado a la cuenta y al grupo familiar
      const { data: dbProfile, error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          auth_user_id: authUserId,
          family_group_id: targetFamilyGroupId,
          display_name: displayName,
          email: email.trim().toLowerCase(),
          role: assignedRole,
        })
        .select('*')
        .single();

      if (profileError || !dbProfile) {
        // Rollback sutil de grupo familiar nuevo si falla el perfil
        if (!invitation) {
          await supabase.from('family_groups').delete().eq('id', targetFamilyGroupId);
        }
        throw new Error(`Error al crear el perfil de usuario: ${profileError?.message}`);
      }

      return {
        userProfile: Mapper.toDomainUserProfile(dbProfile),
        familyGroup: Mapper.toDomainFamilyGroup(familyGroupObj),
      };
    } catch (err) {
      throw err;
    }
  }

  /**
   * Inicia sesión con email y contraseña, obteniendo el perfil y grupo familiar asociado.
   */
  static async signIn(
    email: string,
    password: string,
  ): Promise<{ userProfile: UserProfile; familyGroup: FamilyGroup }> {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || 'Credenciales inválidas.');
    }

    // Obtener perfil de usuario
    const { data: dbProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', authData.user.id)
      .single();

    if (profileError || !dbProfile) {
      throw new Error('No se encontró el perfil de usuario asociado a esta cuenta.');
    }

    // Obtener grupo familiar
    const { data: dbFamilyGroup, error: familyError } = await supabase
      .from('family_groups')
      .select('*')
      .eq('id', dbProfile.family_group_id)
      .single();

    if (familyError || !dbFamilyGroup) {
      throw new Error('No se encontró el grupo familiar asociado.');
    }

    return {
      userProfile: Mapper.toDomainUserProfile(dbProfile),
      familyGroup: Mapper.toDomainFamilyGroup(dbFamilyGroup),
    };
  }

  /**
   * Obtiene la sesión actual y sus datos de perfil/familia correspondientes.
   */
  static async getCurrentSession(): Promise<{ userProfile: UserProfile; familyGroup: FamilyGroup } | null> {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session?.user) {
      return null;
    }

    // Cargar perfil
    const { data: dbProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', session.user.id)
      .single();

    if (profileError || !dbProfile) {
      return null;
    }

    // Cargar grupo familiar
    const { data: dbFamilyGroup, error: familyError } = await supabase
      .from('family_groups')
      .select('*')
      .eq('id', dbProfile.family_group_id)
      .single();

    if (familyError || !dbFamilyGroup) {
      return null;
    }

    return {
      userProfile: Mapper.toDomainUserProfile(dbProfile),
      familyGroup: Mapper.toDomainFamilyGroup(dbFamilyGroup),
    };
  }

  /**
   * Cierra la sesión del usuario.
   */
  static async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }
}
