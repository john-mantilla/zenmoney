/**
 * ZenMoney — usePreferredAccount Hook
 *
 * Expone la cuenta principal, la última cuenta usada y el selector unificado
 * para resolver cuentas predeterminadas en formularios y modales.
 */
import { useAccountPreferenceStore } from '@/src/infrastructure/state/accountPreferenceStore';
import { Account } from '@/src/domain/entities/Account';

export function usePreferredAccount() {
  const defaultAccountId = useAccountPreferenceStore((state) => state.defaultAccountId);
  const lastUsedAccountId = useAccountPreferenceStore((state) => state.lastUsedAccountId);
  const setDefaultAccountId = useAccountPreferenceStore((state) => state.setDefaultAccountId);
  const setLastUsedAccountId = useAccountPreferenceStore((state) => state.setLastUsedAccountId);
  const getPreferredAccountId = useAccountPreferenceStore((state) => state.getPreferredAccountId);

  return {
    defaultAccountId,
    lastUsedAccountId,
    setDefaultAccountId,
    setLastUsedAccountId,
    resolveAccount: (accounts: Account[], explicitId?: string | null) =>
      getPreferredAccountId(accounts, explicitId),
  };
}
