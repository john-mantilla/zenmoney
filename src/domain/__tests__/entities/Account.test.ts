import { describe, it, expect } from 'vitest';
import { Account, AccountType } from '../../entities/Account';

describe('Account Entity', () => {
  it('debe validar la estructura de una cuenta bancaria', () => {
    const account: Account = {
      id: 'acc-1',
      familyGroupId: 'fam-1',
      ownerUserId: 'usr-1',
      name: 'Banco Principal',
      type: 'bank',
      initialBalance: 1000,
      currency: 'USD',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    };

    expect(account.id).toBe('acc-1');
    expect(account.type).toBe('bank');
    expect(account.initialBalance).toBe(1000);
    expect(account.isActive).toBe(true);
  });

  it('debe soportar tarjetas de crédito con día de cierre y de pago', () => {
    const creditCard: Account = {
      id: 'acc-cc',
      familyGroupId: 'fam-1',
      ownerUserId: 'usr-1',
      name: 'Tarjeta Visa Gold',
      type: 'credit_card',
      initialBalance: 0,
      currency: 'USD',
      isActive: true,
      closingDay: 15,
      paymentDay: 5,
      createdAt: '2026-01-01T00:00:00Z',
    };

    expect(creditCard.type).toBe('credit_card');
    expect(creditCard.closingDay).toBe(15);
    expect(creditCard.paymentDay).toBe(5);
  });

  it('debe permitir cuentas con visibilidad privada', () => {
    const privateAcc: Account = {
      id: 'acc-priv',
      familyGroupId: 'fam-1',
      ownerUserId: 'usr-1',
      name: 'Fondo Personal',
      type: 'cash',
      initialBalance: 200,
      currency: 'USD',
      isActive: true,
      isPrivate: true,
      createdAt: '2026-01-01T00:00:00Z',
    };

    expect(privateAcc.isPrivate).toBe(true);
  });
});
