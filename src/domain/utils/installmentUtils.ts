/**
 * ZenMoney — Utilidades para Compras Diferidas a Cuotas (Installments)
 *
 * Facilita el cálculo preciso de fechas mensuales, redondeo monetario
 * y generación de transacciones diferidas para tarjetas de crédito.
 */

import { CreateTransactionInput, InstallmentMetadata } from '../entities/Transaction';
import { generateUUID } from '../../infrastructure/utils/uuid';

/**
 * Calcula la fecha de una cuota desplazada N meses respecto a la fecha inicial,
 * preservando el día del mes y ajustando automáticamente si el mes de destino
 * tiene menos días (ej. 31 de enero -> 28/29 de febrero).
 *
 * @param startDateStr Fecha en formato 'YYYY-MM-DD'
 * @param monthOffset Número de meses a desplazar (0 para la primera cuota, 1 para la segunda, etc.)
 */
export function calculateInstallmentDate(startDateStr: string, monthOffset: number): string {
  if (!startDateStr || monthOffset === 0) {
    return startDateStr;
  }

  const parts = startDateStr.split('-');
  if (parts.length !== 3) {
    return startDateStr;
  }

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  // targetMonth en índice 0 (0 = Enero, 11 = Diciembre)
  const targetMonthIndex = month - 1 + monthOffset;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;

  // Obtener el último día del mes destino
  const daysInTargetMonth = new Date(targetYear, normalizedMonthIndex + 1, 0).getDate();
  const adjustedDay = Math.min(day, daysInTargetMonth);

  const mStr = String(normalizedMonthIndex + 1).padStart(2, '0');
  const dStr = String(adjustedDay).padStart(2, '0');

  return `${targetYear}-${mStr}-${dStr}`;
}

/**
 * Genera la lista de transacciones diferidas a partir de una transacción base.
 * - Si count <= 1, devuelve la transacción base sin modificaciones.
 * - Reparte el monto equitativamente y asigna cualquier residuo a la primera cuota.
 * - Asigna un `groupId` común en `aiMetadata.installments`.
 */
export function generateInstallmentTransactions(
  baseInput: CreateTransactionInput,
  count: number,
  customGroupId?: string
): CreateTransactionInput[] {
  const safeCount = Math.max(1, Math.floor(count));
  if (safeCount <= 1) {
    return [baseInput];
  }

  const totalAmount = Math.round(Number(baseInput.amount) || 0);
  const groupId = customGroupId || generateUUID();
  const startDate = baseInput.transactionDate || new Date().toISOString().split('T')[0];

  const baseMonthlyAmount = Math.floor(totalAmount / safeCount);
  const remainder = totalAmount - (baseMonthlyAmount * safeCount);

  const results: CreateTransactionInput[] = [];

  for (let i = 0; i < safeCount; i++) {
    const currentNumber = i + 1;
    // El residuo por redondeo se añade a la primera cuota
    const installmentAmount = (i === 0) ? (baseMonthlyAmount + remainder) : baseMonthlyAmount;
    const installmentDate = calculateInstallmentDate(startDate, i);

    const baseDesc = (baseInput.description || '').trim();
    const installmentSuffix = `(Cuota ${currentNumber}/${safeCount})`;
    const finalDescription = baseDesc
      ? `${baseDesc} ${installmentSuffix}`
      : `Compra diferida ${installmentSuffix}`;

    const installmentMeta: InstallmentMetadata = {
      groupId,
      totalAmount,
      count: safeCount,
      currentNumber,
      monthlyAmount: installmentAmount,
      startDate,
    };

    results.push({
      ...baseInput,
      id: generateUUID(),
      amount: installmentAmount,
      description: finalDescription,
      transactionDate: installmentDate,
      aiMetadata: {
        ...(baseInput.aiMetadata || {
          rawInput: '',
          parsedAmount: null,
          parsedCategory: null,
          parsedAccount: null,
          parsedMerchant: null,
          confidence: 1,
          corrections: {},
        }),
        installments: installmentMeta,
      },
    });
  }

  return results;
}
