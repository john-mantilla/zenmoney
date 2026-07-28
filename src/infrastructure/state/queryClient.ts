import { QueryClient } from '@tanstack/react-query';

/**
 * Cliente global de TanStack Query para ZenMoney.
 * Configurado con estrategia Stale-While-Revalidate:
 * - staleTime: 5 minutos (datos frescos en memoria sin refetch en navegación)
 * - gcTime: 10 minutos (tiempo de recolección de basura de cachés inactivos)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min
      gcTime: 10 * 60 * 1000,    // 10 min
      refetchOnWindowFocus: false, // En React Native se maneja manualmente o vía focus
      retry: 1,
    },
  },
});

/**
 * Fábrica estandarizada de llaves de consulta (Query Keys) para invalidación limpia y reactiva.
 */
export const queryKeys = {
  transactions: {
    all: ['transactions'] as const,
    filtered: (filters: Record<string, any>) => ['transactions', filters] as const,
    byId: (id: string) => ['transactions', 'detail', id] as const,
  },
  accounts: {
    all: ['accounts'] as const,
    byId: (id: string) => ['accounts', 'detail', id] as const,
    balances: ['accounts', 'balances'] as const,
  },
  budgets: {
    all: ['budgets'] as const,
    period: (year: number, month: number) => ['budgets', year, month] as const,
  },
  categories: {
    all: ['categories'] as const,
  },
  summary: {
    period: (startDate: string, endDate: string) => ['summary', startDate, endDate] as const,
  },
};
