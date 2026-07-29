/**
 * ZenMoney — Servicio de Autenticación
 *
 * Se conecta directamente con Supabase Auth y gestiona la creación de perfiles
 * y grupos familiares en la base de datos relacional.
 */

import { supabase } from '../supabase/client';
import { UserProfile, FamilyGroup } from '@domain/entities/User';
import { Mapper } from '@data/models/Mapper';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

let Linking: typeof import('expo-linking') | null = null;
try {
  Linking = require('expo-linking');
} catch (e) {
  // Ignorado en entorno de pruebas Vitest Node
}

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  WebBrowser.maybeCompleteAuthSession();
}

// Escuchar URLs entrantes de Deep Linking en nativo
if (Platform.OS !== 'web' && Linking?.addEventListener) {
  Linking.addEventListener('url', (event) => {
    if (event.url && event.url.includes('auth/callback')) {
      AuthService.handleOAuthRedirectUrl(event.url);
    }
  });
}

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
    let { data: dbProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', session.user.id)
      .maybeSingle();

    // Si es un usuario nuevo de Google SSO sin perfil aún, creamos su grupo familiar y perfil automáticamente
    if (!dbProfile && session.user.email) {
      const displayName = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
      const familyGroupName = `Familia de ${displayName}`;

      const { data: newFam } = await supabase
        .from('family_groups')
        .insert({ name: familyGroupName, currency_default: 'COP' })
        .select('*')
        .single();

      if (newFam) {
        const { data: newProf } = await supabase
          .from('user_profiles')
          .insert({
            auth_user_id: session.user.id,
            family_group_id: newFam.id,
            display_name: displayName,
            email: session.user.email.trim().toLowerCase(),
            role: 'admin',
          })
          .select('*')
          .single();

        dbProfile = newProf;
      }
    }

    if (!dbProfile) {
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

    const providers = session.user.app_metadata?.providers || [];
    const identities = session.user.identities || [];
    const isGoogleLinked = providers.includes('google') || identities.some((i: any) => i.provider === 'google');

    return {
      userProfile: Mapper.toDomainUserProfile(dbProfile),
      familyGroup: Mapper.toDomainFamilyGroup(dbFamilyGroup),
      isGoogleLinked,
    };
  }

  /**
   * Cierra la sesión del usuario en el dispositivo actual.
   */
  static async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Cierra la sesión e invalida los tokens en TODOS los dispositivos activos.
   */
  static async signOutAllDevices(): Promise<void> {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Extrae los tokens o código de autorización devueltos en la URL de retorno del SSO
   * e inyecta la sesión activa en el cliente de Supabase.
   */
  static async handleOAuthRedirectUrl(url: string): Promise<void> {
    try {
      if (!url) return;

      // 1. Si la URL contiene hash (#access_token=...&refresh_token=...)
      if (url.includes('#')) {
        const hashPart = url.substring(url.indexOf('#') + 1);
        const params = new URLSearchParams(hashPart);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            console.error('[AuthService] Error al establecer sesión desde tokens:', error.message);
          }
          return;
        }
      }

      // 2. Si la URL contiene query params (?code=...)
      if (url.includes('?')) {
        const queryPart = url.substring(url.indexOf('?') + 1);
        const params = new URLSearchParams(queryPart);
        const code = params.get('code');

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('[AuthService] Error al intercambiar código PKCE:', error.message);
          }
        }
      }
    } catch (err) {
      console.error('[AuthService] Error procesando URL de OAuth:', err);
    }
  }

  /**
   * Inicia el flujo de autenticación SSO con Google.
   */
  static async signInWithGoogle(): Promise<void> {
    const isWeb = Platform.OS === 'web';
    const redirectUrl = isWeb
      ? (typeof window !== 'undefined' && window.location ? window.location.origin : '')
      : 'zenmoney://auth/callback';

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: !isWeb,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data?.url) {
      if (isWeb && typeof window !== 'undefined') {
        window.location.href = data.url;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (result.type === 'success' && result.url) {
          await AuthService.handleOAuthRedirectUrl(result.url);
        }
      }
    }
  }

  /**
   * Vincula la identidad de Google a una cuenta existente autenticada.
   */
  static async linkGoogleAccount(): Promise<void> {
    const isWeb = Platform.OS === 'web';
    const redirectUrl = isWeb
      ? (typeof window !== 'undefined' && window.location ? window.location.origin : '')
      : 'zenmoney://auth/callback';

    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data?.url) {
      if (isWeb && typeof window !== 'undefined') {
        window.location.href = data.url;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (result.type === 'success' && result.url) {
          await AuthService.handleOAuthRedirectUrl(result.url);
        }
      }
    }
  }
}
