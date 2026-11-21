import { z } from 'zod';

export const AccountTypeSchema = z.enum(['bank', 'cash', 'credit_card', 'loan', 'investment']);

export const CreateAccountSchema = z
  .object({
    id: z.string().optional(),
    name: z
      .string()
      .min(1, 'El nombre de la cuenta es requerido.')
      .max(100, 'El nombre no puede exceder 100 caracteres.'),
    type: AccountTypeSchema,
    initialBalance: z.number(),
    currency: z.string().default('COP'),
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
  })
  .refine(
    (data) => {
      // Regla de Negocio Fase 2: Las cuentas en moneda diferente a COP solo pueden catalogarse como inversiones (activos)
      if (data.currency && data.currency !== 'COP') {
        return data.type === 'investment';
      }
      return true;
    },
    {
      message: 'Las cuentas en moneda diferente a COP solo pueden catalogarse como inversiones (activos).',
      path: ['type'],
    }
  );

export type CreateAccountSchemaInput = z.infer<typeof CreateAccountSchema>;
