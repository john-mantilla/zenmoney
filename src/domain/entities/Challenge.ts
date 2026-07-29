/**
 * ZenMoney — Entidad de Dominio: Challenge (Micro-Desafíos de 7 Días)
 *
 * Representa un reto de ciclo corto (7 días) basado en Hábitos Atómicos (James Clear)
 * enfocado en crear victorias de identidad sin presión a 30 días.
 */

export type ChallengeType = 'streak_7_days' | 'frugal_7_days' | 'family_team_7_days';
export type ChallengeStatus = 'active' | 'completed' | 'failed';

export interface ChallengeDayStatus {
  dayNumber: number; // 1 a 7
  date: string; // YYYY-MM-DD
  isCompleted: boolean;
  isToday: boolean;
}

export interface Challenge {
  id: string;
  type: ChallengeType;
  title: string;
  description: string;
  icon: string;
  targetDays: number; // 7
  completedDays: number; // 0 a 7
  days: ChallengeDayStatus[];
  startDate: string;
  endDate: string;
  status: ChallengeStatus;
  rewardBadgeTitle: string;
}
