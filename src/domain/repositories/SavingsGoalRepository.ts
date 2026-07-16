/**
 * ZenMoney — Interface SavingsGoalRepository
 */

import { SavingsGoal, CreateSavingsGoalInput } from '../entities/SavingsGoal';

export interface SavingsGoalRepository {
  /**
   * Obtiene una meta de ahorro por su ID.
   */
  getById(id: string): Promise<SavingsGoal | null>;

  /**
   * Obtiene todas las metas de ahorro del grupo familiar del usuario.
   */
  getAll(): Promise<SavingsGoal[]>;

  /**
   * Crea una nueva meta de ahorro asociada al grupo familiar y usuario actual.
   */
  create(input: CreateSavingsGoalInput): Promise<SavingsGoal>;

  /**
   * Actualiza los datos de una meta de ahorro existente.
   */
  update(
    id: string,
    data: Partial<CreateSavingsGoalInput> & { status?: SavingsGoal['status'] }
  ): Promise<SavingsGoal>;

  /**
   * Elimina físicamente una meta de ahorro.
   */
  delete(id: string): Promise<void>;
}
