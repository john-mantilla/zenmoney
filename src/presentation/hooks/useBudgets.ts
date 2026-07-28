import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HybridBudgetRepository } from '@/src/data/repositories/HybridBudgetRepository';
import { CreateBudgetInput } from '@/src/domain/entities/Budget';
import { queryKeys } from '@/src/infrastructure/state/queryClient';

const budgetRepo = new HybridBudgetRepository();

/**
 * Hook para consultar presupuestos por período (año/mes) en caché.
 */
export function useBudgetsQuery(year: number, month: number) {
  return useQuery({
    queryKey: queryKeys.budgets.period(year, month),
    queryFn: () => budgetRepo.getByMonth(year, month),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook de mutación para crear presupuestos.
 */
export function useCreateBudgetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBudgetInput) => budgetRepo.create(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.period(variables.year, variables.month) });
    },
  });
}
