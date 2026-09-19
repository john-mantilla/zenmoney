import { describe, it, expect, vi } from 'vitest';
import { AuthService } from '../auth/authService';
import { supabase } from '../supabase/client';

vi.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: vi.fn().mockResolvedValue({ type: 'success' }),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    multiGet: vi.fn().mockResolvedValue([['@zenmoney_cached_user_profile', null], ['@zenmoney_cached_family_group', null]]),
    multiSet: vi.fn().mockResolvedValue(null),
    multiRemove: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    fetch: vi.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
    addEventListener: vi.fn(() => vi.fn()),
  },
}));

vi.mock('../supabase/client', () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
      linkIdentity: vi.fn().mockResolvedValue({ error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockReturnThis(),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ error: null }),
  },
}));

describe('AuthService — SSO & Global Session Revocation', () => {

  it('invoca signInWithOAuth con proveedor google', async () => {
    await AuthService.signInWithGoogle();
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({ redirectTo: expect.any(String) }),
    });
  });

  it('invoca linkIdentity para vincular cuenta de Google', async () => {
    await AuthService.linkGoogleAccount();
    expect(supabase.auth.linkIdentity).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({ redirectTo: expect.any(String) }),
    });
  });

  it('invoca signOut con scope global para revocar sesiones en todos los dispositivos', async () => {
    await AuthService.signOutAllDevices();
    expect(supabase.auth.signOut).toHaveBeenCalledWith({
      scope: 'global',
    });
  });

  it('invoca resetPasswordForEmail con el correo normalizado y redirectTo', async () => {
    await AuthService.resetPassword('  Antamega@Hotmail.com ');
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'antamega@hotmail.com',
      expect.objectContaining({ redirectTo: expect.any(String) })
    );
  });

});

describe('useAuthStore — Google SSO Loading State & Cancellation Safety', () => {
  it('garantiza que isLoading vuelve a false tras signInWithGoogle incluso sin sesión previa', async () => {
    const { useAuthStore } = await import('../auth/authStore');

    // Estado inicial
    useAuthStore.setState({ isLoading: false, isAuthenticated: false, error: null });

    // Ejecuta signInWithGoogle (donde el browser session se abre/cierra)
    await useAuthStore.getState().signInWithGoogle();

    // Debe garantizar que isLoading vuelve a false
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('garantiza que isLoading vuelve a false y se captura el error si AuthService falla', async () => {
    const { useAuthStore } = await import('../auth/authStore');

    vi.spyOn(AuthService, 'signInWithGoogle').mockRejectedValueOnce(new Error('OAuth error simulated'));

    useAuthStore.setState({ isLoading: false, isAuthenticated: false, error: null });

    await useAuthStore.getState().signInWithGoogle();

    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().error).toBe('OAuth error simulated');
  });
});

describe('AuthService — Concurrent Session Deduplication', () => {
  it('deduplica llamadas concurrentes a getCurrentSession en una sola promesa en vuelo', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return { data: { session: null }, error: null } as any;
    });

    const p1 = AuthService.getCurrentSession();
    const p2 = AuthService.getCurrentSession();

    expect(p1).toBe(p2);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(r2);
  });

  it('se recupera limpiamente si la creación de perfil genera uq_user_profiles_auth_user_id', async () => {
    const mockUser = { id: 'auth-user-123', email: 'test@zenmoney.app', user_metadata: { full_name: 'Test User' } };
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null,
    } as any);

    const existingProfile = {
      id: 'prof-existing-1',
      auth_user_id: 'auth-user-123',
      family_group_id: 'fam-existing-1',
      display_name: 'Test User',
      email: 'test@zenmoney.app',
      role: 'admin',
      created_at: new Date().toISOString(),
    };

    const existingFamily = {
      id: 'fam-existing-1',
      name: 'Familia Test',
      currency_default: 'COP',
      created_at: new Date().toISOString(),
    };

    let userProfilesSelectCalls = 0;

    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'user_profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockImplementation(async () => {
            userProfilesSelectCalls++;
            if (userProfilesSelectCalls === 1) {
              return { data: null, error: null };
            }
            return { data: existingProfile, error: null };
          }),
          insert: vi.fn().mockResolvedValue({
            error: { code: '23505', message: 'duplicate key value violates unique constraint "uq_user_profiles_auth_user_id"' },
          }),
        } as any;
      }
      if (table === 'family_groups') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: existingFamily, error: null }),
        } as any;
      }
      return {} as any;
    });

    const sessionData = await AuthService.getCurrentSession();
    expect(sessionData).not.toBeNull();
    expect(sessionData?.userProfile.id).toBe('prof-existing-1');
    expect(sessionData?.familyGroup.id).toBe('fam-existing-1');
  });
});
