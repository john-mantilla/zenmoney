const fs = require('fs');
const path = require('path');

function searchSettings() {
  const filePath = 'D:\\Documentos\\Iniciativas\\FinanzasPersonales\\zenmoney\\app\\(tabs)\\settings.tsx';
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  console.log('📌 BÚSQUEDA EN settings.tsx:');
  lines.forEach((line, idx) => {
    if (line.includes('recurringRuleRepo.create') || line.includes('ruleAccountId') || line.includes('ruleType') || line.includes('frequency')) {
      console.log(`Línea ${idx + 1}: ${line.trim()}`);
    }
  });
}

searchSettings();
