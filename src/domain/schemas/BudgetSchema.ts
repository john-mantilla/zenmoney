import { z } from 'zod';

export const BudgetScopeSchema = z.enum(['family', 'individual']);

export const CreateBudgetSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string({ required_error: 'La categoría es requerida.' }).min(1, 'La categoría es requerida.'),
  amountLimit: z
    .number({ required_error: 'El límite de presupuesto es requerido.' })
    .positive('El límite del presupuesto debe ser mayor a cero.'),
  year: z.number().int().min(2020, 'Año no válido.').max(2100, 'Año no válido.'),
  month: z.number().int().min(1, 'El mes debe estar entre 1 y 12.').max(12, 'El mes debe estar entre 1 y 12.'),
  scope: BudgetScopeSchema.default('family'),
  ownerUserId: z.string().nullable().optional(),
});

export type CreateBudgetSchemaInput = z.infer<typeof CreateBudgetSchema>;
