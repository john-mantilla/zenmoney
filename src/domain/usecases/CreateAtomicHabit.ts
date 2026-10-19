/**
 * ZenMoney — CreateAtomicHabit UseCase
 *
 * Crea y valida un hábito atómico vinculado a una categoría presupuestaria,
 * asegurando la consistencia de las reglas conductuales elegidas.
 */
import { AtomicHabit, CreateAtomicHabitInput } from '../entities/AtomicHabit';

export class CreateAtomicHabit {
  static execute(input: CreateAtomicHabitInput): AtomicHabit {
    const {
      id = `habit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      budgetId,
      categoryId,
      title,
      type,
      ruleConfig,
      suggestedActionAmount,
      defaultAccountId,
      merchantName = null,
      timeOfDayCue = 'evening',
      cueHour,
      isEnabled = true,
    } = input;

    if (!title || title.trim().length === 0) {
      throw new Error('El título del hábito atómico no puede estar vacío');
    }

    if (!budgetId || !categoryId) {
      throw new Error('El hábito atómico debe estar vinculado a un presupuesto y una categoría válida');
    }

    // Validación según el tipo de regla atómica
    switch (type) {
      case 'cap_per_occasion':
        if (!ruleConfig.maxCapPerOccasion || ruleConfig.maxCapPerOccasion <= 0) {
          throw new Error('El tope por ocasión debe ser un monto mayor a cero');
        }
        break;

      case 'no_spend_day':
        if (
          ruleConfig.noSpendDayOfWeek === undefined ||
          ruleConfig.noSpendDayOfWeek < 0 ||
          ruleConfig.noSpendDayOfWeek > 6
        ) {
          throw new Error('El día sin gasto debe ser un día válido de la semana (0 a 6)');
        }
        break;

      case 'max_frequency_weekly':
        if (
          !ruleConfig.maxTimesPerWeek ||
          ruleConfig.maxTimesPerWeek < 1 ||
          ruleConfig.maxTimesPerWeek > 7
        ) {
          throw new Error('La frecuencia semanal debe estar entre 1 y 7 veces por semana');
        }
        break;

      case 'daily_allowance':
        if (!ruleConfig.dailyAllowance || ruleConfig.dailyAllowance <= 0) {
          throw new Error('La asignación diaria debe ser un monto mayor a cero');
        }
        break;

      default:
        throw new Error(`Tipo de hábito no soportado: ${type}`);
    }

    const defaultCueHour = cueHour ?? (timeOfDayCue === 'morning' ? 8 : 21);

    return {
      id,
      budgetId,
      categoryId,
      title: title.trim(),
      type,
      ruleConfig,
      suggestedActionAmount: suggestedActionAmount && suggestedActionAmount > 0
        ? suggestedActionAmount
        : ruleConfig.maxCapPerOccasion,
      defaultAccountId,
      merchantName: merchantName ? merchantName.trim() : null,
      timeOfDayCue,
      cueHour: defaultCueHour,
      isEnabled,
      createdAt: new Date().toISOString(),
    };
  }
}
