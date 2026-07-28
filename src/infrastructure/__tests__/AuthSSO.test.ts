import { describe, it, expect, vi } from 'vitest';
import { AuthService } from '../auth/authService';
import { supabase } from '../supabase/client';

vi.mock('../supabase/client', () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
      linkIdentity: vi.fn().mockResolvedValue({ error: null }),
    },
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

});
