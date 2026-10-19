import { z } from 'zod';

export const TransactionTypeSchema = z.enum(['income', 'expense', 'transfer']);

export const TransactionStatusSchema = z.enum(['confirmed', 'pending', 'archived']);

export const InputMethodSchema = z.enum(['manual', 'voice', 'nlq', 'email', 'photo']);

export const TransactionCategorySplitSchema = z.object({
  id: z.string(),
  categoryId: z.string().min(1, 'La categoría del desglose es requerida.'),
  amount: z.number().positive('El monto de cada desglose debe ser mayor a cero.'),
  note: z.string().nullable().optional(),
});

export const TransactionPeriodSplitSchema = z.object({
  totalMonths: z.number().int().min(2, 'El prorrateo debe ser de mínimo 2 meses.').max(36, 'El prorrateo no puede exceder 36 meses.'),
  monthlyAmount: z.number().positive('El monto mensual debe ser mayor a cero.'),
  startMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Formato de mes inicio inválido (YYYY-MM).'),
  endMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Formato de mes fin inválido (YYYY-MM).'),
  accountFlowDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD).'),
});

export const AIMetadataSchema = z.object({
  rawInput: z.string(),
  parsedAmount: z.number().nullable(),
  parsedCategory: z.string().nullable(),
  parsedAccount: z.string().nullable(),
  parsedMerchant: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  corrections: z.record(z.string(), z.object({ original: z.string(), corrected: z.string() })),
  dueDate: z.string().optional(),
  occurrenceDate: z.string().optional(),
  is_bank_notification: z.boolean().optional(),
  bank_name: z.string().optional(),
  installments: z.any().optional(),
  splits: z.array(TransactionCategorySplitSchema).optional(),
  periodSplit: TransactionPeriodSplitSchema.optional(),
});

export const CreateTransactionSchema = z
  .object({
    id: z.string().optional(),
    accountId: z.string().min(1, 'La cuenta es requerida.'),
    categoryId: z.string().nullable().optional(),
    type: TransactionTypeSchema,
    amount: z
      .number()
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
    splits: z.array(TransactionCategorySplitSchema).optional(),
    periodSplit: TransactionPeriodSplitSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.type !== 'transfer') {
        return !!data.categoryId || (!!data.splits && data.splits.length > 0);
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
      if (data.splits && data.splits.length > 0) {
        if (data.splits.length < 2) return false;
        const sum = data.splits.reduce((acc, s) => acc + s.amount, 0);
        return Math.abs(sum - data.amount) < 0.01;
      }
      return true;
    },
    {
      message: 'La suma de las categorías desglosadas debe ser igual al monto total de la transacción.',
      path: ['splits'],
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
