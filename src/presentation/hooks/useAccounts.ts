import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HybridAccountRepository } from '@/src/data/repositories/HybridAccountRepository';
import { CreateAccountInput } from '@/src/domain/entities/Account';
import { queryKeys } from '@/src/infrastructure/state/queryClient';

const accountRepo = new HybridAccountRepository();

/**
 * Hook para consultar el listado de cuentas y saldos en caché.
 */
export function useAccountsQuery() {
  return useQuery({
    queryKey: queryKeys.accounts.all,
    queryFn: () => accountRepo.getAll(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook de mutación para crear cuentas.
 */
export function useCreateAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAccountInput) => accountRepo.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
  });
}
