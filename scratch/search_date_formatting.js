const fs = require('fs');
const path = require('path');

function searchDateFormatting(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.expo') {
        searchDateFormatting(fullPath);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, idx) => {
        if (line.includes('toLocaleDateString') || line.includes('new Date(')) {
          // Ignorar comentarios o inicializaciones de new Date() sin parámetros
          if (!line.trim().startsWith('//') && !line.includes('new Date()')) {
            console.log(`📁 ${path.relative('D:\\Documentos\\Iniciativas\\FinanzasPersonales\\zenmoney', fullPath)} (Línea ${idx + 1}): ${line.trim()}`);
          }
        }
      });
    }
  });
}

console.log('📌 BUSCANDO CONVERSIONES DE FECHAS EN EL CÓDIGO:');
searchDateFormatting('D:\\Documentos\\Iniciativas\\FinanzasPersonales\\zenmoney\\app');
searchDateFormatting('D:\\Documentos\\Iniciativas\FinanzasPersonales\\zenmoney\\src');
