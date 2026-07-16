/**
 * ZenMoney — Supabase Edge Function: parse-nlq
 *
 * Recibe una frase en lenguaje natural y la parsea a una transacción estructurada
 * utilizando la API de Google Gemini Flash.
 */

// Servir la función sobre HTTP nativo de Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Utilidad de reintento con backoff corto para tolerar errores transitorios 503 (sobrecarga de Google)
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 1000): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (!response.ok && response.status === 503 && retries > 0) {
      console.warn(`[Gemini API] 503 Service Unavailable detectado. Reintentando en ${delay}ms... (Quedan ${retries} intentos)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    return response;
  } catch (err) {
    if (retries > 0) {
      console.warn(`[Gemini API] Fallo de red en llamada. Reintentando en ${delay}ms... (Quedan ${retries} intentos)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw err;
  }
}

serve(async (req) => {
  // Manejo de CORS preflight
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

    const { input, accounts, categories, referenceDate } = await req.json();

    if (!input) {
      return new Response(
        JSON.stringify({ error: "El campo 'input' es obligatorio." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se prefiere la fecha local que envía el cliente (referenceDate): el servidor corre
    // en UTC y podría estar ya "un día adelante" respecto al día real del usuario en Colombia.
    const isValidReferenceDate = typeof referenceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate);
    const todayStr = isValidReferenceDate ? referenceDate : new Date().toISOString().split("T")[0];
    const weekdayName = new Date(todayStr + "T00:00:00").toLocaleDateString("es-CO", { weekday: "long" });

    // ─── PROMPT DE INSTRUCCIÓN PARA GEMINI ──────────────────────────────
    const systemInstruction = `
      Eres el motor de IA de ZenMoney, una app de finanzas personales.
      Tu tarea es analizar una frase en lenguaje natural en español (usualmente coloquial o con modismos colombianos)
      y extraer los detalles de la transacción en formato JSON estricto.

      Hoy es ${todayStr} (${weekdayName}). Usa esta fecha como referencia para calcular
      cualquier expresión temporal relativa mencionada en la frase.

      Lista de Cuentas disponibles del usuario:
      ${JSON.stringify(accounts)}

      Lista de Categorías disponibles del usuario:
      ${JSON.stringify(categories)}

      Reglas de extracción:
      1. amount: Extrae el monto numérico. Entiende modismos colombianos:
         - "mil" o "k" (ej: "45 mil", "45k" -> 45000)
         - "palo" o "millón" (ej: "un palo", "un millón" -> 1000000)
         - "luca" (ej: "5 lucas" -> 5000)
         Si no hay monto explícito, pon null.

      2. type: Determina si es 'expense' (gasto/pago), 'income' (ingreso/salario/recibí) o 'transfer' (mover dinero de una cuenta a otra).

      3. suggestedAccountId y suggestedAccountName: Compara la cuenta mencionada en el texto con la Lista de Cuentas.
         Haz una asociación difusa (Fuzzy match). Ejemplo: "la tarjeta", "visa" -> sugiere el ID y nombre de la cuenta tipo tarjeta de crédito.
         Si no coincide ninguna, pon null.

      4. suggestedCategoryId y suggestedCategoryName: Compara la categoría descrita en el texto con la Lista de Categorías.
         Ejemplo: "almorcé", "comida", "cena" -> "Restaurantes". "hacer mercado", "leche" -> "Alimentación / Mercado". "el uber", "bus" -> "Transporte".
         Sugerir el ID y nombre exacto de la categoría que más se asemeje. Si no hay suficiente información, sugiere el ID de "Sin clasificar".

      5. merchantName: Nombre del establecimiento, almacén o persona a la que se le pagó (ej: "en el Exito", "a Don Mario" -> "Éxito", "Don Mario"). Omitir si es un ingreso o transferencia general.

      6. description: Breve motivo o descripción amigable (ej: "Compra de mercado de la semana").

      7. confidence: Un puntaje de confianza decimal de 0 a 1 basado en qué tan clara era la frase.

      8. transactionDate: La fecha del movimiento en formato "YYYY-MM-DD", calculada a partir de hoy (${todayStr}):
         - Si no se menciona ninguna referencia temporal, usa hoy: ${todayStr}.
         - "ayer" -> un día antes de hoy. "anteayer" -> dos días antes de hoy.
         - "hace N días" -> N días antes de hoy.
         - "el lunes/martes/... pasado" -> el día de esa semana más reciente que ya pasó (nunca hoy ni en el futuro).
         - "la semana pasada" -> 7 días antes de hoy si no se menciona un día específico de esa semana.
         - Nunca devuelvas una fecha futura.

      Devuelve ÚNICAMENTE un objeto JSON con el siguiente esquema exacto, sin bloques de código markdown ni texto adicional:
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

    // Llamada HTTP a Gemini Flash-Lite Latest (API v1beta) — modelo liviano,
    // suficiente para este parseo y con menos demanda que el flash completo
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;
    
    const response = await fetchWithRetry(geminiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemInstruction },
              { text: `Frase del usuario a procesar: "${input}"` }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json", // Forzar salida JSON en la API de Gemini
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error en la llamada a Gemini: ${errText}`);
    }

    const geminiData = await response.json();
    
    // Extraer y parsear la respuesta JSON de Gemini
    const rawJsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJsonText) {
      throw new Error("Gemini no devolvió un formato de texto procesable.");
    }

    const parsedTransaction = JSON.parse(rawJsonText.trim());

    return new Response(
      JSON.stringify(parsedTransaction),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Error interno del servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
