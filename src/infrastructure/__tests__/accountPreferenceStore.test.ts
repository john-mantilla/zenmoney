import { describe, it, expect, beforeEach } from 'vitest';
import { useAccountPreferenceStore } from '../state/accountPreferenceStore';

describe('accountPreferenceStore', () => {
  const mockAccounts = [
    { id: 'acc-credit', name: 'Tarjeta Crédito', type: 'credit_card', isActive: true },
    { id: 'acc-bank', name: 'Cuenta Corriente', type: 'bank', isActive: true },
    { id: 'acc-cash', name: 'Efectivo', type: 'cash', isActive: true },
    { id: 'acc-inactive', name: 'Vieja Cuenta', type: 'bank', isActive: false },
  ];

  beforeEach(() => {
    useAccountPreferenceStore.setState({
      defaultAccountId: null,
      lastUsedAccountId: null,
    });
  });

  it('prioriza explicitId si se suministra y existe', () => {
    const store = useAccountPreferenceStore.getState();
    const result = store.getPreferredAccountId(mockAccounts, 'acc-cash');
    expect(result).toBe('acc-cash');
  });

  it('retorna defaultAccountId si está configurado', () => {
    useAccountPreferenceStore.setState({ defaultAccountId: 'acc-bank' });
    const store = useAccountPreferenceStore.getState();
    const result = store.getPreferredAccountId(mockAccounts);
    expect(result).toBe('acc-bank');
  });

  it('retorna lastUsedAccountId si no hay defaultAccountId', () => {
    useAccountPreferenceStore.setState({ lastUsedAccountId: 'acc-cash' });
    const store = useAccountPreferenceStore.getState();
    const result = store.getPreferredAccountId(mockAccounts);
    expect(result).toBe('acc-cash');
  });

  it('defaultAccountId tiene prioridad sobre lastUsedAccountId', () => {
    useAccountPreferenceStore.setState({
      defaultAccountId: 'acc-bank',
      lastUsedAccountId: 'acc-credit',
    });
    const store = useAccountPreferenceStore.getState();
    const result = store.getPreferredAccountId(mockAccounts);
    expect(result).toBe('acc-bank');
  });

  it('prioriza cuenta tipo bank/cash sobre credit_card como fallback inteligente si no hay preferencias', () => {
    const store = useAccountPreferenceStore.getState();
    const result = store.getPreferredAccountId(mockAccounts);
    expect(result).toBe('acc-bank');
  });

  it('ignora cuentas inactivas en defaultAccountId o lastUsedAccountId', () => {
    useAccountPreferenceStore.setState({ defaultAccountId: 'acc-inactive' });
    const store = useAccountPreferenceStore.getState();
    const result = store.getPreferredAccountId(mockAccounts);
    // Debe ignorar la inactiva y caer en el fallback bancario
    expect(result).toBe('acc-bank');
  });
});
