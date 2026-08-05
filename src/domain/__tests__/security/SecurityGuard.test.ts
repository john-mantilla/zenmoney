import { describe, it, expect } from 'vitest';
import { SecurityGuard } from '../../security/SecurityGuard';
import { Account } from '../../entities/Account';

describe('SecurityGuard Domain Policies', () => {

  describe('canUserCreateTransaction', () => {
    it('permite transacciones válidas para usuarios activos', () => {
      const user = { userId: 'user-1', familyGroupId: 'fam-1', isActive: true };
      const tx = { accountId: 'acc-1', categoryId: 'cat-1', amount: 50, type: 'expense' as const };

      const result = SecurityGuard.canUserCreateTransaction(user, tx);
      expect(result.allowed).toBe(true);
    });

    it('rechaza transacciones para usuarios no autenticados o inactivos', () => {
      const unauth = SecurityGuard.canUserCreateTransaction(null, { accountId: 'acc-1', categoryId: 'cat-1', amount: 50, type: 'expense' });
      expect(unauth.allowed).toBe(false);
      expect(unauth.reason).toBe('Usuario no autenticado.');

      const inactive = SecurityGuard.canUserCreateTransaction(
        { userId: 'u1', familyGroupId: 'f1', isActive: false },
        { accountId: 'acc-1', categoryId: 'cat-1', amount: 50, type: 'expense' }
      );
      expect(inactive.allowed).toBe(false);
      expect(inactive.reason).toContain('inactivo');
    });

    it('rechaza montos que exceden el umbral máximo de seguridad ($1,000,000)', () => {
      const user = { userId: 'user-1', familyGroupId: 'fam-1', isActive: true };
      const result = SecurityGuard.canUserCreateTransaction(user, { accountId: 'acc-1', categoryId: 'cat-1', amount: 2000000, type: 'expense' });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('umbral máximo de seguridad');
    });
  });

  describe('canUserAccessAccount', () => {
    it('permite el acceso a cuentas del mismo grupo familiar', () => {
      const user = { userId: 'u1', familyGroupId: 'fam-1' };
      const account: Account = {
        id: 'acc-1',
        ownerUserId: 'u1',
        name: 'Banco',
        type: 'bank',
        initialBalance: 100,
        currency: 'USD',
        familyGroupId: 'fam-1',
        isActive: true,
        isPrivate: false,
        createdAt: '2026-01-01',
      };

      const result = SecurityGuard.canUserAccessAccount(user, account);
      expect(result.allowed).toBe(true);
    });

    it('rechaza el acceso a cuentas privadas creadas por otro usuario', () => {
      const user = { userId: 'user-2', familyGroupId: 'fam-1' };
      const privateAccount: Account = {
        id: 'acc-2',
        ownerUserId: 'user-1',
        name: 'Cuenta Secreta',
        type: 'cash',
        initialBalance: 50,
        currency: 'USD',
        familyGroupId: 'fam-1',
        isActive: true,
        isPrivate: true,
        createdAt: '2026-01-01',
      };

      const result = SecurityGuard.canUserAccessAccount(user, privateAccount);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('cuenta privada');
    });
  });

});
