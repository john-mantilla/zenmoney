/**
 * ZenMoney — ExecuteMicroSweep UseCase
 *
 * Realiza el barrido simbólico de excedentes diarios no gastados (Micro-Sweep),
 * transfiriendo el remanente del Safe-to-Spend hacia una meta de ahorro o hucha virtual.
 * Cumple la 4ª Ley de Hábitos Atómicos: "Hacerlo Satisfactorio (Recompensa Inmediata)".
 */
export interface ExecuteMicroSweepInput {
  dailySurplus: number;
  targetSavingsGoalId: string;
  savingsGoalTitle: string;
  date?: string; // YYYY-MM-DD
}

export interface ExecuteMicroSweepResult {
  sweptAmount: number;
  targetSavingsGoalId: string;
  date: string;
  celebrationMessage: string;
}

export class ExecuteMicroSweep {
  static execute(input: ExecuteMicroSweepInput): ExecuteMicroSweepResult {
    const {
      dailySurplus,
      targetSavingsGoalId,
      savingsGoalTitle,
      date = new Date().toISOString().split('T')[0],
    } = input;

    if (!dailySurplus || dailySurplus <= 0) {
      throw new Error('No hay excedente diario disponible para realizar el barrido de ahorro');
    }

    if (!targetSavingsGoalId) {
      throw new Error('Se requiere una meta de ahorro vinculada para recibir el micro-ahorro');
    }

    const formattedAmount = `$${dailySurplus.toLocaleString('es-CO')}`;

    return {
      sweptAmount: dailySurplus,
      targetSavingsGoalId,
      date,
      celebrationMessage: `🎉 ¡Micro-victoria acreditada! Transferiste ${formattedAmount} de tu disponible no gastado a tu meta "${savingsGoalTitle}".`,
    };
  }
}
