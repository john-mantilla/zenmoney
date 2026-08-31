/**
 * ZenMoney — Authentication Store
 *
 * Conecta el estado de Zustand con el AuthService de Supabase.
 */
import { create } from 'zustand';
import { Platform } from 'react-native';
import type { UserProfile, FamilyGroup } from '@domain/entities/User';
import { AuthService } from './authService';
import { supabase } from '../supabase/client';
import { withTimeout } from '../utils/network';

interface AuthState {
  isInitialized: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  userProfile: UserProfile | null;
  familyGroup: FamilyGroup | null;
  error: string | null;
  hasAccounts: boolean;
  isGoogleLinked: boolean;
}

interface AuthActions {
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    familyGroupName?: string,
  ) => Promise<boolean>;
  signOut: () => Promise<void>;
  signOutAllDevices: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  linkGoogleAccount: () => Promise<boolean>;
  setUserProfile: (profile: UserProfile) => void;
  setFamilyGroup: (group: FamilyGroup) => void;
  setHasAccounts: (has: boolean) => void;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

async function checkHasAccountsOfflineFirst(): Promise<boolean> {
  // 1. Revisar primero en SQLite si no es web
  if (Platform.OS !== 'web') {
    try {
      const { LocalDatabase } = require('@data/local/LocalDatabase');
      const db = LocalDatabase.getDb();
      const localAccs = await db.getAllAsync('SELECT id FROM accounts WHERE is_active = 1 LIMIT 1;');
      if (localAccs && localAccs.length > 0) {
        return true;
      }
    } catch (e) {
      // Ignorar y consultar nube
    }
  }

  // 2. Si no hay en local o es web, consultar Supabase con timeout de 2.5s
  try {
    const accPromise = supabase
      .from('accounts')
      .select('id')
      .eq('is_active', true);
    const { data: accounts } = await withTimeout(accPromise, 2500, { data: null } as any);
    if (accounts && accounts.length > 0) {
      return true;
    }
    // Si la consulta fue exitosa y vino vacía, efectivamente no tiene cuentas
    if (accounts !== null) {
      return false;
    }
  } catch {
    // Error de red
  }

  // Si falló la red pero ya tiene perfil autenticado en sesión, asumir true para evitar onboarding espurio
  return true;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  isInitialized: false,
  isAuthenticated: false,
  isLoading: false,
  userProfile: null,
  familyGroup: null,
  error: null,
  hasAccounts: false,
  isGoogleLinked: false,

  initialize: async () => {
    set({ isLoading: true });
    try {
      const sessionData = await AuthService.getCurrentSession();
      if (sessionData) {
        const has = await checkHasAccountsOfflineFirst();

        set({
          isAuthenticated: true,
          userProfile: sessionData.userProfile,
          familyGroup: sessionData.familyGroup,
          hasAccounts: has,
          isGoogleLinked: sessionData.isGoogleLinked,
        });
      } else {
        set({ isAuthenticated: false, userProfile: null, familyGroup: null, hasAccounts: false, isGoogleLinked: false });
      }
    } catch (err) {
      console.error('[ZenMoney Auth Store Init Error]:', err);
    } finally {
      set({ isInitialized: true, isLoading: false });
    }

    // Escuchar cambios de sesión desde Supabase Auth (ej. token vencido, signout remoto).
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        // Confirmar que de verdad no queda sesión antes de cerrar sesión localmente
        const { data } = await supabase.auth.getSession();
        if (data.session) return;
        set({ isAuthenticated: false, userProfile: null, familyGroup: null });
      } else if (event === 'SIGNED_IN' && session) {
        if (get().isAuthenticated) return; // Ya autenticado: fue solo un refresco de token
        const sessionData = await AuthService.getCurrentSession();
        if (sessionData) {
          const has = await checkHasAccountsOfflineFirst();

          set({
            isAuthenticated: true,
            userProfile: sessionData.userProfile,
            familyGroup: sessionData.familyGroup,
            hasAccounts: has,
            isGoogleLinked: sessionData.isGoogleLinked,
          });
        }
      }
    });
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await AuthService.signIn(email, password);
      
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id')
        .eq('is_active', true);
      const has = accounts ? accounts.length > 0 : false;

      set({
        isAuthenticated: true,
        userProfile: data.userProfile,
        familyGroup: data.familyGroup,
        hasAccounts: has,
        isLoading: false,
      });
      return true;
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Error al iniciar sesión',
      });
      return false;
    }
  },

  signUp: async (email, password, displayName, familyGroupName) => {
    set({ isLoading: true, error: null });
    try {
      const data = await AuthService.signUp(email, password, displayName, familyGroupName);
      
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id')
        .eq('is_active', true);
      const has = accounts ? accounts.length > 0 : false;

      set({
        isAuthenticated: true,
        userProfile: data.userProfile,
        familyGroup: data.familyGroup,
        hasAccounts: has,
        isLoading: false,
      });
      return true;
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Error al registrarse',
      });
      return false;
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      await AuthService.signOut();
      set({
        isAuthenticated: false,
        userProfile: null,
        familyGroup: null,
        error: null,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error al cerrar sesión' });
    } finally {
      set({ isLoading: false });
    }
  },

  signOutAllDevices: async () => {
    set({ isLoading: true });
    try {
      await AuthService.signOutAllDevices();
      set({
        isAuthenticated: false,
        userProfile: null,
        familyGroup: null,
        error: null,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error al cerrar sesión en todos los dispositivos' });
    } finally {
      set({ isLoading: false });
    }
  },

  signInWithGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      await AuthService.signInWithGoogle();
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Error al iniciar sesión con Google',
      });
    }
  },

  linkGoogleAccount: async () => {
    set({ isLoading: true, error: null });
    try {
      await AuthService.linkGoogleAccount();
      set({ isLoading: false });
      return true;
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Error al vincular la cuenta de Google',
      });
      return false;
    }
  },

  setUserProfile: (profile) => set({ userProfile: profile }),
  setFamilyGroup: (group) => set({ familyGroup: group }),
  setHasAccounts: (has) => set({ hasAccounts: has }),
  clearError: () => set({ error: null }),
}));
