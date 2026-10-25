/**
 * ZenMoney — Supabase Edge Function: chat-assistant
 *
 * Recibe la pregunta del usuario, el contexto financiero y el historial de conversación,
 * y se comunica de forma segura con la API de Google Gemini en el servidor (server-side).
 *
 * Esto evita exponer la clave de API de Gemini en el cliente móvil o web.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Utilidad de reintento con backoff para tolerar errores transitorios 503
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 1000): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (!response.ok && response.status === 503 && retries > 0) {
      console.warn(`[chat-assistant] 503 Service Unavailable detectado. Reintentando en ${delay}ms... (Quedan ${retries} intentos)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    return response;
  } catch (err) {
    if (retries > 0) {
      console.warn(`[chat-assistant] Error de red. Reintentando en ${delay}ms... (Quedan ${retries} intentos)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw err;
  }
}

serve(async (req) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY no está configurada en Supabase Edge Functions." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { question, context, history = [] } = await req.json();

    if (!question) {
      return new Response(
        JSON.stringify({ error: "El campo 'question' es obligatorio." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ctx = context || {
      currentDate: new Date().toISOString().split("T")[0],
      totalBalance: 0,
      monthlyIncome: 0,
      monthlyExpenses: 0,
      currency: "COP",
      accounts: [],
      budgets: [],
      recentTransactions: []
    };

    const systemPrompt = `
      Eres el Asistente Financiero Inteligente de ZenMoney, una app de finanzas familiares.
      Tu objetivo es responder de forma clara, motivadora y constructiva a la pregunta del usuario basándote únicamente en su contexto financiero real provisto abajo.
      Recuerdas la conversación anterior con este usuario (te la paso como historial de turnos):
      resuelve referencias como "y el de restaurantes" o "¿cuánto era?" usando ese historial,
      en vez de pedirle que repita lo que ya dijo.

      CONTEXTO FINANCIERO DEL USUARIO (siempre actualizado a este momento):
      - Fecha actual del sistema: ${ctx.currentDate}
      - Saldo Líquido Consolidado: ${Number(ctx.totalBalance || 0).toLocaleString('es-CO')} ${ctx.currency || 'COP'}
      - Ingresos de este mes: ${Number(ctx.monthlyIncome || 0).toLocaleString('es-CO')} ${ctx.currency || 'COP'}
      - Gastos de este mes: ${Number(ctx.monthlyExpenses || 0).toLocaleString('es-CO')} ${ctx.currency || 'COP'}

      - Cuentas activas:
        ${JSON.stringify((ctx.accounts || []).map((a: any) => ({ name: a.name, type: a.type, balance: a.initialBalance })))}

      - Límites de Presupuestos y Consumos actuales:
        ${JSON.stringify((ctx.budgets || []).map((b: any) => ({
          category: b.budget?.categoryId || b.categoryId,
          spent: b.spent,
          limit: b.budget?.amountLimit || b.limit,
          remaining: b.remaining,
          status: b.status
        })))}

      ${ctx.historicalAnalysis ? `
      - HISTORIAL CONSOLIDADO DE LOS ÚLTIMOS 12 MESES:
        * Gasto total acumulado últimos 3 meses (trimestre): ${Number(ctx.historicalAnalysis.totalExpensesLast3Months || 0).toLocaleString('es-CO')} ${ctx.currency || 'COP'}
        * Ingreso total acumulado últimos 3 meses: ${Number(ctx.historicalAnalysis.totalIncomeLast3Months || 0).toLocaleString('es-CO')} ${ctx.currency || 'COP'}
        * Promedio de gasto mensual (trimestre): ${Number(ctx.historicalAnalysis.averageMonthlyExpenseLast3Months || 0).toLocaleString('es-CO')} ${ctx.currency || 'COP'}

        * Gasto total acumulado últimos 12 meses (anual): ${Number(ctx.historicalAnalysis.totalExpensesLast12Months || 0).toLocaleString('es-CO')} ${ctx.currency || 'COP'}
        * Ingreso total acumulado últimos 12 meses: ${Number(ctx.historicalAnalysis.totalIncomeLast12Months || 0).toLocaleString('es-CO')} ${ctx.currency || 'COP'}
        * Promedio de gasto mensual (año): ${Number(ctx.historicalAnalysis.averageMonthlyExpenseLast12Months || 0).toLocaleString('es-CO')} ${ctx.currency || 'COP'}

        * Top 5 categorías de mayor gasto en el año:
          ${JSON.stringify(ctx.historicalAnalysis.topCategoriesLast12Months || [])}

        * Desglose mes a mes (orden cronológico):
          ${JSON.stringify(ctx.historicalAnalysis.monthlyBreakdown || [])}

        * Patrones y conceptos recurrentes detectados:
          ${JSON.stringify(ctx.historicalAnalysis.recurringPatterns || [])}
      ` : ''}

      - Últimos movimientos registrados (recientes hasta hoy):
        ${JSON.stringify((ctx.recentTransactions || []).map((t: any) => ({
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
      4. ANÁLISIS HISTÓRICO Y COMPARATIVO: Si el usuario pregunta por periodos anteriores (ej: "últimos 3 meses", "último trimestre", "último año", "hace 6 meses", "¿en qué gasté más este año?"), utiliza la sección de HISTORIAL CONSOLIDADO provista. Da la cifra total consolidada precisa de ese periodo, un breve desglose mes a mes si aplica, y menciona las categorías o conceptos más representativos. NUNCA limites tu respuesta a una sola transacción o concepto recurrente aislado salvo que el usuario lo pida expresamente.
      5. Sugiere 2 a 3 acciones interactivas cortas e intuitivas como frases de respuesta (ej: "Ver presupuestos", "Registrar un gasto", "Revisar facturas").
      6. SI Y SOLO SI el usuario manifiesta la intención de registrar o anotar un gasto, ingreso o transferencia (ej: "Mercado con Vale por 15000", "Anota 50 mil en gasolina", "Gasto de 20mil con Bancolombia", "Compra de 1 millón a 10 cuotas con tarjeta"), incluye en el JSON el objeto "pendingAction" con los campos "type": "create_transaction" y "payload" (con amount, transactionType, suggestedCategoryName, suggestedAccountName, description, transactionDate, e installmentsCount con el número entero de cuotas si el usuario indica diferir o pagar a cuotas). En "answer", indica brevemente que has generado la tarjeta de pre-confirmación borrador.
      7. SI EL USUARIO PIDE UN RETO, DESAFÍO O ENTRENAMIENTO FINANCIERO (ej: "¿qué desafío me recomiendas?", "dame un reto de 7 días", "quiero entrenar mis finanzas"), O SI DETECTAS UN PATRÓN CLARO DE GASTO EXCESIVO (ej: muchos domicilios, gastos hormiga o presupuestos superados), INCLUYE en el JSON el objeto "pendingAction" con "type": "create_challenge" y "payload" { "title": "...", "description": "...", "icon": "fire|food|shield-check|rocket", "rewardBadgeTitle": "..." }. En "answer", explica entusiasmado el desafío propuesto de 7 días.

      Devuelve ÚNICAMENTE un objeto JSON estructurado con este esquema exacto, sin bloques markdown:
      {
        "answer": "Tu respuesta en texto estructurado con viñetas y negritas en español.",
        "suggestedActions": ["Acción sugerida 1", "Acción sugerida 2"],
        "pendingAction": null // O el objeto pendingAction si aplica
      }
    `;

    const contents = [
      ...history.map((turn: any) => ({
        role: turn.role,
        parts: [{ text: turn.text }],
      })),
      {
        role: "user",
        parts: [{ text: question }],
      },
    ];

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;

    const response = await fetchWithRetry(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error en llamada a Gemini Q&A: ${errText}`);
    }

    const geminiData = await response.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("La API de Gemini no retornó un texto válido.");
    }

    let cleanText = rawText.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText
        .replace(/^```json\s*/i, "")
        .replace(/```$/, "")
        .trim();
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(cleanText);
    } catch {
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        parsedResult = {
          answer: cleanText,
          suggestedActions: ["Ver mis gastos", "Ver presupuestos", "Registrar movimiento"],
          pendingAction: null,
        };
      }
    }

    return new Response(
      JSON.stringify(parsedResult),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Error interno del servidor en chat-assistant." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
