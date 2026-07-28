import { describe, it, expect } from 'vitest';
import { queryClient, queryKeys } from '../state/queryClient';

describe('TanStack Query Infrastructure & Cache Configuration', () => {
  it('instancia el QueryClient global con staleTime de 5 min y gcTime de 10 min', () => {
    const defaultOptions = queryClient.getDefaultOptions();

    expect(defaultOptions.queries?.staleTime).toBe(5 * 60 * 1000);
    expect(defaultOptions.queries?.gcTime).toBe(10 * 60 * 1000);
    expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(false);
  });

  it('genera llaves de consulta (queryKeys) estandarizadas e inmutables', () => {
    expect(queryKeys.transactions.all).toEqual(['transactions']);
    expect(queryKeys.transactions.filtered({ accountId: 'acc-1' })).toEqual(['transactions', { accountId: 'acc-1' }]);
    expect(queryKeys.transactions.byId('tx-123')).toEqual(['transactions', 'detail', 'tx-123']);

    expect(queryKeys.accounts.all).toEqual(['accounts']);
    expect(queryKeys.accounts.byId('acc-55')).toEqual(['accounts', 'detail', 'acc-55']);

    expect(queryKeys.budgets.period(2026, 7)).toEqual(['budgets', 2026, 7]);
    expect(queryKeys.summary.period('2026-07-01', '2026-07-31')).toEqual(['summary', '2026-07-01', '2026-07-31']);
  });
});
