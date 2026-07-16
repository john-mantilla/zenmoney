const fs = require('fs');
const path = require('path');

function inspectPdf() {
  const pdfPath = 'D:\\Documentos\\Iniciativas\\FinanzasPersonales\\AnalisisZenMoney.pdf';
  const buffer = fs.readFileSync(pdfPath);
  
  // Contar el número de objetos /Type /Page o /Pages en el binario del PDF
  const content = buffer.toString('binary');
  const pageMatches = content.match(/\/Type\s*\/Page\b/g);
  const count = pageMatches ? pageMatches.length : 0;
  
  console.log(`El archivo PDF tiene aproximadamente ${count} páginas.`);
  
  // Buscar textos clave de los otros ejes para ver si están contenidos en el PDF
  const keywords = ['IA, voz', 'Familia', 'Mercado y roadmap', 'auto_categorization', 'GeminiflashProvider'];
  keywords.forEach(kw => {
    const found = content.includes(kw) || content.toLowerCase().includes(kw.toLowerCase());
    console.log(`Palabra clave "${kw}": ${found ? 'ENCONTRADA' : 'NO ENCONTRADA'}`);
  });
}

inspectPdf();
