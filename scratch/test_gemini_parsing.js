const fetch = require('node-fetch');

async function testGeminiParsing() {
  const apiKey = 'sb_publishable_r35zf8Zthn-ZW4gWmnfpxw_PnHxXBJ0'; // Usamos la api key del cliente o la de Gemini
  // Un momento, la api key sb_publishable_... es la de Supabase. La clave de Gemini es la que está en EXPO_PUBLIC_GEMINI_API_KEY.
  // Vamos a leerla del archivo .env directamente.
  const fs = require('fs');
  const envContent = fs.readFileSync('D:\\Documentos\\Iniciativas\\FinanzasPersonales\\zenmoney\\.env', 'utf8');
  const keyMatch = envContent.match(/EXPO_PUBLIC_GEMINI_API_KEY=(.+)/);
  if (!keyMatch) {
    console.error('No se encontró la clave de Gemini en el .env');
    return;
  }
  const geminiKey = keyMatch[1].trim();

  const accounts = [
    { id: '1', name: 'Ahorros Bancolombia', type: 'bank' },
    { id: '2', name: 'Visa Credito', type: 'credit_card' }
  ];
  
  const categories = [
    { id: '101', name: 'Alimentación' },
    { id: '102', name: 'Servicios' },
    { id: '103', name: 'Sin clasificar' }
  ];

  const prompt = `
    Analiza la frase de transacción en español y extrae los detalles en formato JSON estricto.
    
    Lista de Cuentas disponibles (ID y Nombre):
    ${JSON.stringify(accounts)}
    
    Lista de Categorías disponibles (ID y Nombre):
    ${JSON.stringify(categories)}
    
    Instrucciones:
    1. amount: Extrae el monto numérico. Entiende modismos colombianos ("mil", "k" -> 45000; "un palo", "un millón" -> 1000000; "luca" -> 1000). Si no hay, pon null.
    2. type: Determina si es 'expense' (gasto), 'income' (ingreso) o 'transfer' (transferencia).
    3. suggestedAccountId y suggestedAccountName: Compara la cuenta mencionada en el texto con la Lista de Cuentas usando coincidencia difusa (Fuzzy match). Si no hay, pon null.
    4. suggestedCategoryId y suggestedCategoryName: Compara la categoría descrita con la Lista de Categorías. Si no sabes, sugiere el ID de "Sin clasificar".
    5. merchantName: Nombre del establecimiento comercial (ej: Exito, Uber, Netflix). Omitir para ingresos o transferencias.
    6. description: Genera un texto amigable y descriptivo de la transacción.
    7. confidence: Confianza de 0 a 1.
    
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
      "confidence": number
    }
  `;

  const inputPhrases = [
    "gasto de 30000 pesos en Bancolombia",
    "Spotify 30000",
    "pagué 2 millones de la tarjeta desde Bancolombia"
  ];

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`;

  for (const phrase of inputPhrases) {
    console.log(`🤖 Analizando frase: "${phrase}"...`);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { text: `Frase a analizar: "${phrase}"` }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      console.error(`Error: ${response.statusText}`);
      continue;
    }

    const resJson = await response.json();
    const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log(`📄 Respuesta de Gemini:\n${rawText}\n`);
  }
}

testGeminiParsing();
