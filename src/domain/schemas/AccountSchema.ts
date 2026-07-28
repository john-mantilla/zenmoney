import { z } from 'zod';

export const AccountTypeSchema = z.enum(['bank', 'cash', 'credit_card', 'loan', 'investment'], {
  errorMap: () => ({ message: 'Tipo de cuenta no válido.' }),
});

export const CreateAccountSchema = z.object({
  id: z.string().optional(),
  name: z
    .string({ required_error: 'El nombre de la cuenta es requerido.' })
    .min(1, 'El nombre de la cuenta es requerido.')
    .max(100, 'El nombre no puede exceder 100 caracteres.'),
  type: AccountTypeSchema,
  initialBalance: z.number({ required_error: 'El saldo inicial es requerido.' }),
  currency: z.string().default('USD'),
  closingDay: z
    .number()
    .int()
    .min(1, 'El día de cierre debe estar entre 1 y 31.')
    .max(31, 'El día de cierre debe estar entre 1 y 31.')
    .nullable()
    .optional(),
  paymentDay: z
    .number()
    .int()
    .min(1, 'El día de pago debe estar entre 1 y 31.')
    .max(31, 'El día de pago debe estar entre 1 y 31.')
    .nullable()
    .optional(),
  isPrivate: z.boolean().default(false),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export type CreateAccountSchemaInput = z.infer<typeof CreateAccountSchema>;
