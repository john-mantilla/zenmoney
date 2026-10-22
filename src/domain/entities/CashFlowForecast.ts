/**
 * ZenMoney — Entidad y Tipos de Pronóstico de Flujo de Caja
 */

export type ForecastHorizonDays = 30 | 60 | 90 | 180;
export type ForecastSpendingMode = 'commitments_only' | 'total_projected';

export interface ForecastDayEvent {
  description: string;
  amount: number;
  type: 'income' | 'expense';
  source: 'bill' | 'recurrence';
}

export interface DailyLiquidityPoint {
  date: string; // YYYY-MM-DD
  dayIndex: number; // 0 a H
  openingBalance: number;
  inflows: number; // Ingresos de facturas o recurrencias del día
  outflows: number; // Gastos de facturas o recurrencias del día
  organicSpending: number; // Gasto variable diario estimado
  closingBalance: number; // Saldo final del día
  netChange: number; // inflows - outflows - organicSpending
  events: ForecastDayEvent[];
}

export interface ForecastOptions {
  horizonDays: ForecastHorizonDays;
  spendingMode: ForecastSpendingMode;
  todayStr?: string; // YYYY-MM-DD
  minimumReserveThreshold?: number; // Por defecto 0
  dailyOrganicSpendingRate?: number; // Estimado diario de gasto variable
}

export interface CashFlowForecast {
  initialLiquidity: number;
  horizonDays: ForecastHorizonDays;
  spendingMode: ForecastSpendingMode;
  points: DailyLiquidityPoint[];
  endingBalance: number;
  minimumBalance: number;
  minimumBalanceDate: string;
  isAtRisk: boolean;
  deficitDate?: string | null;
  daysToDeficit?: number | null;
  totalInflows: number;
  totalOutflows: number;
  totalOrganicSpending: number;
}
