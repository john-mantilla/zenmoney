import { z } from 'zod';

export const CreateSavingsGoalSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'El nombre de la meta es requerido.').max(150),
  targetAmount: z.number().positive('La meta de ahorro debe ser mayor a cero.'),
  currentAmount: z.number().min(0, 'El monto acumulado no puede ser negativo.').default(0),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD).'),
});

export type CreateSavingsGoalSchemaInput = z.infer<typeof CreateSavingsGoalSchema>;
