import { z } from 'zod';

export const FrequencySchema = z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'yearly'], {
  errorMap: () => ({ message: 'Frecuencia no válida.' }),
});

export const CreateRecurringRuleSchema = z.object({
  id: z.string().optional(),
  accountId: z.string().min(1, 'La cuenta es requerida.'),
  categoryId: z.string().nullable().optional(),
  type: z.enum(['income', 'expense']),
  amount: z.number().positive('El monto debe ser mayor a cero.'),
  description: z.string().max(300).nullable().optional(),
  frequency: FrequencySchema,
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD).'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export type CreateRecurringRuleSchemaInput = z.infer<typeof CreateRecurringRuleSchema>;
