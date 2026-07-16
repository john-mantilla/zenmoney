/**
 * ZenMoney — Caso de Uso: GenerateRecurringInstances
 *
 * Genera, en una sola pasada, todas las facturas/movimientos de una regla recurrente
 * entre dos fechas (inclusive). Pensado para ejecutarse UNA SOLA VEZ — justo después de
 * crear la regla (con toda su fecha de inicio y fin ya definidas), o al extender su fecha
 * de fin — y nunca de forma automática en cada carga de pantalla. Esto es deliberado: la
 * versión anterior recalculaba/reconciliaba la recurrencia en cada `useFocusEffect`, lo que
 * hacía que mover o editar una factura ya creada pareciera "recrear" otra por detrás.
 * Con generación explícita y de una sola vez, una vez creadas las facturas quedan fijas:
 * el usuario puede mover la fecha o el monto de cualquiera sin que el sistema las vuelva
 * a tocar.
 */

import { TransactionRepository } from '../repositories/TransactionRepository';
import { RecurringRule } from '../entities/RecurringRule';
import { Transaction } from '../entities/Transaction';

export class GenerateRecurringInstances {
  constructor(private transactionRepo: TransactionRepository) {}

  /**
   * Genera todas las ocurrencias de `rule` entre `fromDateStr` y `toDateStr` (ambas
   * inclusive, formato YYYY-MM-DD). Es idempotente: si alguna fecha de ese rango ya tiene
   * una instancia creada para esta regla, se omite — así se puede llamar de forma segura
   * tanto al crear la regla como al extender su fecha de fin, o al agregarle por primera
   * vez una fecha de fin a una regla antigua que no la tenía, sin duplicar nada.
   */
  async execute(rule: RecurringRule, fromDateStr: string, toDateStr: string): Promise<Transaction[]> {
    const fromDate = new Date(fromDateStr);
    const toDate = new Date(toDateStr);
    if (fromDate > toDate) return [];

    const occurrenceDates = this.calculateOccurrenceDates(fromDate, toDate, rule);
    const todayStr = new Date().toISOString().split('T')[0];
    const created: Transaction[] = [];

    const existingInstances = await this.transactionRepo.getAll({ recurringRuleId: rule.id });
    const existingDates = new Set(
      existingInstances.map(tx => tx.aiMetadata?.occurrenceDate || tx.aiMetadata?.dueDate || tx.transactionDate)
    );

    for (const occurrenceDate of occurrenceDates) {
      if (existingDates.has(occurrenceDate)) continue;
      const newTx = await this.transactionRepo.create({
        accountId: rule.accountId,
        categoryId: rule.categoryId,
        type: rule.type,
        amount: rule.amount,
        description: rule.description || `Recurrente: ${rule.frequency}`,
        transactionDate: occurrenceDate,
        inputMethod: 'manual',
        transferToAccountId: null,
        ...({
          isRecurringInstance: true,
          recurringRuleId: rule.id,
          // Ingresos ya transcurridos se asumen recibidos (confirmados); los futuros quedan
          // como "pendientes/proyectados". Los gastos siempre nacen pendientes (por pagar).
          status: rule.type === 'income' && occurrenceDate <= todayStr ? 'confirmed' : 'pending',
          aiMetadata: {
            rawInput: '',
            parsedAmount: rule.amount,
            parsedCategory: null,
            parsedAccount: null,
            parsedMerchant: null,
            confidence: 1,
            corrections: {},
            dueDate: occurrenceDate,
            occurrenceDate,
          },
        } as any),
      });
      created.push(newTx);
    }

    return created;
  }

  /**
   * Calcula las fechas de ocurrencia de una regla recurrente en un rango de tiempo.
   */
  private calculateOccurrenceDates(start: Date, end: Date, rule: RecurringRule): string[] {
    const dates: string[] = [];
    const current = new Date(start.getTime());

    // Ajustar zona horaria local a UTC medianoche
    current.setUTCHours(0, 0, 0, 0);
    const limit = new Date(end.getTime());
    limit.setUTCHours(0, 0, 0, 0);

    while (current <= limit) {
      dates.push(current.toISOString().split('T')[0]);

      // Incrementar según frecuencia usando métodos UTC
      if (rule.frequency === 'daily') {
        current.setUTCDate(current.getUTCDate() + 1);
      } else if (rule.frequency === 'weekly') {
        current.setUTCDate(current.getUTCDate() + 7);
      } else if (rule.frequency === 'biweekly') {
        current.setUTCDate(current.getUTCDate() + 14);
      } else if (rule.frequency === 'monthly') {
        let nextYear = current.getUTCFullYear();
        let nextMonth = current.getUTCMonth() + 1;
        if (nextMonth > 11) {
          nextMonth = 0;
          nextYear += 1;
        }
        const targetDay = rule.dayOfMonth || start.getUTCDate();
        const lastDayOfTargetMonth = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
        const safeDay = Math.min(targetDay, lastDayOfTargetMonth);
        current.setUTCFullYear(nextYear, nextMonth, safeDay);
      } else if (rule.frequency === 'yearly') {
        const nextYear = current.getUTCFullYear() + 1;
        const targetMonth = start.getUTCMonth();
        const targetDay = start.getUTCDate();
        const lastDayOfTargetMonth = new Date(Date.UTC(nextYear, targetMonth + 1, 0)).getUTCDate();
        const safeDay = Math.min(targetDay, lastDayOfTargetMonth);
        current.setUTCFullYear(nextYear, targetMonth, safeDay);
      } else {
        break;
      }
    }

    return dates;
  }
}
