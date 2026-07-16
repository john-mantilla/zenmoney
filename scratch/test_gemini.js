/**
 * ZenMoney — Diagnóstico de Modelos 2026
 */

const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error('No se encontró el .env');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    envVars[match[1]] = (match[2] || '').trim();
  }
});

const apiKey = envVars['EXPO_PUBLIC_GEMINI_API_KEY'];

const candidates = [
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash'
];

async function runCandidates() {
  console.log('Evaluando candidatos...\n');
  
  for (const model of candidates) {
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hola, responde exactamente "OK".' }] }]
        })
      });
      
      const status = response.status;
      if (status === 200) {
        const json = await response.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        console.log(`✅ [EXITOSO] Modelo: ${model} -> Respuesta: "${text}"`);
      } else {
        const errText = await response.text();
        console.log(`❌ [FALLIDO] Modelo: ${model} (Status ${status}): ${errText}`);
      }
    } catch (err) {
      console.log(`💥 Error de red en ${model}: ${err.message}`);
    }
  }
}

runCandidates();
