/**
 * ZenMoney — Caso de Uso: ParseEmailNotification
 *
 * Analiza correos de notificaciones bancarias (Bancolombia, Davivienda, Nequi, Nu, PSE, Lulo)
 * y determina de forma determinista o asistida si se trata de un Gasto, Ingreso o Correo No Transaccional.
 */

export interface ParseEmailResult {
  isTransactional: boolean;
  type: 'expense' | 'income' | 'transfer' | null;
  amount: number | null;
  merchantName: string | null;
  description: string | null;
  transactionDate: string;
  bankName: string | null;
  confidence: number;
}

export class ParseEmailNotification {
  /**
   * Parsea determinísticamente notificaciones bancarias de texto plano / HTML
   */
  static parse(
    subject: string,
    body: string,
    referenceDateStr: string = new Date().toISOString().split('T')[0]
  ): ParseEmailResult {
    const text = `${subject} ${body}`.toLowerCase();

    // 1. Filtrar correos NO transaccionales (Extractos, Seguridad, Promociones)
    const ignoreKeywords = [
      'extracto',
      'resumen mensual',
      'cambio de clave',
      'seguridad',
      'bienvenido',
      'nueva función',
      'promoción',
      'oferta',
      'portafolio',
      'crédito preaprobado',
    ];

    const isIgnored = ignoreKeywords.some((kw) => text.includes(kw));
    if (isIgnored && !text.includes('compra por') && !text.includes('recibiste')) {
      return {
        isTransactional: false,
        type: null,
        amount: null,
        merchantName: null,
        description: null,
        transactionDate: referenceDateStr,
        bankName: null,
        confidence: 0,
      };
    }

    // 2. Extraer Banco o Entidad Financiera
    let bankName: string | null = null;
    if (text.includes('bancolombia')) bankName = 'Bancolombia';
    else if (text.includes('nequi')) bankName = 'Nequi';
    else if (text.includes('davivienda') || text.includes('daviplata')) bankName = 'Davivienda';
    else if (text.includes('nubank') || text.includes(' nu ')) bankName = 'Nu';
    else if (text.includes('lulo')) bankName = 'Lulo Bank';
    else if (text.includes('pse')) bankName = 'PSE';

    // 3. Determinar Tipo de Transacción (Gasto vs Ingreso)
    const expenseKeywords = [
      'compra por',
      'pago por',
      'pago aprobado',
      'transacción aprobada',
      'debito',
      'débito',
      'retiro',
      'transferencia enviada',
      'descontado de tu cuenta',
      'pago pse',
    ];

    const incomeKeywords = [
      'recibiste una consignación',
      'recibiste un pago',
      'te enviaron plata',
      'transferencia recibida',
      'consignación exitosa',
      'abono a tu cuenta',
      'reembolso',
      'recibiste $',
    ];

    let type: 'expense' | 'income' | 'transfer' | null = null;

    const isExpense = expenseKeywords.some((kw) => text.includes(kw));
    const isIncome = incomeKeywords.some((kw) => text.includes(kw));

    if (isExpense) {
      type = 'expense';
    } else if (isIncome) {
      type = 'income';
    } else if (text.includes('transferencia')) {
      type = 'transfer';
    }

    if (!type) {
      return {
        isTransactional: false,
        type: null,
        amount: null,
        merchantName: null,
        description: null,
        transactionDate: referenceDateStr,
        bankName,
        confidence: 0,
      };
    }

    // 4. Extraer Monto ($ 45.000 / $45,000 / $1.500.000)
    // Coincide con formatos típicos colombianos y latinoamericanos
    const amountRegex = /\$\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/g;
    const matches = [...text.matchAll(amountRegex)];
    let amount: number | null = null;

    if (matches.length > 0) {
      // Tomamos el primer monto válido encontrado tras la palabra clave
      for (const m of matches) {
        const rawNumStr = m[1].replace(/\./g, '').replace(/,/g, '');
        const parsedNum = parseFloat(rawNumStr);
        if (!isNaN(parsedNum) && parsedNum > 0) {
          amount = parsedNum;
          break;
        }
      }
    }

    // 5. Extraer Comercio / Establecimiento / Remitente
    let merchantName: string | null = null;

    const merchantRegexes = [
      /(?:en|para)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s._-]+?)(?:\s+el|\s+por|\s+con|\s+fecha|\s+\d{2}\/|\.|$)/i,
      /(?:de)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s._-]+?)(?:\s+te enviaron|\s+recibiste|\.|$)/i,
    ];

    for (const regex of merchantRegexes) {
      const match = regex.exec(subject + ' ' + body);
      if (match && match[1]) {
        const cleaned = match[1].trim();
        if (cleaned.length > 2 && cleaned.length < 40 && !cleaned.includes('$')) {
          merchantName = cleaned;
          break;
        }
      }
    }

    if (!merchantName) {
      merchantName = bankName || 'Movimiento Bancario';
    }

    const description = type === 'income'
      ? `Ingreso detectado por correo (${merchantName})`
      : `Gasto detectado por correo (${merchantName})`;

    return {
      isTransactional: true,
      type,
      amount,
      merchantName,
      description,
      transactionDate: referenceDateStr,
      bankName,
      confidence: amount ? 0.9 : 0.6,
    };
  }
}
