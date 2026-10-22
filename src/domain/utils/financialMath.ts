/**
 * ZenMoney — Utilidades de Matemática Financiera y Amortización
 *
 * Implementa fórmulas estándar del sistema financiero:
 * - Conversión de tasas Efectiva Anual (E.A.) y Efectiva Mensual (E.M.) a tasa periódica mensual.
 * - Cálculo de cuota fija con sistema de amortización francés.
 * - Cálculo de cuota plana (0% interés para promociones a plazos).
 * - Generación de tablas completas de amortización periódica.
 */

export interface AmortizationRow {
  monthIndex: number; // 1 a N
  dueDate: string; // YYYY-MM-DD
  installment: number; // Valor de la cuota
  interest: number; // Porción de interés
  principalPayment: number; // Abono a capital
  remainingBalance: number; // Saldo deudor restante
}

export interface AmortizationSummary {
  principal: number;
  monthlyInstallment: number;
  totalInterest: number;
  totalPaid: number;
  months: number;
  schedule: AmortizationRow[];
}

/**
 * Convierte una tasa Efectiva Anual (E.A.) expresada en porcentaje (ej. 26.82)
 * o en decimal (ej. 0.2682) a tasa periódica mes vencido en decimal.
 *
 * Fórmula: i = (1 + EA)^(1/12) - 1
 */
export function annualEffectiveToMonthlyRate(eaRate: number): number {
  if (eaRate <= 0) return 0;
  // Si se ingresó como porcentaje (ej. 26.8%), normalizar a decimal (0.268)
  const normalizedEA = eaRate >= 1 ? eaRate / 100 : eaRate;
  return Math.pow(1 + normalizedEA, 1 / 12) - 1;
}

/**
 * Normaliza una tasa mensual porcentual o decimal a decimal.
 * Ej: 2.0 -> 0.02, o 0.02 -> 0.02.
 */
export function normalizeMonthlyRate(monthlyRate: number): number {
  if (monthlyRate <= 0) return 0;
  return monthlyRate >= 1 ? monthlyRate / 100 : monthlyRate;
}

/**
 * Calcula la cuota mensual fija (Sistema Francés) o cuota plana (0% de interés).
 *
 * @param principal - Monto inicial del crédito o compra
 * @param monthlyRate - Tasa periódica mensual en decimal (ej. 0.02 para 2.0% EM)
 * @param months - Plazo en meses (>= 1)
 */
export function calculateMonthlyInstallment(
  principal: number,
  monthlyRate: number,
  months: number
): number {
  if (principal <= 0 || months <= 0) return 0;
  const safeMonths = Math.max(1, Math.round(months));
  const rate = Math.max(0, monthlyRate);

  if (rate === 0) {
    return Math.round(principal / safeMonths);
  }

  // Cuota francesa: P * [i * (1+i)^n] / [(1+i)^n - 1]
  const factor = Math.pow(1 + rate, safeMonths);
  const installment = (principal * rate * factor) / (factor - 1);
  return Math.round(installment);
}

/**
 * Genera la tabla periódica completa de amortización para un crédito o compra financiada.
 *
 * @param principal - Monto total financiado
 * @param monthlyRate - Tasa mensual periódica en decimal
 * @param months - Plazo en meses
 * @param startDateStr - Fecha inicial (YYYY-MM-DD), por defecto fecha actual
 */
export function generateAmortizationSchedule(
  principal: number,
  monthlyRate: number,
  months: number,
  startDateStr?: string
): AmortizationSummary {
  const safeMonths = Math.max(1, Math.round(months));
  const installment = calculateMonthlyInstallment(principal, monthlyRate, safeMonths);
  const schedule: AmortizationRow[] = [];

  let currentBalance = principal;
  let totalInterest = 0;
  let totalPaid = 0;

  const baseDate = startDateStr ? new Date(startDateStr + 'T00:00:00') : new Date();

  for (let m = 1; m <= safeMonths; m++) {
    // Calcular fecha de vencimiento sumando m meses
    const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + m, baseDate.getDate());
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const dueDate = `${yyyy}-${mm}-${dd}`;

    const interest = Math.round(currentBalance * monthlyRate);
    let principalPayment = installment - interest;

    // En la última cuota ajustamos para evitar centavos residuales
    if (m === safeMonths || principalPayment > currentBalance) {
      principalPayment = currentBalance;
    }

    const actualInstallment = principalPayment + interest;
    currentBalance = Math.max(0, currentBalance - principalPayment);

    totalInterest += interest;
    totalPaid += actualInstallment;

    schedule.push({
      monthIndex: m,
      dueDate,
      installment: actualInstallment,
      interest,
      principalPayment,
      remainingBalance: currentBalance,
    });

    if (currentBalance <= 0) break;
  }

  return {
    principal,
    monthlyInstallment: installment,
    totalInterest,
    totalPaid,
    months: safeMonths,
    schedule,
  };
}

/**
 * Formatea montos grandes de dinero de forma compacta y legible para gráficas
 * Ej: 5600000 -> "$5.6M", -11800000 -> "-$11.8M", 500000 -> "$500K", 0 -> "$0"
 */
export function formatCompactCurrency(val: string | number): string {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (!isFinite(num) || num === 0) return '$0';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const m = (abs / 1_000_000).toFixed(1).replace('.0', '');
    return `${sign}$${m}M`;
  }
  if (abs >= 1_000) {
    const k = Math.round(abs / 1_000);
    return `${sign}$${k}K`;
  }
  return `${sign}$${Math.round(abs)}`;
}

export interface ChartScale {
  maxValue: number;
  stepValue: number;
  stepHeight: number;
  height: number;
  noOfSections: number;
  noOfSectionsBelowXAxis: number;
  totalSections: number;
}

/**
 * Calcula escala óptima y no saturada para gráficas financieras con cuadrante negativo.
 * Evita la explosión de secciones horizontales (de 30+ a 3-5 secciones legibles).
 */
export function calculateChartScale(
  rawMin: number,
  rawMax: number,
  targetTotalSections = 5
): ChartScale {
  const max = Math.max(0, rawMax);
  const min = Math.min(0, rawMin);
  const absMin = Math.abs(min);

  if (absMin === 0 && max === 0) {
    return {
      maxValue: 100_000,
      stepValue: 25_000,
      stepHeight: 50,
      height: 200,
      noOfSections: 4,
      noOfSectionsBelowXAxis: 0,
      totalSections: 4,
    };
  }

  const span = max + absMin;
  const rawStep = span / targetTotalSections;

  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
  const normalized = (rawStep || 1) / magnitude;
  let niceFactor = 1;
  if (normalized > 5) niceFactor = 10;
  else if (normalized > 2.5) niceFactor = 5;
  else if (normalized > 1.5) niceFactor = 2.5;
  else if (normalized > 1) niceFactor = 2;

  const stepValue = niceFactor * magnitude;

  const noOfSections = max > 0 ? Math.max(1, Math.ceil(max / stepValue)) : 1;
  const noOfSectionsBelowXAxis = absMin > 0 ? Math.max(1, Math.ceil(absMin / stepValue)) : 0;
  const maxValue = stepValue * noOfSections;
  const totalSections = noOfSections + noOfSectionsBelowXAxis;

  const targetTotalHeight = 220;
  const stepHeight = Math.max(28, Math.round(targetTotalHeight / Math.max(1, totalSections)));
  const height = stepHeight * noOfSections;

  return {
    maxValue,
    stepValue,
    stepHeight,
    height,
    noOfSections,
    noOfSectionsBelowXAxis,
    totalSections,
  };
}
