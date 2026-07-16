/**
 * ZenMoney — Supabase Edge Function: parse-receipt-image
 *
 * Recibe una foto de recibo/factura (base64) y la analiza con Gemini Flash-Lite (visión)
 * para extraer los detalles de la transacción, en el mismo esquema que parse-nlq.
 */

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
      console.warn(`[Gemini Vision] 503 Service Unavailable detectado. Reintentando en ${delay}ms... (Quedan ${retries} intentos)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    return response;
  } catch (err) {
    if (retries > 0) {
      console.warn(`[Gemini Vision] Fallo de red en llamada. Reintentando en ${delay}ms... (Quedan ${retries} intentos)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw err;
  }
}

serve(async (req) => {
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

    const { imageBase64, mimeType, accounts, categories, referenceDate } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "El campo 'imageBase64' es obligatorio." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isValidReferenceDate = typeof referenceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate);
    const todayStr = isValidReferenceDate ? referenceDate : new Date().toISOString().split("T")[0];

    const systemInstruction = `
      Eres el motor de IA de ZenMoney, una app de finanzas personales. Analiza la imagen de un
      recibo o factura de compra (puede estar arrugado, borroso o fotografiado en ángulo) y
      extrae los detalles de la transacción en formato JSON estricto.

      Hoy es ${todayStr}. Si el recibo no muestra fecha legible, usa esta fecha.

      Lista de Cuentas disponibles del usuario:
      ${JSON.stringify(accounts || [])}

      Lista de Categorías disponibles del usuario:
      ${JSON.stringify(categories || [])}

      Reglas de extracción:
      1. amount: El TOTAL final pagado (no subtotales ni IVA por separado). Solo el número, sin símbolos.
      2. type: Siempre "expense" (un recibo de compra siempre es un gasto).
      3. suggestedAccountId y suggestedAccountName: Solo si el recibo indica método de pago (ej. "tarjeta débito") y coincide con una cuenta de la lista. Si no hay evidencia clara, pon null.
      4. suggestedCategoryId y suggestedCategoryName: Infiere la categoría según el tipo de comercio (ej. supermercado -> "Mercado", restaurante -> "Restaurantes"). Si no hay suficiente información, sugiere el ID de "Sin clasificar".
      5. merchantName: Nombre del comercio/establecimiento tal como aparece en el recibo.
      6. description: Resume brevemente 2-3 productos/ítems principales de la compra si son legibles (ej. "Mercado: leche, pan, arroz"). Si no se distinguen ítems, usa "Compra en {merchantName}".
      7. confidence: 0 a 1, según qué tan legible fue la imagen y qué tan seguro estás del monto total.
      8. transactionDate: Fecha de la compra en "YYYY-MM-DD" si es legible en el recibo, si no, usa ${todayStr}. Nunca una fecha futura.
      9. Si la imagen NO es un recibo/factura reconocible, pon amount: null y confidence: 0.

      Devuelve ÚNICAMENTE un objeto JSON con este esquema exacto, sin bloques de código markdown ni texto adicional:
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
              {
                inline_data: {
                  mime_type: mimeType || "image/jpeg",
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error en la llamada a Gemini Vision: ${errText}`);
    }

    const geminiData = await response.json();
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
