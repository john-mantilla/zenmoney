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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isOnlineFast, withTimeout } from '../utils/network';
import { generateUUID } from '../utils/uuid';

const AUTH_PROFILE_CACHE_KEY = '@zenmoney_cached_user_profile';
const AUTH_FAMILY_CACHE_KEY = '@zenmoney_cached_family_group';

async function saveCachedSessionData(profile: UserProfile, family: FamilyGroup): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [AUTH_PROFILE_CACHE_KEY, JSON.stringify(profile)],
      [AUTH_FAMILY_CACHE_KEY, JSON.stringify(family)],
    ]);
  } catch (err) {
    console.warn('[AuthService] Error caching session data:', err);
  }
}

async function getCachedSessionData(): Promise<{ userProfile: UserProfile; familyGroup: FamilyGroup } | null> {
  try {
    const pairs = await AsyncStorage.multiGet([AUTH_PROFILE_CACHE_KEY, AUTH_FAMILY_CACHE_KEY]);
    const profileStr = pairs[0][1];
    const familyStr = pairs[1][1];
    if (profileStr && familyStr) {
      return {
        userProfile: JSON.parse(profileStr),
        familyGroup: JSON.parse(familyStr),
      };
    }
  } catch (err) {
    console.warn('[AuthService] Error reading cached session data:', err);
  }
  return null;
}

async function clearCachedSessionData(): Promise<void> {
  try {
    inFlightCurrentSessionPromise = null;
    await AsyncStorage.multiRemove([AUTH_PROFILE_CACHE_KEY, AUTH_FAMILY_CACHE_KEY]);
  } catch (err) {
    console.warn('[AuthService] Error clearing cached session data:', err);
  }
}

let inFlightCurrentSessionPromise: Promise<{ userProfile: UserProfile; familyGroup: FamilyGroup; isGoogleLinked?: boolean } | null> | null = null;

let Linking: any = null;
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
  Linking.addEventListener('url', (event: any) => {
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
        const newFamilyGroupId = generateUUID();
        const { error: familyError } = await supabase
          .from('family_groups')
          .insert({
            id: newFamilyGroupId,
            name: resolvedFamilyGroupName,
            currency_default: 'COP',
          });

        if (familyError) {
          throw new Error(`Error al crear el grupo familiar: ${familyError?.message}`);
        }
        targetFamilyGroupId = newFamilyGroupId;
        assignedRole = 'admin';
        familyGroupObj = {
          id: newFamilyGroupId,
          name: resolvedFamilyGroupName,
          currency_default: 'COP',
          created_at: new Date().toISOString(),
        };
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

      const userProfile = Mapper.toDomainUserProfile(dbProfile);
      const familyGroup = Mapper.toDomainFamilyGroup(familyGroupObj);
      await saveCachedSessionData(userProfile, familyGroup);

      return {
        userProfile,
        familyGroup,
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

    const userProfile = Mapper.toDomainUserProfile(dbProfile);
    const familyGroup = Mapper.toDomainFamilyGroup(dbFamilyGroup);
    await saveCachedSessionData(userProfile, familyGroup);

    return {
      userProfile,
      familyGroup,
    };
  }

  /**
   * Obtiene la sesión actual y sus datos de perfil/familia correspondientes.
   * Si el dispositivo está sin conexión o en modo avión, recurre a la caché local.
   * Deduplica llamadas concurrentes en vuelo (ej. initApp + onAuthStateChange).
   */
  static getCurrentSession(): Promise<{ userProfile: UserProfile; familyGroup: FamilyGroup; isGoogleLinked?: boolean } | null> {
    if (inFlightCurrentSessionPromise) {
      return inFlightCurrentSessionPromise;
    }

    inFlightCurrentSessionPromise = (async () => {
      try {
        return await AuthService._fetchCurrentSessionInternal();
      } finally {
        inFlightCurrentSessionPromise = null;
      }
    })();

    return inFlightCurrentSessionPromise;
  }

  private static async _fetchCurrentSessionInternal(): Promise<{ userProfile: UserProfile; familyGroup: FamilyGroup; isGoogleLinked?: boolean } | null> {
    // 1. Verificación instantánea de conectividad antes de intentar cualquier llamada de red
    const isOnline = await isOnlineFast();

    if (!isOnline) {
      console.log('[AuthService] Dispositivo offline/modo avión detectado. Cargando sesión desde caché local...');
      const cached = await getCachedSessionData();
      if (cached) {
        return {
          ...cached,
          isGoogleLinked: false,
        };
      }
      return null;
    }

    const sessionRes = await withTimeout(
      supabase.auth.getSession(),
      2500,
      { data: { session: null }, error: null } as any
    );
    const session = sessionRes?.data?.session;
    const error = sessionRes?.error;
    
    if (error || !session?.user) {
      const cached = await getCachedSessionData();
      if (cached) {
        return {
          ...cached,
          isGoogleLinked: false,
        };
      }
      return null;
    }

    const providers = session.user.app_metadata?.providers || [];
    const identities = session.user.identities || [];
    const isGoogleLinked = providers.includes('google') || identities.some((i: any) => i.provider === 'google');

    try {
      // 1. Intentar consultar perfil desde Supabase con timeout defensivo de 3.5s
      const profilePromise = supabase
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();

      const profileRes = await withTimeout(profilePromise, 3500, null);
      let dbProfile = profileRes?.data ?? null;

      // Si la consulta fue exitosa y explícitamente confirmó que NO existe perfil (data === null y sin error de red/timeout),
      // es un usuario nuevo de Google SSO sin perfil aún.
      if (!dbProfile && profileRes && !profileRes.error && session.user.email) {
        const displayName = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
        const familyGroupName = `Familia de ${displayName}`;
        const newFamilyGroupId = generateUUID();

        const { error: famErr } = await supabase
          .from('family_groups')
          .insert({ id: newFamilyGroupId, name: familyGroupName, currency_default: 'COP' });

        if (!famErr) {
          const newProfileId = generateUUID();
          const { error: profErr } = await supabase
            .from('user_profiles')
            .insert({
              id: newProfileId,
              auth_user_id: session.user.id,
              family_group_id: newFamilyGroupId,
              display_name: displayName,
              email: session.user.email.trim().toLowerCase(),
              role: 'admin',
            });

          if (!profErr) {
            const userProfile = Mapper.toDomainUserProfile({
              id: newProfileId,
              auth_user_id: session.user.id,
              family_group_id: newFamilyGroupId,
              display_name: displayName,
              email: session.user.email.trim().toLowerCase(),
              role: 'admin',
              created_at: new Date().toISOString(),
            });
            const familyGroup = Mapper.toDomainFamilyGroup({
              id: newFamilyGroupId,
              name: familyGroupName,
              currency_default: 'COP',
              created_at: new Date().toISOString(),
            });
            await saveCachedSessionData(userProfile, familyGroup);
            return { userProfile, familyGroup, isGoogleLinked };
          } else {
            // Manejo de concurrencia / duplicate key:
            // Si el perfil ya existía (ej. uq_user_profiles_auth_user_id o código 23505),
            // limpiamos el grupo familiar huérfano y recuperamos el perfil existente sin fallar.
            if (profErr.code === '23505' || profErr.message?.includes('uq_user_profiles_auth_user_id')) {
              await supabase.from('family_groups').delete().eq('id', newFamilyGroupId);

              const { data: existingProfile } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('auth_user_id', session.user.id)
                .maybeSingle();

              if (existingProfile) {
                dbProfile = existingProfile;
              }
            } else {
              console.error('[AuthService] Error al crear perfil para usuario de Google:', profErr?.message);
            }
          }
        } else {
          console.error('[AuthService] Error al crear grupo familiar para usuario de Google:', famErr.message);
        }
      }

      // Si no tenemos dbProfile (ej. timeout en la consulta inicial), reintentar consultar con timeout defensivo
      if (!dbProfile) {
        const retryRes = await withTimeout(
          supabase
            .from('user_profiles')
            .select('*')
            .eq('auth_user_id', session.user.id)
            .maybeSingle(),
          2000,
          { data: null } as any
        );

        if (retryRes?.data) {
          dbProfile = retryRes.data;
        }
      }

      if (dbProfile) {
        // Cargar grupo familiar
        const famPromise = supabase
          .from('family_groups')
          .select('*')
          .eq('id', dbProfile.family_group_id)
          .single();

        const famRes = await withTimeout(famPromise, 3500, null);
        const dbFamilyGroup = famRes?.data;

        if (dbFamilyGroup) {
          const userProfile = Mapper.toDomainUserProfile(dbProfile);
          const familyGroup = Mapper.toDomainFamilyGroup(dbFamilyGroup);
          await saveCachedSessionData(userProfile, familyGroup);
          return {
            userProfile,
            familyGroup,
            isGoogleLinked,
          };
        }
      }
    } catch (err) {
      console.log('[AuthService] Error o timeout al consultar Supabase en getCurrentSession, usando caché local...');
    }

    // 2. Fallback Modo Avión / Sin Internet: Recuperar sesión cacheada localmente
    const cached = await getCachedSessionData();
    if (cached) {
      console.log('[AuthService] Sesión recuperada desde caché local para modo offline.');
      return {
        ...cached,
        isGoogleLinked,
      };
    }

    return null;
  }

  /**
   * Cierra la sesión del usuario en el dispositivo actual.
   */
  static async signOut(): Promise<void> {
    await clearCachedSessionData();
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Cierra la sesión e invalida los tokens en TODOS los dispositivos activos.
   */
  static async signOutAllDevices(): Promise<void> {
    await clearCachedSessionData();
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

  /**
   * Envía un correo electrónico para restablecer la contraseña de una cuenta tradicional.
   */
  static async resetPassword(email: string): Promise<void> {
    const isWeb = Platform.OS === 'web';
    const redirectTo = isWeb
      ? (typeof window !== 'undefined' && window.location ? `${window.location.origin}/reset-password` : '')
      : 'zenmoney://auth/reset-password';

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo,
    });

    if (error) {
      throw new Error(error.message);
    }
  }
}
