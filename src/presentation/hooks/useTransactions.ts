import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HybridTransactionRepository } from '@/src/data/repositories/HybridTransactionRepository';
import { TransactionFilters, Transaction, CreateTransactionInput } from '@/src/domain/entities/Transaction';
import { queryKeys } from '@/src/infrastructure/state/queryClient';

const transactionRepo = new HybridTransactionRepository();

/**
 * Hook para consultar transacciones con caché automático y deduplicación.
 */
export function useTransactionsQuery(filters?: TransactionFilters) {
  return useQuery({
    queryKey: queryKeys.transactions.filtered(filters || {}),
    queryFn: () => transactionRepo.getAll(filters),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook de mutación para crear transacciones con invalidación selectiva de caché.
 */
export function useCreateTransactionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTransactionInput) => transactionRepo.create(input),
    onSuccess: () => {
      // Invalida transacciones, saldos de cuenta, presupuestos y resumen consolidado
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    },
  });
}

/**
 * Hook de mutación para actualizar transacciones.
 */
export function useUpdateTransactionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTransactionInput> }) =>
      transactionRepo.update(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.byId(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    },
  });
}

/**
 * Hook de mutación para eliminar transacciones.
 */
export function useDeleteTransactionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => transactionRepo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    },
  });
}
