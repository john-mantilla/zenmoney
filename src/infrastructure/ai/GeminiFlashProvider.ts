/**
 * ZenMoney — Gemini Flash AI Provider
 *
 * Implementa la interfaz AIProvider realizando llamadas prioritarias a las Edge Functions
 * de Supabase (server-side) y proporcionando un mecanismo de fallback robusto directo a
 * Google Gemini (client-side) con reintentos y tolerancia a fallos 503.
 */

import { Account } from '@domain/entities/Account';
import { Category } from '@domain/entities/Category';
import { AIProvider, NLQParseResult, NLQQueryResult, FinancialContext, ConversationTurn } from './AIProvider';
import { supabase } from '@infrastructure/supabase/client';

// Utilidad utilitaria de reintento para el cliente
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 1000): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (!response.ok && response.status === 503 && retries > 0) {
      console.warn(`[Gemini Client] 503 detectado. Reintentando en ${delay}ms... (Quedan ${retries} intentos)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    return response;
  } catch (err) {
    if (retries > 0) {
      console.warn(`[Gemini Client] Error de red. Reintentando en ${delay}ms... (Quedan ${retries} intentos)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw err;
  }
}

export class GeminiFlashProvider implements AIProvider {
  readonly name = 'Google Gemini Flash Hybrid Provider';

  private getApiKey(): string {
    const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!key) {
      throw new Error(
        'Clave API de Gemini no configurada. ' +
        'Por favor agrega EXPO_PUBLIC_GEMINI_API_KEY a tu archivo .env'
      );
    }
    return key;
  }

  async parseTransaction(
    input: string,
    accounts: Account[],
    categories: Category[]
  ): Promise<NLQParseResult> {
    const localToday = new Date();
    const localYear = localToday.getFullYear();
    const localMonth = String(localToday.getMonth() + 1).padStart(2, '0');
    const localDay = String(localToday.getDate()).padStart(2, '0');
    const localTodayStr = `${localYear}-${localMonth}-${localDay}`;
    const localWeekdayName = localToday.toLocaleDateString('es-CO', { weekday: 'long' });

    // ─── 1. INTENTO PRIORITARIO: LLAMADA A EDGE FUNCTION (SERVER-SIDE) ───
    try {
      console.log('[Gemini Provider] Intentando parseo de transacción vía Supabase Edge Function...');
      
      const { data, error } = await supabase.functions.invoke('parse-nlq', {
        body: {
          input,
          accounts: accounts.map(a => ({ id: a.id, name: a.name, type: a.type })),
          categories: categories.map(c => ({ id: c.id, name: c.name })),
          // Fecha local del dispositivo, para que el servidor calcule "ayer"/"hace 3 días"
          // sobre el día real del usuario y no sobre el reloj (UTC) del servidor.
          referenceDate: localTodayStr,
        }
      });

      if (error) {
        throw new Error(error.message || 'Error en respuesta de Edge Function.');
      }

      if (data) {
        console.log('[Gemini Provider] Parseo exitoso vía Edge Function.');
        return {
          ...data,
          amount: data.amount,
          type: data.type,
          suggestedCategoryName: data.suggestedCategoryName,
          suggestedAccountName: data.suggestedAccountName,
          merchantName: data.merchantName,
          description: data.description,
          transactionDate: this.resolveTransactionDate(data.transactionDate, localTodayStr),
          confidence: data.confidence || 1,
          needsUserInput: [],
          rawInput: input,
        } as any;
      }
    } catch (err) {
      console.warn(
        '[Gemini Provider] Fallo al invocar la Edge Function. ' +
        'Aplicando fallback silencioso a llamada directa (client-side)...',
        err
      );
    }

    // ─── 2. FALLBACK: LLAMADA DIRECTA DESDE EL CLIENTE (CLIENT-SIDE) ───
    const apiKey = this.getApiKey();

    const prompt = `
      Analiza la frase de transacción en español y extrae los detalles en formato JSON estricto.

      Hoy es ${localTodayStr} (${localWeekdayName}). Usa esta fecha como referencia para calcular
      cualquier expresión temporal relativa mencionada en la frase.

      Lista de Cuentas disponibles (ID y Nombre):
      ${JSON.stringify(accounts.map(a => ({ id: a.id, name: a.name, type: a.type })))}

      Lista de Categorías disponibles (ID y Nombre):
      ${JSON.stringify(categories.map(c => ({ id: c.id, name: c.name })))}

      Instrucciones:
      1. amount: Extrae el monto numérico. Entiende modismos colombianos ("mil", "k" -> 45000; "un palo", "un millón" -> 1000000; "luca" -> 1000). Si no hay, pon null.
      2. type: Determina si es 'expense' (gasto), 'income' (ingreso) o 'transfer' (transferencia).
      3. suggestedAccountId y suggestedAccountName: Compara la cuenta mencionada en el texto con la Lista de Cuentas usando coincidencia difusa (Fuzzy match). Si no hay, pon null.
      4. suggestedCategoryId y suggestedCategoryName: Compara la categoría descrita con la Lista de Categorías. Si no sabes, sugiere el ID de "Sin clasificar".
      5. merchantName: Nombre del establecimiento comercial (ej: Exito, Uber, Netflix). Omitir para ingresos o transferencias.
      6. description: Genera un texto amigable y descriptivo de la transacción.
      7. confidence: Confianza de 0 a 1.
      8. transactionDate: La fecha del movimiento en formato "YYYY-MM-DD", calculada a partir de hoy (${localTodayStr}):
         - Si no se menciona ninguna referencia temporal, usa hoy: ${localTodayStr}.
         - "ayer" -> un día antes de hoy. "anteayer" -> dos días antes de hoy.
         - "hace N días" -> N días antes de hoy.
         - "el lunes/martes/... pasado" -> el día de esa semana más reciente que ya pasó (nunca hoy ni en el futuro).
         - "la semana pasada" -> 7 días antes de hoy si no se menciona un día específico de esa semana.
         - Nunca devuelvas una fecha futura.

      Devuelve ÚNICAMENTE el objeto JSON con este esquema, sin bloques de código markdown:
      {
        "amount": number | null,
        "type": "expense" | "income" | "transfer" | null,
        "suggestedAccountId": string | null,
        "suggestedAccountName": string | null,
        "suggestedCategoryId": string | null,
        "suggestedCategoryName": string | null,
        "merchantName": string | null,
        "description": string | null,
        "confidence": number,
        "transactionDate": "YYYY-MM-DD"
      }
    `;

    // Uso de API v1beta y gemini-flash-lite-latest (modelo liviano: menos demanda/costo,
    // más que suficiente para el parseo de frases cortas de este flujo)
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;

    const response = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { text: `Frase a analizar: "${input}"` }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error en llamada a Gemini API (Directa): ${errText}`);
    }

    const resJson = await response.json();
    const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('La API de Gemini no retornó un texto válido.');
    }

    let cleanText = rawText.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText
        .replace(/^```json\s*/i, '')
        .replace(/```$/, '')
        .trim();
    }

    const parsed = JSON.parse(cleanText);

    return {
      ...parsed,
      amount: parsed.amount,
      type: parsed.type,
      suggestedCategoryName: parsed.suggestedCategoryName,
      suggestedAccountName: parsed.suggestedAccountName,
      merchantName: parsed.merchantName,
      description: parsed.description,
      transactionDate: this.resolveTransactionDate(parsed.transactionDate, localTodayStr),
      confidence: parsed.confidence || 1,
      needsUserInput: [],
      rawInput: input,
    } as any;
  }

  async parseReceiptImage(
    imageBase64: string,
    mimeType: string,
    accounts: Account[],
    categories: Category[]
  ): Promise<NLQParseResult> {
    const localToday = new Date();
    const localTodayStr = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, '0')}-${String(localToday.getDate()).padStart(2, '0')}`;

    // ─── 1. INTENTO PRIORITARIO: LLAMADA A EDGE FUNCTION (SERVER-SIDE) ───
    try {
      console.log('[Gemini Provider] Intentando parseo de recibo (imagen) vía Supabase Edge Function...');

      const { data, error } = await supabase.functions.invoke('parse-receipt-image', {
        body: {
          imageBase64,
          mimeType,
          accounts: accounts.map(a => ({ id: a.id, name: a.name, type: a.type })),
          categories: categories.map(c => ({ id: c.id, name: c.name })),
          referenceDate: localTodayStr,
        }
      });

      if (error) {
        throw new Error(error.message || 'Error en respuesta de Edge Function.');
      }

      if (data) {
        console.log('[Gemini Provider] Parseo de recibo exitoso vía Edge Function.');
        return {
          ...data,
          transactionDate: this.resolveTransactionDate(data.transactionDate, localTodayStr),
          confidence: data.confidence || 0,
          needsUserInput: [],
          rawInput: '[foto de recibo]',
        } as any;
      }
    } catch (err) {
      console.warn(
        '[Gemini Provider] Fallo al invocar la Edge Function de recibo. ' +
        'Aplicando fallback silencioso a llamada directa (client-side)...',
        err
      );
    }

    // ─── 2. FALLBACK: LLAMADA DIRECTA DESDE EL CLIENTE (CLIENT-SIDE) ───
    const apiKey = this.getApiKey();

    const prompt = `
      Analiza la imagen de un recibo o factura de compra y extrae los detalles en formato JSON estricto.

      Hoy es ${localTodayStr}. Si el recibo no muestra fecha legible, usa esta fecha.

      Lista de Cuentas disponibles (ID y Nombre):
      ${JSON.stringify(accounts.map(a => ({ id: a.id, name: a.name, type: a.type })))}

      Lista de Categorías disponibles (ID y Nombre):
      ${JSON.stringify(categories.map(c => ({ id: c.id, name: c.name })))}

      Instrucciones:
      1. amount: El TOTAL final pagado (no subtotales ni IVA por separado). Si no es legible, pon null.
      2. type: Siempre "expense".
      3. suggestedAccountId y suggestedAccountName: Solo si el recibo indica método de pago y coincide con una cuenta de la lista. Si no, pon null.
      4. suggestedCategoryId y suggestedCategoryName: Infiere según el tipo de comercio. Si no sabes, sugiere el ID de "Sin clasificar".
      5. merchantName: Nombre del comercio tal como aparece en el recibo.
      6. description: Resume brevemente 2-3 productos/ítems principales si son legibles, si no usa "Compra en {merchantName}".
      7. confidence: 0 a 1 según legibilidad. Si la imagen no parece un recibo, pon amount:null y confidence:0.
      8. transactionDate: "YYYY-MM-DD" si es legible, si no ${localTodayStr}. Nunca futura.

      Devuelve ÚNICAMENTE el objeto JSON con este esquema, sin bloques de código markdown:
      {
        "amount": number | null,
        "type": "expense",
        "suggestedAccountId": string | null,
        "suggestedAccountName": string | null,
        "suggestedCategoryId": string | null,
        "suggestedCategoryName": string | null,
        "merchantName": string | null,
        "description": string | null,
        "confidence": number,
        "transactionDate": "YYYY-MM-DD"
      }
    `;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;

    const response = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: imageBase64 } }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error en llamada a Gemini Vision (Directa): ${errText}`);
    }

    const resJson = await response.json();
    const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('La API de Gemini no retornó un texto válido.');
    }

    let cleanText = rawText.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText
        .replace(/^```json\s*/i, '')
        .replace(/```$/, '')
        .trim();
    }

    const parsed = JSON.parse(cleanText);

    return {
      ...parsed,
      transactionDate: this.resolveTransactionDate(parsed.transactionDate, localTodayStr),
      confidence: parsed.confidence || 0,
      needsUserInput: [],
      rawInput: '[foto de recibo]',
    } as any;
  }

  /**
   * Valida la fecha que devolvió el modelo antes de confiar en ella: debe ser un
   * "YYYY-MM-DD" real y no una fecha futura (protege contra alucinaciones del modelo).
   * Si no pasa la validación, se usa la fecha local de hoy como respaldo seguro.
   */
  private resolveTransactionDate(candidate: unknown, fallbackToday: string): string {
    if (typeof candidate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
      const parsedDate = new Date(candidate + 'T00:00:00');
      const oneYearAhead = new Date();
      oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
      if (!isNaN(parsedDate.getTime()) && parsedDate <= oneYearAhead) {
        return candidate;
      }
    }
    return fallbackToday;
  }

  async queryFinances(
    question: string,
    context: FinancialContext,
    history: ConversationTurn[] = []
  ): Promise<NLQQueryResult> {
    const apiKey = this.getApiKey();

    // Va en `systemInstruction`, no en `contents`: así el contexto financiero (que puede
    // cambiar entre preguntas) se manda fresco en cada llamada sin tener que repetirlo
    // dentro del historial de turnos — el historial solo lleva la conversación en sí.
    const systemPrompt = `
      Eres el Asistente Financiero Inteligente de ZenMoney, una app de finanzas familiares.
      Tu objetivo es responder de forma clara, motivadora y constructiva a la pregunta del usuario basándote únicamente en su contexto financiero real provisto abajo.
      Recuerdas la conversación anterior con este usuario (te la paso como historial de turnos):
      resuelve referencias como "y el de restaurantes" o "¿cuánto era?" usando ese historial,
      en vez de pedirle que repita lo que ya dijo.

      CONTEXTO FINANCIERO DEL USUARIO (siempre actualizado a este momento):
      - Fecha actual del sistema: ${context.currentDate}
      - Saldo Líquido Consolidado: ${context.totalBalance.toLocaleString('es-CO')} ${context.currency}
      - Ingresos de este mes: ${context.monthlyIncome.toLocaleString('es-CO')} ${context.currency}
      - Gastos de este mes: ${context.monthlyExpenses.toLocaleString('es-CO')} ${context.currency}

      - Cuentas activas:
        ${JSON.stringify(context.accounts.map(a => ({ name: a.name, type: a.type, balance: a.initialBalance })))}

      - Límites de Presupuestos y Consumos actuales:
        ${JSON.stringify(context.budgets.map(b => ({
          category: b.budget.categoryId,
          spent: b.spent,
          limit: b.budget.amountLimit,
          remaining: b.remaining,
          status: b.status
        })))}

      - Últimos movimientos registrados:
        ${JSON.stringify(context.recentTransactions.map(t => ({
          date: t.transactionDate,
          type: t.type,
          amount: t.amount,
          description: t.description,
          merchant: t.merchantName
        })))}

      INSTRUCCIONES DE RESPUESTA Y FORMATO:
      1. NUNCA generes bloques de texto continuo o párrafos largos. La gente en móvil escanea, no lee. Divide tu respuesta en viñetas o secciones breves de máximo 2 líneas.
      2. Resalta SIEMPRE en **negrita** todas las cifras numéricas, montos en dinero, nombres de categorías y conceptos críticos (ej: **$ 2.251.000 COP**, **Mercado**, **Gastos Hormiga**).
      3. Utiliza viñetas con emojis contextuales en cada punto clave (ej: 📊 **Estado actual:** ..., 💡 **Consejo clave:** ..., ⚠️ **Atención:** ...).
      4. Sugiere 2 a 3 acciones interactivas cortas e intuitivas como frases de respuesta (ej: "Ver presupuestos", "Registrar un gasto", "Revisar facturas").
      5. SI Y SOLO SI el usuario manifiesta la intención de registrar o anotar un gasto, ingreso o transferencia (ej: "Mercado con Vale por 15000", "Anota 50 mil en gasolina", "Gasto de 20mil con Bancolombia"), incluye en el JSON el objeto "pendingAction" con los campos "type": "create_transaction" y "payload" (con amount, transactionType, suggestedCategoryName, suggestedAccountName, description, transactionDate). En "answer", indica brevemente que has generado la tarjeta de pre-confirmación borrador.

      Devuelve ÚNICAMENTE un objeto JSON estructurado con este esquema exacto, sin bloques markdown:
      {
        "answer": "Tu respuesta en texto estructurado con viñetas y negritas en español.",
        "suggestedActions": ["Acción sugerida 1", "Acción sugerida 2"],
        "pendingAction": null // O el objeto pendingAction si aplica
      }
    `;

    // El historial de turnos previos + la pregunta actual, en el formato multi-turno de Gemini
    const contents = [
      ...history.map(turn => ({
        role: turn.role,
        parts: [{ text: turn.text }],
      })),
      {
        role: 'user',
        parts: [{ text: question }],
      },
    ];

    // Uso de API v1beta y gemini-flash-lite-latest (modelo liviano: menos demanda/costo,
    // más que suficiente para el parseo de frases cortas de este flujo)
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;

    const response = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          responseMimeType: 'application/json',
        },
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error en llamada a Gemini Q&A: ${errText}`);
    }

    const resJson = await response.json();
    const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('La API de Gemini no retornó un texto válido.');
    }

    let cleanText = rawText.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    // Extraer la subcadena JSON delimitada por { y }
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');

    let parsed: any = null;
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        const jsonStr = cleanText.substring(firstBrace, lastBrace + 1);
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        console.warn('[Gemini Q&A] Falló el parseo de la subcadena JSON:', e);
      }
    }

    if (!parsed) {
      // Fallback seguro: si Gemini devolvió texto plano fuera del esquema JSON
      return {
        answer: rawText,
        suggestedActions: ['Registrar un gasto', 'Ver presupuestos', 'Consultar saldo'],
      };
    }

    return {
      answer: parsed.answer || rawText,
      suggestedActions: parsed.suggestedActions || [],
      pendingAction: parsed.pendingAction || undefined,
      data: parsed.data || {},
    };
  }
}
