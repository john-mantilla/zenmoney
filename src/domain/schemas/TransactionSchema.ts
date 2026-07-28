import { z } from 'zod';

export const TransactionTypeSchema = z.enum(['income', 'expense', 'transfer'], {
  errorMap: () => ({ message: 'El tipo de transacción debe ser income, expense o transfer.' }),
});

export const TransactionStatusSchema = z.enum(['confirmed', 'pending', 'archived'], {
  errorMap: () => ({ message: 'El estado de la transacción debe ser confirmed, pending o archived.' }),
});

export const InputMethodSchema = z.enum(['manual', 'voice', 'nlq', 'email', 'photo']);

export const AIMetadataSchema = z.object({
  rawInput: z.string(),
  parsedAmount: z.number().nullable(),
  parsedCategory: z.string().nullable(),
  parsedAccount: z.string().nullable(),
  parsedMerchant: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  corrections: z.record(z.object({ original: z.string(), corrected: z.string() })),
  dueDate: z.string().optional(),
  occurrenceDate: z.string().optional(),
});

export const CreateTransactionSchema = z
  .object({
    id: z.string().optional(),
    accountId: z.string({ required_error: 'La cuenta es requerida.' }).min(1, 'La cuenta es requerida.'),
    categoryId: z.string().nullable().optional(),
    type: TransactionTypeSchema,
    amount: z
      .number({ required_error: 'El monto es requerido.' })
      .positive('El monto de la transacción debe ser mayor a cero.'),
    currency: z.string().default('USD'),
    description: z.string().max(500, 'La descripción no puede exceder 500 caracteres.').nullable().optional(),
    merchantName: z.string().max(200).nullable().optional(),
    transactionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD).')
      .optional(),
    transferToAccountId: z.string().nullable().optional(),
    inputMethod: InputMethodSchema.default('manual'),
    aiMetadata: AIMetadataSchema.nullable().optional(),
    isPrivate: z.boolean().default(false),
    status: TransactionStatusSchema.default('confirmed'),
  })
  .refine(
    (data) => {
      if (data.type !== 'transfer') {
        return !!data.categoryId;
      }
      return true;
    },
    {
      message: 'Las transacciones de ingreso o gasto requieren una categoría.',
      path: ['categoryId'],
    }
  )
  .refine(
    (data) => {
      if (data.type === 'transfer') {
        return !!data.transferToAccountId;
      }
      return true;
    },
    {
      message: 'Las transferencias requieren una cuenta de destino.',
      path: ['transferToAccountId'],
    }
  )
  .refine(
    (data) => {
      if (data.type === 'transfer' && data.transferToAccountId) {
        return data.transferToAccountId !== data.accountId;
      }
      return true;
    },
    {
      message: 'La cuenta de destino no puede ser la misma cuenta de origen.',
      path: ['transferToAccountId'],
    }
  );

export type CreateTransactionSchemaInput = z.infer<typeof CreateTransactionSchema>;
