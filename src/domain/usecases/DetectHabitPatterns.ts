/**
 * ZenMoney — DetectHabitPatterns UseCase (ZenHabits)
 *
 * Analiza transacciones confirmadas para identificar rutinas y hábitos semanales
 * de consumo (por día de la semana), descartando facturas contractuales.
 */
import { Transaction } from '../entities/Transaction';
import { Category } from '../entities/Category';
import { HabitPattern } from '../entities/HabitPattern';

const DAY_NAMES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

export class DetectHabitPatterns {
  /**
   * Ejecuta el escaneo de patrones de hábitos en los gastos históricos.
   * Requiere al menos 3 ocurrencias en el mismo día de la semana en semanas distintas.
   */
  static execute(expenses: Transaction[], categories: Category[] = []): HabitPattern[] {
    const validExpenses = expenses.filter(
      (tx) => tx.type === 'expense' && tx.status === 'confirmed' && tx.amount > 0
    );

    // Mapeo rápido de categorías
    const catMap = new Map<string, Category>();
    for (const c of categories) {
      catMap.set(c.id, c);
    }

    // Agrupador: clave compuesta por `dayOfWeek` + (merchantName || categoryId)
    interface GroupData {
      dayOfWeek: number;
      merchantName: string | null;
      categoryId?: string;
      transactions: Transaction[];
      distinctDates: Set<string>;
    }

    const groups = new Map<string, GroupData>();

    for (const tx of validExpenses) {
      const merchantClean = (tx.merchantName || tx.description || '').trim();
      const normMerchant = merchantClean.toLowerCase();
      
      // Descartar compras financieras / transferencias / pagos de tarjeta
      if (
        normMerchant.includes('pago tarjeta') ||
        normMerchant.includes('cuota') ||
        normMerchant.includes('abono') ||
        normMerchant.includes('transferencia')
      ) {
        continue;
      }

      // Descartar si pertenece a categoría de costos fijos contractuales
      if (tx.categoryId) {
        const cat = catMap.get(tx.categoryId);
        if (cat?.budgetRole === 'fixed') {
          const catNameLower = cat.name.toLowerCase();
          if (
            catNameLower.includes('arriendo') ||
            catNameLower.includes('servicios') ||
            catNameLower.includes('impuesto') ||
            catNameLower.includes('seguro')
          ) {
            continue;
          }
        }
      }

      // Descartar compras de supermercado general / mercado del hogar
      // Mercar no es un "hábito de ocio/estilo de vida" a alertar semanalmente como salir a pizza/café
      const groceryKeywords = [
        'ara', 'd1', 'oxxo', 'exito', 'éxito', 'jumbo', 'olimpica', 'olímpica',
        'carulla', 'metro', 'alkosto', 'makro', 'surtimax', 'supermercado',
        'fruver', 'carniceria', 'carnicería', 'minimercado', 'tienda de barrio'
      ];
      if (groceryKeywords.some((g) => normMerchant === g || normMerchant.startsWith(`${g} `) || normMerchant.endsWith(` ${g}`))) {
        continue;
      }

      // Extraer día de la semana seguro (evitando desfase horario UTC)
      const datePart = tx.transactionDate.split('T')[0];
      const parsedDate = new Date(`${datePart}T12:00:00`);
      const dayOfWeek = parsedDate.getDay();

      const groupKey = `${dayOfWeek}::${normMerchant || tx.categoryId || 'misc'}`;
      let group = groups.get(groupKey);
      if (!group) {
        group = {
          dayOfWeek,
          merchantName: tx.merchantName ? tx.merchantName.trim() : null,
          categoryId: tx.categoryId || undefined,
          transactions: [],
          distinctDates: new Set<string>(),
        };
        groups.set(groupKey, group);
      }

      group.transactions.push(tx);
      group.distinctDates.add(datePart);
    }

    const detectedHabits: HabitPattern[] = [];

    for (const [, group] of groups) {
      // Condición: al menos 3 fechas distintas en ese mismo día de la semana
      if (group.distinctDates.size >= 3) {
        const amounts = group.transactions.map((t) => t.amount);
        const sum = amounts.reduce((acc, curr) => acc + curr, 0);
        const avg = Math.round(sum / amounts.length);

        // Varianza para calcular confianza
        const variance =
          amounts.reduce((acc, curr) => acc + Math.pow(curr - avg, 2), 0) /
          amounts.length;
        const stdDev = Math.sqrt(variance);
        const cv = avg > 0 ? stdDev / avg : 1; // Coeficiente de variación

        // Si el monto no es caótico (CV < 0.35 para hábitos con valores consistentes)
        if (cv < 0.35) {
          const sampleTx = group.transactions[group.transactions.length - 1];
          const merchantName = group.merchantName;
          const dayName = DAY_NAMES[group.dayOfWeek];

          let icon = 'repeat';
          const textForIcon = `${merchantName || ''} ${sampleTx.description || ''}`.toLowerCase();

          if (textForIcon.includes('pizza') || textForIcon.includes('domino')) icon = 'pizza';
          else if (textForIcon.includes('caf') || textForIcon.includes('starbucks') || textForIcon.includes('juan valdez')) icon = 'coffee';
          else if (textForIcon.includes('burger') || textForIcon.includes('hamburguesa')) icon = 'hamburger';
          else if (textForIcon.includes('cine') || textForIcon.includes('pelicula') || textForIcon.includes('cinecolombia')) icon = 'movie';
          else if (textForIcon.includes('cerve') || textForIcon.includes('bar')) icon = 'glass-cocktail';
          else if (textForIcon.includes('restaurante') || textForIcon.includes('almuerzo')) icon = 'silverware-fork-knife';
          else if (textForIcon.includes('gasolin') || textForIcon.includes('combustible') || textForIcon.includes('terpel') || textForIcon.includes('primax')) icon = 'gas-station';
          else if (textForIcon.includes('futbol') || textForIcon.includes('gym') || textForIcon.includes('deporte') || textForIcon.includes('smartfit')) icon = 'soccer';

          const title = merchantName
            ? `${dayName} de ${merchantName}`
            : `${dayName} habitual`;

          // Confianza basada en frecuencia y estabilidad del monto
          const confidence = Math.min(
            1,
            Math.max(0.6, 0.5 + (group.distinctDates.size * 0.1) - (cv * 0.2))
          );

          detectedHabits.push({
            id: `habit_${group.dayOfWeek}_${(merchantName || group.categoryId || 'habit').replace(/\s+/g, '_').toLowerCase()}`,
            title,
            dayOfWeek: group.dayOfWeek,
            timePrompt: '21:00', // Al terminar el plan
            defaultAccountId: sampleTx.accountId,
            defaultCategoryId: sampleTx.categoryId || undefined,
            merchantName,
            estimatedAmount: avg,
            confidenceScore: parseFloat(confidence.toFixed(2)),
            isActive: true,
            consecutiveSkips: 0,
            icon,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    return detectedHabits;
  }

  execute(expenses: Transaction[], categories: Category[] = []): HabitPattern[] {
    return DetectHabitPatterns.execute(expenses, categories);
  }
}
