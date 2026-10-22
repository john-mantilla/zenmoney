/**
 * ZenMoney — Entidad y Tipos de Escenarios Financieros What-If
 */

import { CashFlowForecast, DailyLiquidityPoint } from './CashFlowForecast';

export type ScenarioType = 'loan' | 'card_purchase';
export type InterestRateType = 'EA' | 'EM';

export interface LoanScenarioInput {
  name: string;
  type: ScenarioType;
  principal: number; // Monto solicitado o financiado
  months: number; // Plazo en meses
  interestRate: number; // Tasa de interés (ej. 2.0 para 2% EM, o 26.8 para 26.8% EA)
  rateType: InterestRateType; // 'EA' | 'EM'
  startDate?: string; // Fecha del desembolso o compra (YYYY-MM-DD)
  firstPaymentDate?: string; // Fecha de la primera cuota (YYYY-MM-DD)
}

export interface ScenarioComparison {
  scenario: LoanScenarioInput;
  baseForecast: CashFlowForecast;
  simulatedPoints: DailyLiquidityPoint[];
  monthlyInstallment: number;
  totalInterestPaid: number;
  totalPaid: number;
  endingSimulatedBalance: number;
  minimumSimulatedBalance: number;
  causesNewDeficit: boolean;
  deficitDate?: string | null;
  daysToDeficit?: number | null;
  netImpactOnLiquidity: number;
}
