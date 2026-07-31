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

    // 1. Palabras clave transaccionales prioritarias (Prevalecen sobre cualquier aviso de seguridad)
    const transactionKeywords = [
      'compra por',
      'pago por',
      'pago aprobado',
      'transacción aprobada',
      'transaccion aprobada',
      'recibiste una consignación',
      'recibiste un pago',
      'te enviaron plata',
      'transferencia recibida',
      'consignación exitosa',
      'consignacion exitosa',
      'descontado de tu cuenta',
      'pago pse',
      'pse - transacción aprobada',
      'pse - transaccion aprobada',
    ];

    const hasTransactionKeyword = transactionKeywords.some((kw) => text.includes(kw));

    // 2. Filtrar correos NO transaccionales (Extractos, Promociones, Cambios de clave)
    const ignoreKeywords = [
      'extracto',
      'resumen mensual',
      'cambio de clave',
      'bienvenido',
      'nueva función',
      'promoción',
      'oferta',
      'portafolio',
      'crédito preaprobado',
    ];

    const isIgnored = ignoreKeywords.some((kw) => text.includes(kw));
    if (isIgnored && !hasTransactionKeyword) {
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

    // 3. Extraer Banco o Entidad Financiera
    let bankName: string | null = null;
    if (text.includes('bancolombia')) bankName = 'Bancolombia';
    else if (text.includes('nequi')) bankName = 'Nequi';
    else if (text.includes('davivienda') || text.includes('daviplata')) bankName = 'Davivienda';
    else if (text.includes('nubank') || text.includes(' nu ')) bankName = 'Nu';
    else if (text.includes('lulo')) bankName = 'Lulo Bank';
    else if (text.includes('pse') || text.includes('achcolombia')) bankName = 'PSE';

    // 4. Determinar Tipo de Transacción (Gasto vs Ingreso)
    const expenseKeywords = [
      'compra por',
      'pago por',
      'pago aprobado',
      'transacción aprobada',
      'transaccion aprobada',
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
    if (expenseKeywords.some((kw) => text.includes(kw))) {
      type = 'expense';
    } else if (incomeKeywords.some((kw) => text.includes(kw))) {
      type = 'income';
    } else if (text.includes('transferencia')) {
      type = 'transfer';
    }

    if (!type && !hasTransactionKeyword) {
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

    // Si tiene palabra clave de transacción pero no se especificó tipo, asumimos gasto (PSE / Pago)
    if (!type) {
      type = 'expense';
    }

    // 5. Extraer Monto ($ 175.000,00 / $ 45.000 / $45,000 / $1.500.000)
    const amountRegex = /\$\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/g;
    const matches = [...text.matchAll(amountRegex)];
    let amount: number | null = null;

    if (matches.length > 0) {
      for (const m of matches) {
        let rawStr = m[1];
        // Manejar formato colombiano con decimales ",00"
        if (rawStr.includes(',')) {
          rawStr = rawStr.split(',')[0];
        }
        const cleanedStr = rawStr.replace(/\./g, '').trim();
        const parsedNum = parseFloat(cleanedStr);
        if (!isNaN(parsedNum) && parsedNum > 0) {
          amount = parsedNum;
          break;
        }
      }
    }

    // 6. Extraer Comercio / Empresa / Remitente
    let merchantName: string | null = null;
    let customDescription: string | null = null;

    const fullRaw = `${subject} ${body}`;

    // Patrón específico PSE (Empresa: ... / Descripción: ...)
    const pseEmpresaMatch = /Empresa:\s*([\s\S]+?)(?=\s+Descripción:|\s+Fecha|\s+CUS|\s+Gracias|\n|\r|$)/i.exec(fullRaw);
    const pseDescMatch = /Descripción:\s*([\s\S]+?)(?=\s+Fecha|\s+CUS|\s+Gracias|\n|\r|$)/i.exec(fullRaw);

    if (pseEmpresaMatch && pseEmpresaMatch[1]) {
      merchantName = pseEmpresaMatch[1].trim();
    }
    if (pseDescMatch && pseDescMatch[1]) {
      customDescription = pseDescMatch[1].trim();
    }

    if (!merchantName) {
      const merchantRegexes = [
        /(?:en|para)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s._-]+?)(?:\s+el|\s+por|\s+con|\s+fecha|\s+\d{2}\/|\.|$)/i,
        /(?:de)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s._-]+?)(?:\s+te enviaron|\s+recibiste|\.|$)/i,
      ];

      for (const regex of merchantRegexes) {
        const match = regex.exec(fullRaw);
        if (match && match[1]) {
          const cleaned = match[1].trim();
          if (cleaned.length > 2 && cleaned.length < 50 && !cleaned.includes('$')) {
            merchantName = cleaned;
            break;
          }
        }
      }
    }

    if (!merchantName) {
      merchantName = bankName || 'Movimiento Bancario';
    }

    const description = customDescription || (
      type === 'income'
        ? `Ingreso por correo (${merchantName})`
        : `Gasto por correo (${merchantName})`
    );

    return {
      isTransactional: true,
      type,
      amount,
      merchantName,
      description,
      transactionDate: referenceDateStr,
      bankName,
      confidence: amount ? 0.95 : 0.7,
    };
  }
}
